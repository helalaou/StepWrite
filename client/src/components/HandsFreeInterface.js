import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';
import NavigationButton from './NavigationButton';
import SpeakButton from './SpeakButton';
import AudioVisualizer from './AudioVisualizer';
import config from '../config';
import axios from 'axios';

function HandsFreeInterface({
  currentQuestion,
  sendMessage,
  submitAnswer,
  questionStatus,
  setQuestionStatus,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  hasChanges,
  onBackToEditor,
  cameFromEditor, 
  setInput,
}) {
  const navigate = useNavigate();

  // Process indicators
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [isSpeechActive, setIsSpeechActive] = useState(false);

  // Recognized segments (preserved in recorded order)
  const segmentsRef = useRef([]);
  const [mergedSpeech, setMergedSpeech] = useState('');

  // Refs for VAD and timeouts
  const vadRef = useRef(null);
  const replayTimeoutRef = useRef(null);
  const finalizeTimeoutRef = useRef(null);

  // Add a counter for replay attempts
  const replayAttemptsRef = useRef(0);

  // Clear timeout helpers
  const clearFinalizeTimeout = () => {
    if (finalizeTimeoutRef.current) {
      clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = null;
    }
  };
  const clearReplayTimeout = () => {
    if (replayTimeoutRef.current) {
      clearTimeout(replayTimeoutRef.current);
      replayTimeoutRef.current = null;
    }
  };

  // Navigation controls remain unchanged
  const navControls = {
    width: {
      percentage: { xs: '15%', sm: '12%' },
      min: { xs: '20px', sm: '25px' },
      max: { xs: '50px', sm: '80px' }
    },
    arrow: {
      size: { xs: '2rem', sm: '2.8rem', md: '3rem' },
      scale: 1.1
    },
    hover: { intensity: 0.04, base: 0.02 },
    shadow: { intensity: 2 }
  };

  const getNavStyles = (isLeft) => ({
    position: 'absolute',
    [isLeft ? 'left' : 'right']: 0,
    top: 0,
    bottom: 0,
    width: { xs: navControls.width.percentage.xs, sm: navControls.width.percentage.sm },
    minWidth: { xs: navControls.width.min.xs, sm: navControls.width.min.sm },
    maxWidth: { xs: navControls.width.max.xs, sm: navControls.width.max.sm },
    display: 'flex',
    alignItems: 'center',
    justifyContent: isLeft ? 'flex-start' : 'flex-end',
    zIndex: 2,
    backgroundColor:
      (isLeft
        ? currentQuestionIndex === 0
        : currentQuestionIndex === currentQuestion.questions.length - 1)
        ? 'transparent'
        : `rgba(255, 255, 255, ${navControls.hover.base})`,
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    backdropFilter: 'blur(8px)',
    '&:hover': {
      backgroundColor:
        (isLeft
          ? currentQuestionIndex === 0
          : currentQuestionIndex === currentQuestion.questions.length - 1)
          ? 'transparent'
          : `rgba(255, 255, 255, ${navControls.hover.intensity})`
    }
  });

  const getNavButtonStyles = (isDisabled) => ({
    height: '100%',
    width: '100%',
    borderRadius: 0,
    '&.Mui-disabled': { opacity: 0, transform: 'scale(0.95)' },
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    '& .MuiSvgIcon-root': {
      fontSize: { xs: navControls.arrow.size.xs, sm: navControls.arrow.size.sm, md: navControls.arrow.size.md },
      transform: `scale(${navControls.arrow.scale})`,
      color: isDisabled ? 'action.disabled' : 'primary.main',
      transition: 'transform 0.2s ease'
    },
    '&:hover .MuiSvgIcon-root': {
      transform: `scale(${navControls.arrow.scale * 1.1})`
    },
    '&:active .MuiSvgIcon-root': {
      transform: `scale(${navControls.arrow.scale * 0.95})`
    }
  });

  // udate the useEffect that handles question changes
  useEffect(() => {
    if (!currentQuestion?.questions) return;
    
    //reset all voice-related state when question changes
    segmentsRef.current = [];
    setMergedSpeech('');
    setIsSpeechActive(false);
    setIsRecording(false);
    setIsProcessing(false);
    replayAttemptsRef.current = 0; // Reset replay attempts counter
    clearFinalizeTimeout();
    clearReplayTimeout();

    const newStatus = {};
    currentQuestion.questions.forEach((q, index) => {
      if (q.response && q.response.trim() !== '') {
        newStatus[index] = { 
          type: q.response === "user has skipped this question" ? 'skipped' : 'answered', 
          answer: q.response 
        };
      }
    });
    setQuestionStatus(newStatus);

    // Start replay timer if no speech detected
    startReplayTimeout();

    // force TTS to play for new question
    setIsTTSPlaying(true);

    // stop  any existing VAD
    if (vadRef.current) {
      vadRef.current.destroy();
      vadRef.current = null;
    }
  }, [currentQuestionIndex, currentQuestion]);

  // convert float32Array audio to WAV Blob.
  const float32ArrayToWav = (audio) => {
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
    view.setUint16(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true);
    view.setUint32(28, 32000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, audio.length * 2, true);
    let index = 44;
    for (let i = 0; i < audio.length; i++) {
      view.setInt16(index, audio[i] * 0x7FFF, true);
      index += 2;
    }
    return new Blob([wavBuffer], { type: 'audio/wav' });
  };

  // Check if audio is silent.
  const checkAudioSilence = (audio) => {
    const avgEnergy = audio.reduce((sum, sample) => sum + Math.abs(sample), 0) / audio.length;
    const isSilent = avgEnergy < config.handsFreeMode.audio.minEnergy;
    console.log('Audio silence check:', { energy: avgEnergy, threshold: config.handsFreeMode.audio.minEnergy, isSilent });
    return isSilent;
  };

  // Update the startReplayTimeout function
  const startReplayTimeout = () => {
    clearReplayTimeout();
    
    // Only start replay if we have no speech segments
    if (segmentsRef.current.length === 0) {
      console.log('Starting replay timeout, attempt:', replayAttemptsRef.current);
      
      replayTimeoutRef.current = setTimeout(() => {
        if (!isSpeechActive && !isProcessing) {
          console.log('No valid speech, replaying question TTS...');
          setIsTTSPlaying(true);
          replayAttemptsRef.current += 1;
          // Start next replay timeout after this one
          startReplayTimeout();
        }
      }, config.handsFreeMode.replay.interval);
    }
  };

  // Update the checkForCommands function
  const checkForCommands = (transcription) => {
    // Check skip command
    const skipPhrases = config.handsFreeMode.commands.skip.phrases;
    const isSkipCommand = skipPhrases.some(phrase => 
      transcription.toLowerCase().includes(phrase.toLowerCase())
    );

    // Check next command
    const nextPhrases = config.handsFreeMode.commands.next.phrases;
    const isNextCommand = nextPhrases.some(phrase =>
      transcription.toLowerCase().includes(phrase.toLowerCase())
    );

    // Check previous command
    const prevPhrases = config.handsFreeMode.commands.previous.phrases;
    const isPrevCommand = prevPhrases.some(phrase =>
      transcription.toLowerCase().includes(phrase.toLowerCase())
    );

    // Check editor navigation command
    const toEditorPhrases = config.handsFreeMode.commands.toEditor.phrases;
    const isToEditorCommand = toEditorPhrases.some(phrase =>
      transcription.toLowerCase().includes(phrase.toLowerCase())
    );

    if (isSkipCommand) {
      return {
        isCommand: true,
        type: 'skip',
        response: config.handsFreeMode.commands.skip.response
      };
    }

    if (isNextCommand) {
      return {
        isCommand: true,
        type: 'next',
        response: config.handsFreeMode.commands.next.response
      };
    }

    if (isPrevCommand) {
      return {
        isCommand: true,
        type: 'previous',
        response: config.handsFreeMode.commands.previous.response
      };
    }

    // Only allow editor navigation if we're on the last question and can go to editor
    if (isToEditorCommand && 
        currentQuestionIndex === currentQuestion.questions.length - 1 &&
        !hasChanges && 
        cameFromEditor && 
        onBackToEditor) {
      return {
        isCommand: true,
        type: 'toEditor',
        response: config.handsFreeMode.commands.toEditor.response
      };
    }

    return { isCommand: false };
  };

 
  const handleCommandExecution = async (commandCheck) => {
    if (commandCheck.type === 'skip') {
      segmentsRef.current = [commandCheck.response];
      const merged = segmentsRef.current.join(' ');
      setMergedSpeech(merged);
      await finalizeAndSubmit();
    } else if (commandCheck.type === 'toEditor') {
      onBackToEditor();
    } else if (commandCheck.type === 'next') {
      if (currentQuestionIndex < currentQuestion.questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }
    } else if (commandCheck.type === 'previous') {
      if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex(currentQuestionIndex - 1);
      }
    }
  };

  //update finalizeAndSubmit to ensure properr cleanup
  const finalizeAndSubmit = async () => {
    const finalAnswer = segmentsRef.current.join(' ');
    console.log('Final merged answer after silence:', finalAnswer);
    
    try {
      if (currentQuestionIndex === 0) {
        const updatedQuestions = [...currentQuestion.questions];
        updatedQuestions[currentQuestionIndex] = {
          ...updatedQuestions[currentQuestionIndex],
          response: finalAnswer
        };
        const updatedConversationPlanning = {
          ...currentQuestion,
          questions: updatedQuestions
        };
        
        await submitAnswer(
          updatedQuestions[0].id, 
          finalAnswer,
          0,
          updatedConversationPlanning
        );
        
        // Clear state before moving to next question
        segmentsRef.current = [];
        setMergedSpeech('');
        setIsSpeechActive(false);
        setIsRecording(false);
        if (setInput) setInput('');
        
        setCurrentQuestionIndex(1);
      } else {
        await handleSubmitAnswer(finalAnswer);
        
        // Clear state after submitting
        segmentsRef.current = [];
        setMergedSpeech('');
        setIsSpeechActive(false);
        setIsRecording(false);
        if (setInput) setInput('');
      }
    } catch (error) {
      console.error('Error submitting final speech:', error);
      startReplayTimeout();
    }
  };

  // Submission handler. For Q1 (index 0), call submitAnswer then auto-advance.
  const handleSubmitAnswer = async (text) => {
    setIsProcessing(true);
    try {
      const updatedQuestions = [...currentQuestion.questions];
      updatedQuestions[currentQuestionIndex] = {
        ...updatedQuestions[currentQuestionIndex],
        response: text
      };

      // Remove responses for any subsequent questions
      for (let i = currentQuestionIndex + 1; i < updatedQuestions.length; i++) {
        updatedQuestions[i] = {
          ...updatedQuestions[i],
          response: ''
        };
      }

      const updatedConversationPlanning = {
        ...currentQuestion,
        questions: updatedQuestions
      };

      console.log('Submitting answer for question index', currentQuestionIndex, {
        text,
        updatedConversationPlanning
      });

      const newLength = await sendMessage(currentQuestionIndex, updatedConversationPlanning);
      if (newLength && newLength > currentQuestionIndex + 1) {
        setCurrentQuestionIndex(newLength - 1);
        if (setInput) setInput('');
      }

      setQuestionStatus({
        ...questionStatus,
        [currentQuestionIndex]: { type: 'answered', answer: text }
      });
    } catch (error) {
      console.error('Error submitting answer:', error);
      setQuestionStatus({
        ...questionStatus,
        [currentQuestionIndex]: { type: 'answering', answer: text }
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // start voice recording using VAD.
  const startRecording = async () => {
    try {
      if (vadRef.current) {
        await vadRef.current.destroy();
        vadRef.current = null;
      }
      setIsSpeechActive(false);
      setIsRecording(false);
      segmentsRef.current = [];
      setMergedSpeech('');
      clearFinalizeTimeout();

      vadRef.current = await window.vad.MicVAD.new({
        minSpeechFrames: config.handsFreeMode.vad.minSpeechFrames,
        positiveSpeechThreshold: config.handsFreeMode.vad.positiveSpeechThreshold,
        negativeSpeechThreshold: config.handsFreeMode.vad.negativeSpeechThreshold,
        redemptionFrames: config.handsFreeMode.vad.redemptionFrames,
        vadMode: config.handsFreeMode.vad.mode,
        logLevel: 3,
        groupedLogLevel: 3,
        runtimeLogLevel: 3,
        runtimeVerboseLevel: 0,
        onSpeechStart: () => {
          console.log('Speech segment started...');
          setIsSpeechActive(true);
          setIsRecording(true);
          clearFinalizeTimeout();
          clearReplayTimeout();
        },
        onSpeechEnd: async (audio) => {
          console.log('Speech segment ended, transcribing...');
          setIsSpeechActive(false);
          setIsRecording(false);
          setIsProcessing(true);
          
          if (checkAudioSilence(audio)) {
            console.log('Silent segment detected – ignoring and waiting for new input');
            setIsProcessing(false);
            startReplayTimeout();
            return;
          }
          
          try {
            const formData = new FormData();
            const wavBlob = float32ArrayToWav(audio);
            formData.append('audio', wavBlob, 'recording.wav');
            const response = await axios.post(
              `${config.apiUrl}${config.endpoints.transcribe}`,
              formData,
              { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            
            if (response.data.text) {
              let transcription = response.data.text.trim().toLowerCase();
              transcription = transcription.replace(/[.,\/#!$%^&*;:{}=\-_`~()]/g, '');
              console.log('Segment transcription:', transcription);

              replayAttemptsRef.current = 0;
              console.log('Valid speech detected, reset replay attempts to 0');

              const commandCheck = checkForCommands(transcription);
              if (commandCheck.isCommand) {
                await handleCommandExecution(commandCheck);
                setIsProcessing(false);
                return;
              }

              // Regular transcription handling...
              segmentsRef.current.push(transcription);
              const merged = segmentsRef.current.join(' ');
              setMergedSpeech(merged);
              clearFinalizeTimeout();
              finalizeTimeoutRef.current = setTimeout(async () => {
                await finalizeAndSubmit();
              }, config.handsFreeMode.concatenation.finalizeDelay);
            }
          } catch (err) {
            console.error('Transcription error:', err);
            startReplayTimeout();
          } finally {
            setIsProcessing(false);
          }
        },
        onVADMisfire: () => {
          console.log('VAD misfire – restarting recording...');
          setIsSpeechActive(false);
          setIsRecording(false);
          startRecording();
        }
      });
      console.log('Starting VAD...');
      await vadRef.current.start();
    } catch (err) {
      console.error('Error starting VAD:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (vadRef.current) vadRef.current.destroy();
      clearFinalizeTimeout();
      clearReplayTimeout();
    };
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Navigation Buttons */}
      {currentQuestionIndex === 0 && (
        <NavigationButton
          direction="left"
          onClick={() => navigate('/')}
          tooltip="Back to Home"
        />
      )}
      {currentQuestionIndex === currentQuestion.questions.length - 1 &&
        !hasChanges &&
        cameFromEditor &&
        onBackToEditor && (
          <NavigationButton
            direction="right"
            onClick={onBackToEditor}
            tooltip="Back to Editor"
          />
        )}
      <Box sx={getNavStyles(true)}>
        <IconButton
          onClick={() => {
            if (currentQuestionIndex > 0) setCurrentQuestionIndex(currentQuestionIndex - 1);
          }}
          disabled={currentQuestionIndex === 0}
          sx={getNavButtonStyles(currentQuestionIndex === 0)}
        >
          <ArrowBackIcon />
        </IconButton>
      </Box>
      <Box sx={getNavStyles(false)}>
        <IconButton
          onClick={() => {
            if (currentQuestionIndex < currentQuestion.questions.length - 1)
              setCurrentQuestionIndex(currentQuestionIndex + 1);
          }}
          disabled={currentQuestionIndex === currentQuestion.questions.length - 1}
          sx={getNavButtonStyles(currentQuestionIndex === currentQuestion.questions.length - 1)}
        >
          <ArrowForwardIcon />
        </IconButton>
      </Box>
      <Box
        sx={{
          width: '100%',
          maxWidth: '1700px',
          padding: { xs: '0 60px', sm: '0 15%' },
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Display Current Question */}
        <Box sx={{ position: 'relative', width: '100%', mb: 4 }}>
          <Typography
            variant="h4"
            sx={{
              fontSize: { xs: '24pt', sm: '32pt', md: '42pt' },
              textAlign: 'center',
              transition: 'all 0.3s ease',
              width: '100%',
              pr: { xs: '32px', sm: '48px' }
            }}
          >
            {currentQuestion.questions[currentQuestionIndex]?.question || ''}
          </Typography>
          <Box sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}>
            {config.tts.mode === 'ENABLED' && (
              <SpeakButton
                text={currentQuestion.questions[currentQuestionIndex]?.question}
                onComplete={() => {
                  setIsTTSPlaying(false);
                  startRecording();
                }}
                autoPlay={isTTSPlaying}
                showAnimation={isTTSPlaying}
                disabled={isProcessing}
              />
            )}
          </Box>
        </Box>
        {/* Visualizer and Status */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <AudioVisualizer isSpeechDetected={isSpeechActive} />
          <Typography>
            {isProcessing
              ? 'Processing...'
              : isRecording
              ? 'Recording...'
              : 'Waiting for speech...'}
          </Typography>
          {mergedSpeech && (
            <Typography variant="body1" sx={{ mt: 2 }}>
              Recognized: {mergedSpeech}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default HandsFreeInterface;
