import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, TextField, Button, Typography, IconButton, Tooltip, Divider } from '@mui/material';
import WestIcon from '@mui/icons-material/West';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import FormatLineSpacingIcon from '@mui/icons-material/FormatLineSpacing';
import TextIncreaseIcon from '@mui/icons-material/TextIncrease';
import TextDecreaseIcon from '@mui/icons-material/TextDecrease';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import MicIcon from '@mui/icons-material/Mic';
import config from '../config';
import axios from 'axios';
import { keyframes } from '@mui/system';

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
  onHistoryChange
}) {
  const [contentHistory, setContentHistory] = useState(savedHistory || [savedContent || initialContent]);
  const [currentIndex, setCurrentIndex] = useState(savedHistory ? savedHistory.length - 1 : 0);
  const [content, setContent] = useState(savedContent || initialContent);
  const [fontSize, setFontSize] = useState(editorPreferences.fontSize || 1.1);
  const [oneSentencePerLine, setOneSentencePerLine] = useState(editorPreferences.oneSentencePerLine);
  const [defaultFormat] = useState(savedContent || initialContent);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isSpeechActive, setIsSpeechActive] = useState(false);
  
  const vadRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  // Add isHandsFree check
  const isHandsFree = config.input.mode === 'HANDS_FREE';

  // Add ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Add ref to track cleanup status
  const isCleaningUpRef = useRef(false);

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

  const getWordCount = useCallback((text) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }, []);

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
      setIsListening(false);

      if (isMountedRef.current && isEnabled) {
        vadRef.current = await window.vad.MicVAD.new({
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
            setIsListening(true);
          },
          onSpeechEnd: async (audio) => {
            console.log('Speech segment ended, transcribing...');
            setIsSpeechActive(false);
            setIsListening(false);

            // Check if audio is silent
            const avgEnergy = audio.reduce((sum, sample) => sum + Math.abs(sample), 0) / audio.length;
            if (avgEnergy < config.handsFree.audio.minEnergy) {
              console.log('Silent segment detected – ignoring');
              return;
            }

            try {
              // Log the audio data for debugging
              console.log('Audio data:', {
                length: audio.length,
                sampleRate: 16000,
                energy: avgEnergy
              });

              const formData = new FormData();
              const wavBlob = float32ArrayToWav(audio);
              
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
                const toQuestionsCommand = config.handsFree.commands.toQuestions.phrases.some(
                  phrase => transcription.includes(phrase.toLowerCase())
                );

                if (toQuestionsCommand) {
                  console.log('Navigation command detected, going back to questions');
                  onBack();
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
            setIsListening(false);
            startListening();
          }
        });

        if (isMountedRef.current) {
          await vadRef.current.start();
          setIsListening(true);
        }
      }
    } catch (error) {
      console.error('Error starting VAD:', error);
      setIsEnabled(false);
    }
  }, [isEnabled, safeDestroyVAD, onBack]);

  const toggleMic = useCallback(() => {
    if (isEnabled) {
      setIsEnabled(false);
      setIsListening(false);
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
      // Safe cleanup
      if (vadRef.current) {
        // Wrap in try/catch and don't chain catch
        try {
          vadRef.current.destroy();
        } catch (err) {
          console.log('VAD cleanup error (safe to ignore):', err);
        }
        vadRef.current = null;
      }
    };
  }, [isHandsFree, isEnabled, startListening]);

  // Component mount/unmount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Safe cleanup
      if (vadRef.current) {
        // Wrap in try/catch and don't chain catch
        try {
          vadRef.current.destroy();
        } catch (err) {
          console.log('VAD cleanup error (safe to ignore):', err);
        }
        vadRef.current = null;
      }
    };
  }, []);

  // Helper function to convert Float32Array to WAV
  const float32ArrayToWav = (audio) => {
    const sampleRate = 16000;
    
    const wavBuffer = new ArrayBuffer(44 + audio.length * 2);
    const view = new DataView(wavBuffer);
    
    const writeString = (v, offset, s) => {
      for (let i = 0; i < s.length; i++) {
        v.setUint8(offset + i, s.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + audio.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, audio.length * 2, true);

    let offset = 44;
    for (let i = 0; i < audio.length; i++) {
      view.setInt16(offset, audio[i] * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
  };

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
            onClick={onBack}
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
        </Box>
      </Box>
    </Box>
  );
}

export default TextEditor; 