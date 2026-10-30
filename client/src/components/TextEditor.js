import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, TextField, Button, Typography, IconButton, Tooltip } from '@mui/material';
import WestIcon from '@mui/icons-material/West';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
// import FormatLineSpacingIcon from '@mui/icons-material/FormatLineSpacing'; // one sentence per line, temporarily disabled
import TextIncreaseIcon from '@mui/icons-material/TextIncrease';
import TextDecreaseIcon from '@mui/icons-material/TextDecrease';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import MicIcon from '@mui/icons-material/Mic';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import config from '../config';
import axios from 'axios';
import { keyframes } from '@mui/system';
import { playClickSound } from '../utils/soundUtils';
import { enterRevision } from '../utils/experimentTracking';
import { encodeWav, VAD_SAMPLE_RATE } from '../utils/audioUtils';
import { matchesAnyPhrase } from '../utils/voiceCommands';
import ExperimentEndButton from './ExperimentEndButton';

// Add the pulse animation
const pulseAnimation = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0.8;
  }
`;

function TextEditor({ 
  initialContent, 
  onBack, 
  onContentChange, 
  savedContent,
  editorPreferences,
  onPreferencesChange,
  savedHistory,
  onHistoryChange,
  conversationPlanning
}) {
  const [contentHistory, setContentHistory] = useState(savedHistory || [savedContent || initialContent]);
  const [currentIndex, setCurrentIndex] = useState(savedHistory ? savedHistory.length - 1 : 0);
  const [content, setContent] = useState(savedContent || initialContent);
  const [fontSize, setFontSize] = useState(editorPreferences.fontSize || 1.1);
  // const [defaultFormat] = useState(savedContent || initialContent); // one sentence per line, temporarily disabled
  const [copySuccess, setCopySuccess] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isSpeechActive, setIsSpeechActive] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);
  const ttsButtonRef = useRef(null);
  const ttsRequestIdRef = useRef(0);
  const hasSynthesizedRef = useRef(false);
  const hasAutoPlayedRef = useRef(false);
  const autoPlayTimerRef = useRef(null);
  
  const vadRef = useRef(null);
  // Bumped whenever the VAD is stopped or replaced, so a MicVAD that finishes
  // initializing afterwards is destroyed instead of keeping the mic open.
  const vadGenerationRef = useRef(0);

  // Add isHandsFree check
  const isHandsFree = config.input.mode === 'HANDS_FREE';

  // Add ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Add ref to track cleanup status
  const isCleaningUpRef = useRef(false);

  // Add a reference to the experiment end button
  const endExperimentButtonRef = useRef(null);

  // Add state and refs for voice command detection
  const speechRecognitionRef = useRef(null);
  
  // Time in the editor counts as revision
  useEffect(() => {
    enterRevision();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if ((window.innerWidth < 500 || window.innerHeight < 500) && fontSize === editorPreferences.fontSize) {
        setFontSize(0.9);
        onPreferencesChange({
          ...editorPreferences,
          fontSize: 0.9
        });
      }
    };

    handleResize();

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [editorPreferences, onPreferencesChange, fontSize]);

  // Commented out one sentence per line formatting functions
  /*
  const formatToOneSentencePerLine = (text) => {
    return text
      .replace(/\n\s*\n/g, '\n[PARAGRAPH]\n')
      .replace(/([.!?])\s+/g, '$1\n\n')
      .replace(/([.!?])([^.\s\n])/g, '$1\n\n$2')
      .replace(/\[PARAGRAPH\]/g, '\n\n')
      .replace(/\n{3,}/g, '\n\n');
  };

  const reverseOneSentencePerLine = (text) => {
    return text
      .replace(/([.!?])\n\n/g, '$1 ')
      .replace(/\n+/g, '\n');
  };

  const handleToggleFormat = () => {
    const newOneSentencePerLine = !oneSentencePerLine;
    let newContent;
    
    if (newOneSentencePerLine) {
      newContent = formatToOneSentencePerLine(content);
    } else {
      newContent = defaultFormat;
    }
    
    setContent(newContent);
    setOneSentencePerLine(newOneSentencePerLine);
    
    const newHistory = contentHistory.slice(0, currentIndex + 1);
    const updatedHistory = [...newHistory, newContent];
    setContentHistory(updatedHistory);
    setCurrentIndex(currentIndex + 1);

    onContentChange(newContent);
    onHistoryChange(updatedHistory);
  };
  */

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    const newHistory = contentHistory.slice(0, currentIndex + 1);
    const updatedHistory = [...newHistory, newContent];
    setContentHistory(updatedHistory);
    setCurrentIndex(currentIndex + 1);

    onContentChange(newContent);
    onHistoryChange(updatedHistory);
  };

  const handleUndo = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const newContent = contentHistory[newIndex];
      
      setCurrentIndex(newIndex);
      setContent(newContent);
      
      // Notify parent of content and history changes
      onContentChange(newContent);
      onHistoryChange(contentHistory);
    }
  };

  const handleRedo = () => {
    if (currentIndex < contentHistory.length - 1) {
      const newIndex = currentIndex + 1;
      const newContent = contentHistory[newIndex];
      
      setCurrentIndex(newIndex);
      setContent(newContent);
      
      // Notify parent of content and history changes
      onContentChange(newContent);
      onHistoryChange(contentHistory);
    }
  };

  const handleIncreaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 0.1, 2.0));
  };

  const handleDecreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 0.1, 0.8));
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const safeDestroyVAD = useCallback(async () => {
    vadGenerationRef.current += 1;
    if (!vadRef.current || isCleaningUpRef.current) return;
    
    isCleaningUpRef.current = true;
    try {
      await vadRef.current.destroy();
    } catch (error) {
      console.log('VAD cleanup error (safe to ignore):', error);
    } finally {
      vadRef.current = null;
      isCleaningUpRef.current = false;
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!isEnabled || !isMountedRef.current) return;
    
    try {
      await safeDestroyVAD();
      
      setIsSpeechActive(false);

      if (isMountedRef.current && isEnabled) {
        const generation = ++vadGenerationRef.current;
        const vad = await window.vad.MicVAD.new({
          minSpeechFrames: config.handsFree.vad.minSpeechFrames,
          positiveSpeechThreshold: config.handsFree.vad.positiveSpeechThreshold,
          negativeSpeechThreshold: config.handsFree.vad.negativeSpeechThreshold,
          redemptionFrames: config.handsFree.vad.redemptionFrames,
          vadMode: config.handsFree.vad.mode,
          logLevel: 3,
          groupedLogLevel: 3,
          runtimeLogLevel: 3,
          runtimeVerboseLevel: 0,
          onSpeechStart: () => {
            console.log('Speech segment started...');
            setIsSpeechActive(true);
          },
          onSpeechEnd: async (audio) => {
            console.log('Speech segment ended, transcribing...');
            setIsSpeechActive(false);

            // Check if audio is silent
            const avgEnergy = audio.reduce((sum, sample) => sum + Math.abs(sample), 0) / audio.length;
            if (avgEnergy < config.handsFree.vad.minEnergy) {
              console.log('Silent segment detected – ignoring');
              return;
            }

            try {
              const formData = new FormData();
              const wavBlob = encodeWav(audio, VAD_SAMPLE_RATE);
              
              // Log the blob for debugging
              console.log('WAV blob:', {
                size: wavBlob.size,
                type: wavBlob.type
              });
              
              formData.append('audio', wavBlob, 'recording.wav');
              
              const response = await axios.post(
                `${config.core.apiUrl}${config.core.endpoints.transcribe}`,
                formData,
                { 
                  headers: { 
                    'Content-Type': 'multipart/form-data'
                  },
                  // Add timeout and response type
                  timeout: 10000,
                  responseType: 'json'
                }
              );

              if (response.data.text) {
                const transcription = response.data.text.trim().toLowerCase();
                console.log('Transcription received:', transcription);
                
                // Check for navigation command
                const toQuestionsCommand = matchesAnyPhrase(
                  transcription,
                  config.handsFree.commands.textEditor.toQuestions.phrases
                );

                if (toQuestionsCommand) {
                  console.log('Navigation command detected, going back to questions');
                  onBack();
                  return;
                }

                // Check for play or stop TTS commands
                const playTTSCommand = matchesAnyPhrase(
                  transcription,
                  config.handsFree.commands.textEditor.play.phrases
                );
                
                const stopTTSCommand = matchesAnyPhrase(
                  transcription,
                  config.handsFree.commands.textEditor.stop.phrases
                );
                
                // This callback outlives renders, so ask the audio element
                // whether it is playing rather than reading isTTSPlaying.
                const audioIsPlaying = Boolean(audioRef.current && !audioRef.current.paused);

                if (playTTSCommand && config.tts.mode === 'ENABLED') {
                  if (!audioIsPlaying && ttsButtonRef.current && !ttsButtonRef.current.disabled) {
                    ttsButtonRef.current.click();
                  }
                  return;
                }

                if (stopTTSCommand && config.tts.mode === 'ENABLED') {
                  if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                  }
                  setIsTTSPlaying(false);
                  return;
                }
              }
            } catch (error) {
              // More detailed error logging
              console.error('Transcription error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                headers: error.response?.headers
              });
              console.log('Continuing to listen for navigation commands...');
            }
          },
          onVADMisfire: () => {
            console.log('VAD misfire – restarting...');
            setIsSpeechActive(false);
            startListening();
          }
        });

        // MicVAD.new opens the microphone; drop the VAD if the editor was
        // closed or the VAD restarted while it was initializing.
        if (generation !== vadGenerationRef.current || !isMountedRef.current) {
          vad.destroy();
          return;
        }
        vadRef.current = vad;
        await vad.start();
      }
    } catch (error) {
      console.error('Error starting VAD:', error);
      setIsEnabled(false);
    }
  }, [isEnabled, safeDestroyVAD, onBack]);

  const toggleMic = useCallback(() => {
    if (isEnabled) {
      setIsEnabled(false);
      setIsSpeechActive(false);
      safeDestroyVAD();
    } else {
      setIsEnabled(true);
    }
  }, [isEnabled, safeDestroyVAD]);

  // Handle VAD lifecycle
  useEffect(() => {
    let mounted = true;

    if (isHandsFree && isEnabled && mounted) {
      startListening();
    }

    return () => {
      mounted = false;
      safeDestroyVAD();
    };
  }, [isHandsFree, isEnabled, startListening, safeDestroyVAD]);

  // Component mount/unmount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      safeDestroyVAD();
    };
  }, [safeDestroyVAD]);

  // Add a handler for the back button to play sound
  const handleBackClick = () => {
    playClickSound();
    if (onBack) onBack();
  };

  // Synthesize the text once the user pauses typing rather than on every
  // keystroke. Each change bumps the request id so a response for text that
  // has changed since is dropped, and the play button stays disabled until
  // the audio matches the text.
  useEffect(() => {
    const requestId = ++ttsRequestIdRef.current;
    if (config.tts.mode !== 'ENABLED' || !content.trim()) {
      setIsTTSLoading(false);
      return undefined;
    }

    const isCurrent = () => requestId === ttsRequestIdRef.current;

    const synthesize = async () => {
      try {
        const response = await fetch(`${config.core.apiUrl}${config.core.endpoints.tts}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ text: `${config.tts.outputPrefix} ${content}` })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.audioUrl) {
          throw new Error('No audio URL in response');
        }
        if (!isCurrent()) return;

        hasSynthesizedRef.current = true;
        const url = `${config.core.apiUrl}${data.audioUrl}`;
        setAudioUrl(url);

        // Read the text aloud once, when the editor opens. The short delay
        // lets the editor finish rendering first.
        if (!hasAutoPlayedRef.current) {
          hasAutoPlayedRef.current = true;
          autoPlayTimerRef.current = setTimeout(() => playTTSRef.current(url), 500);
        }
      } catch (error) {
        console.error('TTS generation error:', error);
      } finally {
        if (isCurrent()) setIsTTSLoading(false);
      }
    };

    setIsTTSLoading(true);
    const timer = setTimeout(synthesize, hasSynthesizedRef.current ? config.tts.editorDebounceMs : 0);
    return () => clearTimeout(timer);
  }, [content]);

  // Function to play TTS audio
  const playTTS = async (url = audioUrl) => {
    if (isTTSPlaying || !url) return;
    
    try {
      // If we have an existing audio element playing, stop it
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // Create new audio element
      const audio = new Audio(url);
      audioRef.current = audio;
      
      // Play sound on button click
      playClickSound();
      
      // Add event listeners
      audio.addEventListener('ended', () => {
        setIsTTSPlaying(false);
      });
      
      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        setIsTTSPlaying(false);
      });

      // Play the audio
      await audio.play();
      setIsTTSPlaying(true);
    } catch (error) {
      console.error('Error playing TTS:', error);
      setIsTTSPlaying(false);
    }
  };

  // The auto-play timer outlives the render that started it, so it calls the
  // latest playTTS through a ref.
  const playTTSRef = useRef(playTTS);
  useEffect(() => {
    playTTSRef.current = playTTS;
  });

  // Function to stop TTS playback
  const stopTTS = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsTTSPlaying(false);
  };
  
  // Stop TTS when component unmounts
  useEffect(() => {
    return () => {
      clearTimeout(autoPlayTimerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Initialize voice recognition for commands
  useEffect(() => {
    // Only setup voice command recognition if experiment is enabled and we're using a browser with SpeechRecognition
    if (config.experiment.enabled && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        console.log('Voice command detected:', transcript);
        
        const matchesEndExperiment = matchesAnyPhrase(
          transcript,
          config.handsFree.commands.textEditor.endExperiment.phrases
        );
        
        if (matchesEndExperiment && endExperimentButtonRef.current) {
          console.log('End experiment command detected');

          // Simulate a click on the end experiment button
          endExperimentButtonRef.current.click();
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };
      
      speechRecognitionRef.current = recognition;
      
      // Start listening for commands
      try {
        recognition.start();
        console.log('Started listening for voice commands');
      } catch (error) {
        console.error('Error starting speech recognition:', error);
      }
    }
    
    // Cleanup
    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch (error) {
          console.error('Error stopping speech recognition:', error);
        }
      }
    };
  }, []);

  return (
    <Box sx={{ 
      display: 'flex',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <Box sx={{
        position: 'fixed',
        left: { xs: '8px', md: 0 },
        top: { xs: 'auto', md: '50%' },
        bottom: { xs: '8px', md: 'auto' },
        transform: { xs: 'none', md: 'translateY(-50%)' },
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'background.paper',
        borderRadius: { 
          xs: '4px', 
          md: '0 8px 8px 0' 
        },
        boxShadow: 2,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: { 
            xs: 'translateX(5px)', 
            md: 'translateY(-50%) translateX(5px)' 
          },
          boxShadow: 4,
        },
        '@media (max-width: 1300px)': {
          left: '8px',
          top: 'auto',
          bottom: '8px',
          transform: 'none',
          '&:hover': {
            transform: 'translateX(5px)',
          },
        }
      }}>
        <Tooltip title="Back to Questions" placement="right">
          <Button
            variant="contained"
            onClick={handleBackClick}
            sx={{ 
              minWidth: { xs: '40px', lg: '65px' },
              width: { xs: '40px', lg: '65px' },
              height: { xs: '40px', lg: '65px' },
              borderRadius: { 
                xs: '4px', 
                md: '0 8px 8px 0' 
              },
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '@media (max-width: 1300px)': {
                borderRadius: '4px',
              }
            }}
          >
            <WestIcon sx={{ fontSize: { xs: '1.2rem', lg: '1.8rem' } }} />
          </Button>
        </Tooltip>
      </Box>

      <Box sx={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: { xs: '10px', sm: '20px' },
        paddingLeft: { xs: '5px', sm: '30px', md: '40px' },
        paddingRight: { xs: '5px', sm: '30px', md: '40px' },
        maxWidth: { xs: '100%', sm: '100%', md: '1200px' },
        margin: '0 auto',
        width: '100%',
        position: 'relative',
        height: '100%',
      }}>
        <Box sx={{ 
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          mb: { xs: '48px', sm: '56px' },
        }}>
          <Box sx={{ 
            position: 'relative',
            flex: 1,
            '& .MuiTextField-root': {
              height: '100%',
            }
          }}>
            <TextField
              multiline
              fullWidth
              minRows={20}
              maxRows={40}
              value={content}
              onChange={handleContentChange}
              sx={{
                '& .MuiInputBase-root': {
                  height: '100%',
                  '& textarea': {
                    height: '100% !important',
                    fontSize: `${fontSize}rem`,
                    lineHeight: '1.5',
                    padding: { xs: '10px', sm: '20px' },
                  }
                }
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Control Bar at the Bottom */}
      <Box sx={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxWidth: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: { xs: 1, sm: 2 },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: { xs: '4px', sm: '4px 8px' },
        borderRadius: '4px 4px 0 0',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.15)',
        zIndex: 1,
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: { xs: 1, sm: 2 },
          flexWrap: 'nowrap',
          width: { xs: 'auto', sm: 'auto' },
        }}>
          <Tooltip title="Undo last change">
            <span>
              <IconButton 
                onClick={handleUndo} 
                disabled={currentIndex === 0}
                size="small"
                sx={{ 
                  padding: { xs: '4px', sm: '4px' }
                }}
              >
                <UndoIcon sx={{ fontSize: { xs: '1.2rem', sm: '1.25rem' } }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo last change">
            <span>
              <IconButton 
                onClick={handleRedo} 
                disabled={currentIndex === contentHistory.length - 1}
                size="small"
                sx={{ 
                  padding: { xs: '4px', sm: '4px' }
                }}
              >
                <RedoIcon sx={{ fontSize: { xs: '1.2rem', sm: '1.25rem' } }} />
              </IconButton>
            </span>
          </Tooltip>

          {/*one sentence per line logic -- temporarily disabled
          <Tooltip title={`${oneSentencePerLine ? 'Disable' : 'Enable'} one sentence per line`}>
            <IconButton
              onClick={handleToggleFormat}
              size="small"
              color={oneSentencePerLine ? 'primary' : 'default'}
              sx={{
                padding: { xs: '4px', sm: '4px' },
                transition: 'all 0.2s ease',
                transform: oneSentencePerLine ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              <FormatLineSpacingIcon sx={{ fontSize: { xs: '1.2rem', sm: '1.25rem' } }} />
            </IconButton>
          </Tooltip>
          */}

          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 1, sm: 1 }
          }}>
            <Tooltip title="Decrease font size">
              <span>
                <IconButton
                  onClick={handleDecreaseFontSize}
                  size="small"
                  disabled={fontSize <= 0.8}
                  sx={{ padding: { xs: '4px', sm: '4px' } }}
                >
                  <TextDecreaseIcon sx={{ fontSize: { xs: '1.2rem', sm: '1.25rem' } }} />
                </IconButton>
              </span>
            </Tooltip>

            <Typography 
              variant="body2" 
              sx={{ 
                color: 'text.secondary',
                minWidth: '32px',
                textAlign: 'center',
                fontSize: { xs: '0.875rem', sm: '0.875rem' }
              }}
            >
              {Math.round(fontSize * 10) / 10}x
            </Typography>

            <Tooltip title="Increase font size">
              <span>
                <IconButton
                  onClick={handleIncreaseFontSize}
                  size="small"
                  disabled={fontSize >= 2.0}
                  sx={{ padding: { xs: '4px', sm: '4px' } }}
                >
                  <TextIncreaseIcon sx={{ fontSize: { xs: '1.2rem', sm: '1.25rem' } }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          
          
          {/* Word Counter */}
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary',
              fontSize: { xs: '0.91rem', sm: '0.91rem' },
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {content.trim().split(/\s+/).filter(word => word.length > 0).length} words
          </Typography>

         
          <Tooltip title={copySuccess ? 'Copied!' : 'Copy to clipboard'}>
            <IconButton
              onClick={handleCopyToClipboard}
              size="small"
              color={copySuccess ? 'success' : 'default'}
              sx={{
                padding: { xs: '4px', sm: '4px' },
                transition: 'all 0.2s ease',
              }}
            >
              {copySuccess ? 
                <CheckIcon sx={{ fontSize: { xs: '1.2rem', sm: '1.25rem' } }} /> : 
                <ContentCopyIcon sx={{ fontSize: { xs: '1.2rem', sm: '1.25rem' } }} />
              }
            </IconButton>
          </Tooltip>

          {/* Only show mic button in hands-free mode */}
          {isHandsFree && (
            <Tooltip title={isEnabled ? "Click to disable voice commands" : "Click to enable voice commands"}>
              <IconButton
                onClick={toggleMic}
                size="small"
                sx={{
                  padding: { xs: '4px', sm: '4px' },
                  color: isEnabled ? 'error.main' : 'action.active',
                  animation: isSpeechActive ? `${pulseAnimation} 1s infinite` : 'none',
                  '&:hover': {
                    backgroundColor: isEnabled ? 'error.light' : 'action.hover',
                    opacity: 0.8
                  },
                }}
              >
                <MicIcon sx={{ 
                  fontSize: { xs: '1.2rem', sm: '1.25rem' },
                  transform: isEnabled ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.2s ease'
                }} />
              </IconButton>
            </Tooltip>
          )}
          
          {/* TTS button */}
          {config.tts.mode === 'ENABLED' && (
            <Tooltip title={isTTSPlaying ? "Stop playback" : "Play text aloud"}>
              <IconButton
                ref={ttsButtonRef}
                onClick={isTTSPlaying ? stopTTS : () => playTTS()}
                disabled={!isTTSPlaying && (isTTSLoading || !content.trim())}
                size="small"
                sx={{
                  padding: { xs: '4px', sm: '4px' },
                  color: isTTSPlaying ? 'primary.main' : 'action.active',
                  animation: isTTSPlaying ? `${pulseAnimation} 1s infinite` : 'none',
                  '&:hover': {
                    backgroundColor: isTTSPlaying ? 'primary.light' : 'action.hover',
                    opacity: 0.8
                  },
                }}
              >
                <VolumeUpIcon sx={{ 
                  fontSize: { xs: '1.2rem', sm: '1.25rem' },
                  transform: isTTSPlaying ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.2s ease'
                }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Add experiment end button if experiment is enabled */}
      {config.experiment.enabled && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <ExperimentEndButton 
            content={content} 
            textOutput={initialContent}
            conversationPlanning={conversationPlanning}
            ref={endExperimentButtonRef}   
          />
        </Box>
      )}
    </Box>
  );
}

export default TextEditor; 