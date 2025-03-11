import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, IconButton, Paper } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EditIcon from '@mui/icons-material/Edit';
import MicIcon from '@mui/icons-material/Mic';
import { useNavigate } from 'react-router-dom';
import NavigationButton from './NavigationButton';
import SpeakButton from './SpeakButton';
import AudioVisualizer from './AudioVisualizer';
import config from '../config';
import axios from 'axios';
import { keyframes } from '@emotion/react';
import { playClickSound } from '../utils/soundUtils';

// Animations
const pulseAnimation = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(25, 118, 210, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(25, 118, 210, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(25, 118, 210, 0);
  }
`;

const fadeInAnimation = keyframes`
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const floatInAnimation = keyframes`
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
`;

const previewPulseAnimation = keyframes`
  0% {
    border-color: #1976d2;
    box-shadow: 0 0 0 0 rgba(25, 118, 210, 0.4);
  }
  70% {
    border-color: #1976d2;
    box-shadow: 0 0 0 10px rgba(25, 118, 210, 0);
  }
  100% {
    border-color: #1976d2;
    box-shadow: 0 0 0 0 rgba(25, 118, 210, 0);
  }
`;

const slideInFromRightAnimation = keyframes`
  0% {
    transform: translateX(10px);
    opacity: 0;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
`;

const replaceAnimation = keyframes`
  0% {
    background-color: rgba(25, 118, 210, 0.05);
  }
  50% {
    background-color: rgba(25, 118, 210, 0.15);
  }
  100% {
    background-color: rgba(25, 118, 210, 0.05);
  }
`;

function HandsFreeInterface({
  currentQuestion,
  sendMessage,
  submitAnswer,
  questionStatus,
  setQuestionStatus,
  currentQuestionIndex,
  setCurrentQuestionIndex: parentSetCurrentQuestionIndex,
  hasChanges,
  onBackToEditor,
  cameFromEditor,
  setInput,
}) {
  const navigate = useNavigate();

  // UI state indicators
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [isSpeechActive, setIsSpeechActive] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [recognitionFeedback, setRecognitionFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState('default');
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  // Speech processing and recognition
  const segmentsRef = useRef([]);
  const [mergedSpeech, setMergedSpeech] = useState('');
  const vadRef = useRef(null);
  const replayTimeoutRef = useRef(null);
  const finalizeTimeoutRef = useRef(null);
  const replayAttemptsRef = useRef(0);
  const lastSpeechDetectionTimeRef = useRef(0);
  const isModifyingRef = useRef(false);
  const [modifiedQuestions, setModifiedQuestions] = useState(new Set());

  // Debug wrapper for question navigation
  const setCurrentQuestionIndexWithDebug = (newIndex) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Navigation: Changing question index from ${currentQuestionIndex} to ${newIndex}`);
    }
    parentSetCurrentQuestionIndex(newIndex);
  };
  
  const setCurrentQuestionIndex = setCurrentQuestionIndexWithDebug;
  
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Navigation: Question index updated to ${currentQuestionIndex}`);
    }
  }, [currentQuestionIndex]);
  
  const safeNavigate = useCallback((route) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Navigation: Navigating to ${route}`);
    }
    playClickSound();
    navigate(route);
  }, [navigate]);

  // Timer management functions
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
  
  const updateSpeechDetectionTime = () => {
    lastSpeechDetectionTimeRef.current = Date.now();
  };

  // Display user feedback with auto-hide after 3 seconds
  const displayFeedback = (message, type = 'default') => {
    setRecognitionFeedback(message);
    setFeedbackType(type);
    setShowFeedback(true);
    setTimeout(() => setShowFeedback(false), 3000);
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

  // Reset state and configure TTS when question changes
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Question changed to index: ${currentQuestionIndex}`);
    }
    if (!currentQuestion?.questions) return;

    // Reset voice-related state
    segmentsRef.current = [];
    setMergedSpeech('');
    setIsSpeechActive(false);
    setIsRecording(false);
    setIsProcessing(false);
    setIsModifying(false);
    replayAttemptsRef.current = 0;
    clearFinalizeTimeout();
    clearReplayTimeout();

    // Update question status based on existing responses
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

    startReplayTimeout();

    // Clean up modified questions tracking
    setModifiedQuestions(prev => {
      const updated = new Set(prev);
      Array.from(prev).forEach(idx => {
        if (idx !== currentQuestionIndex) {
          updated.delete(idx);
        }
      });
      return updated;
    });

    // Delay TTS for non-first questions to ensure content is loaded
    const shouldDelay = currentQuestionIndex > 0;
    if (shouldDelay) {
      setTimeout(() => {
        setIsTTSPlaying(true);
      }, config.handsFree.speech.replay.nonFirstQuestionDelay);
    } else {
      setIsTTSPlaying(true);
    }

    // Clean up Voice Activity Detection
    if (vadRef.current) {
      vadRef.current.destroy();
      vadRef.current = null;
    }
  }, [currentQuestionIndex, currentQuestion]);

  // Convert audio data to WAV format for transcription
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

  // Detect silent audio to avoid processing background noise
  const checkAudioSilence = (audio) => {
    const avgEnergy = audio.reduce((sum, sample) => sum + Math.abs(sample), 0) / audio.length;
    const isSilent = avgEnergy < config.handsFree.audio.minEnergy;
    console.log('Audio silence check:', { energy: avgEnergy, threshold: config.handsFree.audio.minEnergy, isSilent });
    return isSilent;
  };

  // Schedule periodic TTS replays when no user speech is detected
  const startReplayTimeout = () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Starting replay timeout check`);
    }
    
    // Skip replay for modified questions or in editing mode
    if (modifiedQuestions.has(currentQuestionIndex) || isModifying || isModifyingRef.current) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Skipping replay for modified question or in modification mode`);
      }
      return;
    }
    
    clearReplayTimeout();

    // Play TTS if no speech and sufficient quiet time has passed
    if (segmentsRef.current.length === 0 && !isSpeechActive && !isProcessing) {
      const timeSinceLastSpeech = Date.now() - lastSpeechDetectionTimeRef.current;
      const minimumQuietPeriod = config.handsFree.speech.replay.minimumQuietPeriod;
      
      if (lastSpeechDetectionTimeRef.current === 0 || timeSinceLastSpeech >= minimumQuietPeriod) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('No speech detected, replaying question TTS...');
        }
        
        setIsTTSPlaying(true);
        replayAttemptsRef.current += 1;
      }
    }
    
    // Schedule next replay check
    replayTimeoutRef.current = setTimeout(() => {
      startReplayTimeout();
    }, config.handsFree.speech.replay.minimumQuietPeriod);
  };

  // Detect voice commands in transcribed speech
  const checkForCommands = (transcription) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Checking for commands in: ${transcription}`);
    }

    // Check for continue command when paused (highest priority)
    if (isPaused || isPausedRef.current) {
      const continuePhrases = config.handsFree.commands.continue.phrases;
      const isContinueCommand = continuePhrases.some(phrase => 
        transcription.toLowerCase().includes(phrase.toLowerCase())
      );
      
      if (isContinueCommand) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('CONTINUE command detected');
        }
        return {
          isCommand: true,
          type: 'continue',
          response: config.handsFree.commands.continue.response
        };
      }
      
      // if paused and not a continue command, wedontt process other commands
      return { isCommand: false };
    }

    // Check for pause command
    const pausePhrases = config.handsFree.commands.pause.phrases;
    const isPauseCommand = pausePhrases.some(phrase => 
      transcription.toLowerCase().includes(phrase.toLowerCase())
    );
    
    if (isPauseCommand) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('PAUSE command detected');
      }
      return {
        isCommand: true,
        type: 'pause',
        response: config.handsFree.commands.pause.response
      };
    }

    // Priority-ordered command detection for other commands
    
    // 1. Modify command (highest priority)
    if (config.handsFree.commands.modify) {
      const modifyPhrases = config.handsFree.commands.modify.phrases;
      const isModifyCommand = modifyPhrases.some(phrase => 
        transcription.toLowerCase().includes(phrase.toLowerCase())
      );
      
      if (isModifyCommand) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('MODIFY command detected');
        }
        return {
          isCommand: true,
          type: 'modify',
          response: config.handsFree.commands.modify.response
        };
      }
    }

    // 2. Check for specific "go to editor" commands when on last question
    if (currentQuestionIndex === currentQuestion.questions.length - 1 && 
        !hasChanges && cameFromEditor && onBackToEditor) {
      const editorPhrases = ['go to editor', 'back to editor', 'open editor', 'editor view'];
      const isEditorCommand = editorPhrases.some(phrase => 
        transcription.toLowerCase().includes(phrase.toLowerCase())
      );
      
      if (isEditorCommand) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('GO TO EDITOR command detected');
        }
        return {
          isCommand: true,
          type: 'toEditor',
          response: "Going to editor view"
        };
      }
    }

    // 3. Check for specific "return to home" commands when on first question
    if (currentQuestionIndex === 0) {
      const homeReturnPhrases = ['return to home', 'return to landing', 'back to home', 'home page', 'landing page'];
      const isHomeReturnCommand = homeReturnPhrases.some(phrase => 
        transcription.toLowerCase().includes(phrase.toLowerCase())
      );
      
      if (isHomeReturnCommand) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('RETURN TO HOME command detected');
        }
        return {
          isCommand: true,
          type: 'returnToHome',
          response: "Returning to home page"
        };
      }
    }

    // 4. Now check for general navigation commands

    // First check for "next" command
    const nextPhrases = ['next', 'next question', 'go next', 'continue'];
    const isNextCommand = nextPhrases.some(phrase => 
      transcription.toLowerCase().includes(phrase.toLowerCase())
    );
    
    if (isNextCommand) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('NEXT command detected');
      }
      return {
        isCommand: true,
        type: 'next',
        response: config.handsFree.commands.next?.response || "Moving to next question"
      };
    }

    // Check for "previous" command
    const prevPhrases = ['previous', 'go back', 'back', 'prev'];
    const isPrevCommand = prevPhrases.some(phrase => 
      transcription.toLowerCase().includes(phrase.toLowerCase())
    );
    
    if (isPrevCommand) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('PREVIOUS command detected');
      }
      return {
        isCommand: true,
        type: 'previous',
        response: config.handsFree.commands.previous?.response || "Moving to previous question"
      };
    }

    // 5. Check remaining commands from config
    for (const [commandType, commandConfig] of Object.entries(config.handsFree.commands)) {
      // Skip modify, next, and previous as we already checked them
      if (['modify', 'next', 'previous'].includes(commandType)) continue;
      
      const isCommand = commandConfig.phrases.some(phrase =>
        transcription.toLowerCase().includes(phrase.toLowerCase())
      );

      if (isCommand) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`${commandType} command detected`);
        }
        return {
          isCommand: true,
          type: commandType,
          response: commandConfig.response
        };
      }
    }

    return { isCommand: false };
  };

  // Handle detected voice commands
  const handleCommandExecution = async (commandCheck) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Executing command: ${commandCheck.type}`);
    }
    
    // Play feedback sound
    try {
      const commandSound = new Audio('/click.mp3');
      await commandSound.play();
    } catch (error) {
      console.warn('Command sound failed to play:', error);
    }
    
    clearReplayTimeout();
    replayAttemptsRef.current = 0;
    updateSpeechDetectionTime();
    
    switch (commandCheck.type) {
      case 'pause':
        setIsPaused(true);
        isPausedRef.current = true;
        displayFeedback(config.handsFree.ui.messages.paused, 'command');
        
        // Stop VAD/speech recognition
        if (vadRef.current) {
          await vadRef.current.destroy();
          vadRef.current = null;
        }
        
        // Keep a minimal recording active just to listen for the continue command
        setTimeout(() => {
          startPausedRecording();
        }, 500);
        break;
        
      case 'continue':
        setIsPaused(false);
        isPausedRef.current = false;
        displayFeedback("Resuming experiment...", 'command');
        
        // Restart normal recording
        if (vadRef.current) {
          await vadRef.current.destroy();
          vadRef.current = null;
        }
        
        setTimeout(() => {
          startRecording();
        }, 500);
        break;
        
      case 'skip':
        segmentsRef.current = [commandCheck.response];
        const merged = segmentsRef.current.join(' ');
        setMergedSpeech(merged);
        displayFeedback("Skipping this question...", 'command');
        finalizeAndSubmit();
        break;
        
      case 'modify':
        setIsModifying(true);
        isModifyingRef.current = true;
        segmentsRef.current = [];
        setMergedSpeech('');
        displayFeedback("Now modifying. Speak your new answer.", 'command');
        
        setModifiedQuestions(prev => {
          const updated = new Set(prev);
          updated.add(currentQuestionIndex);
          return updated;
        });
        
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        
        setTimeout(() => {
          startRecording();
        }, 500);
        break;
        
      case 'next':
        if (currentQuestionIndex < currentQuestion.questions.length - 1) {
          displayFeedback("Moving to next question...", 'command');
          setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
          if (currentQuestionIndex === currentQuestion.questions.length - 1 &&
             !hasChanges && cameFromEditor && onBackToEditor) {
            displayFeedback("Moving to editor view...", 'command');
            onBackToEditor();
          } else {
            displayFeedback("No more questions available yet", 'error');
            setShowFeedback(false);
            setTimeout(() => {
              displayFeedback("No more questions available yet", 'error');
            }, 50);
          }
        }
        break;
        
      case 'previous':
        if (currentQuestionIndex > 0) {
          displayFeedback("Moving to previous question...", 'command');
          setCurrentQuestionIndex(currentQuestionIndex - 1);
        } else {
          displayFeedback("This is the first question", 'error');
        }
        break;
        
      case 'toEditor':
        if (currentQuestionIndex === currentQuestion.questions.length - 1 &&
            !hasChanges && cameFromEditor && onBackToEditor) {
          displayFeedback("Moving to editor view...", 'command');
          onBackToEditor();
        } else {
          displayFeedback("Editor not available here", 'error');
        }
        break;
        
      case 'toQuestions':
        displayFeedback("Already in questions view", 'error');
        break;
        
      case 'toHome':
        displayFeedback("Returning to home page...", 'command');
        safeNavigate('/');
        break;
        
      default:
        console.warn(`Unknown command type: ${commandCheck.type}`);
        displayFeedback("Unknown command", 'error');
    }
  };

  // Process and submit the final answer
  const finalizeAndSubmit = async () => {
    const finalAnswer = segmentsRef.current.join(' ');
    if (process.env.NODE_ENV !== 'production') {
      console.log('Final merged answer after silence:', finalAnswer);
      console.log('Current modifying state during finalization:', isModifying);
    }

    clearReplayTimeout();
    replayAttemptsRef.current = 0;
    updateSpeechDetectionTime();

    setIsPreviewMode(true);
    displayFeedback("Saving your answer...", 'success');

    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      if (isModifying || isModifyingRef.current) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('Submitting MODIFIED answer');
        }
        await handleModifySubmit(finalAnswer);
      } else if (currentQuestionIndex === 0) {
        // Special handling for the first question
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

        // Reset state and move to the next question
        segmentsRef.current = [];
        setMergedSpeech('');
        setIsSpeechActive(false);
        setIsRecording(false);
        if (setInput) setInput('');

        playClickSound();
        setCurrentQuestionIndex(1);
      } else if (!questionStatus[currentQuestionIndex]?.answer) {
        await handleSubmitAnswer(finalAnswer);

        segmentsRef.current = [];
        setMergedSpeech('');
        setIsSpeechActive(false);
        setIsRecording(false);
        if (setInput) setInput('');
      }
    } catch (error) {
      console.error('Error submitting final speech:', error);
      startReplayTimeout();
    } finally {
      setIsModifying(false);
      isModifyingRef.current = false;
      setIsPreviewMode(false);
    }
  };

  // Submit the user's answer and handle automatic navigation
  const handleSubmitAnswer = async (text) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Submitting answer for question ${currentQuestionIndex}: "${text.substring(0, 30)}..."`);
    }
    
    clearReplayTimeout();
    replayAttemptsRef.current = 0;
    updateSpeechDetectionTime();
    
    setIsProcessing(true);
    try {
      const updatedQuestions = [...currentQuestion.questions];
      updatedQuestions[currentQuestionIndex] = {
        ...updatedQuestions[currentQuestionIndex],
        response: text
      };

      // Clear subsequent question responses
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

      // Update local state immediately
      setQuestionStatus({
        ...questionStatus,
        [currentQuestionIndex]: { type: 'answered', answer: text }
      });

      const newLength = await sendMessage(currentQuestionIndex, updatedConversationPlanning);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Backend returned new question count: ${newLength}`);
      }

      if (setInput) {
        setInput('');
      }

      // Auto-advance to next question if conditions met
      if (!isModifying && newLength && currentQuestionIndex < newLength - 1) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`Auto-advancing to next question (index ${currentQuestionIndex + 1})`);
        }
        
        displayFeedback("Answer saved. Moving to next question.", 'success');
        
        try {
          const navigationSound = new Audio('/click.mp3');
          
          navigationSound.addEventListener('ended', () => {
            setTimeout(() => {
              setCurrentQuestionIndex(currentQuestionIndex + 1);
            }, 50);
          });
          
          navigationSound.addEventListener('error', () => {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
          });
          
          navigationSound.play().catch(() => {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
          });
        } catch (error) {
          setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
      } else if (process.env.NODE_ENV !== 'production') {
        console.log('Auto-advance conditions not met:');
        console.log(`- Is modifying: ${isModifying}`);
        console.log(`- Backend returned newLength: ${!!newLength}`);
        console.log(`- Current index < new length - 1: ${currentQuestionIndex < (newLength ? newLength - 1 : 0)}`);
      }
    } catch (error) {
      console.error(`Error submitting answer: ${error}`);
      setQuestionStatus({
        ...questionStatus,
        [currentQuestionIndex]: { type: 'answering', answer: text }
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle modification of previously submitted answers
  const handleModifySubmit = async (text) => {
    clearReplayTimeout();
    replayAttemptsRef.current = 0;
    updateSpeechDetectionTime();
    
    setIsProcessing(true);
    try {
      const updatedQuestions = [...currentQuestion.questions];
      
      updatedQuestions[currentQuestionIndex] = {
        ...updatedQuestions[currentQuestionIndex],
        response: text
      };

      for (let i = currentQuestionIndex + 1; i < updatedQuestions.length; i++) {
        updatedQuestions[i] = {
          ...updatedQuestions[i],
          response: ''
        };
      }

      const updatedConversationPlanning = {
        ...currentQuestion,
        questions: updatedQuestions,
        followup_needed: true
      };

      console.log('Submitting modified answer for question index', currentQuestionIndex);
      console.log('Updated conversation planning:', updatedConversationPlanning);

      const newLength = await submitAnswer(
        updatedQuestions[currentQuestionIndex].id,
        text,
        currentQuestionIndex,
        updatedConversationPlanning
      );

      const newQuestionStatus = { ...questionStatus };
      newQuestionStatus[currentQuestionIndex] = { type: 'answered', answer: text };

      for (let i = currentQuestionIndex + 1; i < updatedQuestions.length; i++) {
        delete newQuestionStatus[i];
      }

      setQuestionStatus(newQuestionStatus);
      displayFeedback("Answer updated successfully and saved to conversation.", 'success');
      
      if (newLength === null) {
        // LLM decided to end conversation
        displayFeedback("Moving to editor view...", 'success');
        
        currentQuestion.questions = currentQuestion.questions.slice(0, currentQuestionIndex + 1);
        currentQuestion.followup_needed = false;
        
        setTimeout(() => {
          playClickSound();
          onBackToEditor();
        }, 1500);
      }
      else if (newLength && newLength > currentQuestionIndex + 1) {
        setTimeout(() => {
          setModifiedQuestions(prev => {
            const updated = new Set(prev);
            updated.delete(currentQuestionIndex);
            return updated;
          });
          
          playClickSound();
          setCurrentQuestionIndex(newLength - 1);
        }, 1500);
      }

    } catch (error) {
      console.error('Error submitting modified answer:', error);
      displayFeedback("Failed to update. Please try again.", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // A simplified recording mode that only listens for the continue command (pop-up overlay)
  const startPausedRecording = async () => {
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
          if (process.env.NODE_ENV !== 'production') {
            console.log('Speech segment started in paused mode...');
          }
          setIsSpeechActive(true);
          
          // Cancel TTS when user starts speaking
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
          setIsTTSPlaying(false);
          
          updateSpeechDetectionTime();
        },
        onSpeechEnd: async (audio) => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('Speech segment ended in paused mode...');
          }
          setIsSpeechActive(false);
          
          // Only process if we're still in paused mode
          if (!isPaused && !isPausedRef.current) return;
          
          // Check if audio is silent or too short
          if (checkAudioSilence(audio)) {
            if (process.env.NODE_ENV !== 'production') {
              console.log('Audio segment was silent or too short, ignoring');
            }
            return;
          }
          
          // Convert audio to WAV format
          const wavBuffer = float32ArrayToWav(audio);
          const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
          
          // Create form data for API request
          const formData = new FormData();
          formData.append('audio', wavBlob, 'speech.wav');
          
          try {
            // Send audio for transcription
            const response = await axios.post(
              `${config.core.apiUrl}${config.core.endpoints.transcribe}`,
              formData,
              { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            
            if (response.data.text) {
              let transcription = response.data.text.trim().toLowerCase();
              transcription = transcription.replace(/[.,\/#!$%^&*;:{}=\-_`~()]/g, '');
              
              if (process.env.NODE_ENV !== 'production') {
                console.log(`Paused mode transcription: "${transcription}"`);
              }
              
              // Check specifically for continue command
              const commandCheck = checkForCommands(transcription);
              if (commandCheck.isCommand) {
                await handleCommandExecution(commandCheck);
              }
            }
          } catch (error) {
            console.error('Error transcribing audio in paused mode:', error);
          }
        }
      });
      
      await vadRef.current.start();
      
    } catch (error) {
      console.error('Error starting paused recording:', error);
      displayFeedback("Error starting recording. Please try again.", 'error');
    }
  };

  // Initialize voice activity detection and speech processing
  const startRecording = async () => {
    // Don't start normal recording if we're in paused mode
    if (isPaused || isPausedRef.current) {
      startPausedRecording();
      return;
    }
    
    try {
      if (vadRef.current) {
        await vadRef.current.destroy();
        vadRef.current = null;
      }

      if (!isModifying || segmentsRef.current.length === 0) {
        setIsSpeechActive(false);
        setIsRecording(false);
        segmentsRef.current = [];
        setMergedSpeech('');
      }

      clearFinalizeTimeout();

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
          if (process.env.NODE_ENV !== 'production') {
            console.log('Speech segment started...');
          }
          setIsSpeechActive(true);
          setIsRecording(true);
          clearFinalizeTimeout();
          
          // Cancel TTS when user starts speaking
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
          setIsTTSPlaying(false);
          
          clearReplayTimeout();
          replayAttemptsRef.current = 0;
          updateSpeechDetectionTime();
        },
        // Speech end handler with transcription
        onSpeechEnd: async (audio) => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('Speech segment ended, transcribing...');
          }
          setIsSpeechActive(false);
          setIsRecording(false);
          setIsProcessing(true);

          if (checkAudioSilence(audio)) {
            if (process.env.NODE_ENV !== 'production') {
              console.log('Silent segment detected – ignoring and waiting for new input');
            }
            setIsProcessing(false);
            if (!isModifying && !isModifyingRef.current) {
              startReplayTimeout();
            }
            return;
          }

          try {
            const formData = new FormData();
            const wavBlob = float32ArrayToWav(audio);
            formData.append('audio', wavBlob, 'recording.wav');
            const response = await axios.post(
              `${config.core.apiUrl}${config.core.endpoints.transcribe}`,
              formData,
              { headers: { 'Content-Type': 'multipart/form-data' } }
            );

            if (response.data.text) {
              let transcription = response.data.text.trim().toLowerCase();
              transcription = transcription.replace(/[.,\/#!$%^&*;:{}=\-_`~()]/g, '');
              
              if (process.env.NODE_ENV !== 'production') {
                console.log(`Segment transcription: "${transcription}"`);
              }

              replayAttemptsRef.current = 0;

              // SPECIAL CASE: Direct modify command detection for questions with existing answers
              if (questionStatus[currentQuestionIndex]?.answer && !isModifying && !isModifyingRef.current) {
                if (transcription.toLowerCase().includes("modify")) {
                  if (process.env.NODE_ENV !== 'production') {
                    console.log("MODIFY command directly detected");
                  }
                  setIsModifying(true);
                  isModifyingRef.current = true; // Immediate update
                  segmentsRef.current = [];
                  setMergedSpeech('');
                  displayFeedback("Now modifying. Speak your new answer.", 'command');
                  
                  // Mark this question as modified to prevent TTS replay
                  setModifiedQuestions(prev => {
                    const updated = new Set(prev);
                    updated.add(currentQuestionIndex);
                    return updated;
                  });
                  
                  // Stop any ongoing TTS playback
                  if (window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                  }
                  
                  setTimeout(() => {
                    startRecording();
                  }, 500);
                  
                  setIsProcessing(false);
                  return;
                }
              }

              // CASE 1: We're in modify mode - collect speech for the modified answer
              if (isModifying || isModifyingRef.current) {
                if (process.env.NODE_ENV !== 'production') {
                  console.log("Processing speech in modify mode");
                }
                // Regular transcription handling for modifying
                segmentsRef.current.push(transcription);
                const merged = segmentsRef.current.join(' ');
                setMergedSpeech(merged);
                
                displayFeedback(`"${transcription}"`, 'transcription');
                
                clearFinalizeTimeout();
                
                finalizeTimeoutRef.current = setTimeout(async () => {
                  await finalizeAndSubmit();
                }, config.handsFree.speech.finalizeDelay);
                
                setIsProcessing(false);
                return;
              }

              // CASE 2: Question already has an answer but we're not in modify mode - only accept commands
              if (questionStatus[currentQuestionIndex]?.answer) {
                const commandCheck = checkForCommands(transcription);
                if (commandCheck.isCommand) {
                  await handleCommandExecution(commandCheck);
                } else {
                  displayFeedback("Say 'modify' to change your answer, or use navigation commands.", 'command');
                }
                setIsProcessing(false);
                return;
              }

              // CASE 3: New question with no answer yet - check for commands first then speech
              const commandCheck = checkForCommands(transcription);
              if (commandCheck.isCommand) {
                await handleCommandExecution(commandCheck);
                setIsProcessing(false);
                return;
              }

              // CASE 4: Regular speech for a new answer - collect and prepare to submit
              segmentsRef.current.push(transcription);
              const merged = segmentsRef.current.join(' ');
              setMergedSpeech(merged);

              // Display the recognized speech in the floating feedback
              displayFeedback(`"${transcription}"`, 'transcription');

              clearFinalizeTimeout();

              // Set up timeout to finalize the answer
              finalizeTimeoutRef.current = setTimeout(async () => {
                await finalizeAndSubmit();
              }, config.handsFree.speech.finalizeDelay);
            }
          } catch (err) {
            console.error('Transcription error:', err);
            if (!isModifying && !isModifyingRef.current) {
              startReplayTimeout();
            }
          } finally {
            setIsProcessing(false);
          }
        },
        onVADMisfire: () => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('VAD misfire – restarting recording...');
          }
          setIsSpeechActive(false);
          setIsRecording(false);
          startRecording();
        }
      });
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('Starting VAD...');
      }
      await vadRef.current.start();
    } catch (err) {
      console.error('Error starting VAD:', err);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('HandsFreeInterface unmounting, cleaning up resources');
      }
      
      clearFinalizeTimeout();
      clearReplayTimeout();
      
      if (vadRef.current) {
        vadRef.current.destroy().catch(err => {
          console.error('Error destroying VAD on unmount:', err);
        });
        vadRef.current = null;
      }
      
      // Reset pause state
      setIsPaused(false);
      isPausedRef.current = false;
      
      // Cancel any ongoing TTS
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Component updated with new props/state');
    }
  }, [currentQuestionIndex, currentQuestion, questionStatus]);

  // Navigation button handlers
  const handlePrevClick = () => {
    if (currentQuestionIndex > 0) {
      playClickSound();
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (currentQuestionIndex === 0) {
      playClickSound();
      safeNavigate('/');
    }
  };

  // Start VAD detection when TTS starts playing
  useEffect(() => {
    if (isTTSPlaying) {
      startRecording();
    }
  }, [isTTSPlaying]);

  const handleNextClick = () => {
    if (currentQuestionIndex < currentQuestion.questions.length - 1) {
      playClickSound();
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentQuestionIndex === currentQuestion.questions.length - 1 &&
               !hasChanges && cameFromEditor && onBackToEditor) {
      playClickSound();
      onBackToEditor();
    } else {
      displayFeedback("No more questions available yet", 'error');
    }
  };

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
      {/* pause overlay - only visible when paused */}
      {isPaused && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.3s ease-in-out',
            '@keyframes fadeIn': {
              from: { opacity: 0 },
              to: { opacity: 1 }
            }
          }}
        >
          <Box
            sx={{
              backgroundColor: 'white',
              borderRadius: 2,
              p: 4,
              maxWidth: '80%',
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              animation: 'slideIn 0.3s ease-out',
              '@keyframes slideIn': {
                from: { transform: 'translateY(-20px)', opacity: 0 },
                to: { transform: 'translateY(0)', opacity: 1 }
              }
            }}
          >
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
              Experiment Paused
            </Typography>
            
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                mb: 3,
                animation: 'pulse 1.5s infinite ease-in-out',
                '@keyframes pulse': {
                  '0%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.1)' },
                  '100%': { transform: 'scale(1)' }
                }
              }}
            >
              <MicIcon sx={{ fontSize: 60, color: '#1976d2' }} />
            </Box>
            
            <Typography variant="body1" sx={{ mb: 3 }}>
              Say <strong>"continue"</strong> or <strong>"resume"</strong> to continue the experiment.
            </Typography>
            
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
                borderRadius: 1,
                backgroundColor: 'rgba(25, 118, 210, 0.1)',
                animation: isSpeechActive ? 'listening 1.5s infinite ease-in-out' : 'none',
                '@keyframes listening': {
                  '0%': { backgroundColor: 'rgba(25, 118, 210, 0.1)' },
                  '50%': { backgroundColor: 'rgba(25, 118, 210, 0.3)' },
                  '100%': { backgroundColor: 'rgba(25, 118, 210, 0.1)' }
                }
              }}
            >
              <Typography variant="body2" sx={{ color: isSpeechActive ? '#1976d2' : 'text.secondary' }}>
                {isSpeechActive ? 'Listening...' : 'Waiting for voice command...'}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Navigation controls */}
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
          onClick={handlePrevClick}
          disabled={currentQuestionIndex === 0}
          sx={getNavButtonStyles(currentQuestionIndex === 0)}
        >
          <ArrowBackIcon />
        </IconButton>
      </Box>
      <Box sx={getNavStyles(false)}>
        <IconButton
          onClick={handleNextClick}
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
        {/* Current question display */}
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
                }}
                autoPlay={isTTSPlaying}
                showAnimation={isTTSPlaying}
                disabled={isProcessing}
              />
            )}
          </Box>
        </Box>

        {/* Answer display area */}
        <Paper
          elevation={isModifying ? 4 : 1}
          sx={{
            mt: 4,
            p: 2,
            position: 'relative',
            backgroundColor: isModifying ? '#fff' : 'rgba(0, 0, 0, 0.04)',
            transition: 'all 0.3s ease',
            animation: isPreviewMode
              ? `${previewPulseAnimation} 1s ease-in-out`
              : isModifying
                ? `${pulseAnimation} 2s infinite`
                : 'none',
            border: isPreviewMode
              ? '2px solid #1976d2'
              : isModifying
                ? '2px solid #1976d2'
                : '1px solid rgba(0, 0, 0, 0.12)',
            minHeight: '100px',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            maxWidth: '800px',
            margin: '0 auto',
          }}
        >
          {/* Editing mode indicator */}
          {isModifying && (
            <Box
              sx={{
                position: 'absolute',
                top: -12,
                left: 20,
                backgroundColor: '#1976d2',
                color: 'white',
                px: 2,
                py: 0.5,
                borderRadius: 1,
                fontSize: '0.75rem',
                animation: `${fadeInAnimation} 0.3s ease-out`,
                zIndex: 1,
              }}
            >
              Modifying
            </Box>
          )}

          {/* Current or existing answer */}
          <Typography
            variant="body1"
            sx={{
              p: 2,
              color: (isModifying || isPreviewMode) ? 'text.primary' : 'text.secondary',
              transition: 'all 0.3s ease',
              fontSize: { xs: '0.9rem', sm: '1rem' },
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              backgroundColor: isPreviewMode ? 'rgba(25, 118, 210, 0.08)' :
                isModifying && questionStatus[currentQuestionIndex]?.answer ? 'rgba(0, 0, 0, 0.03)' : 'transparent',
              borderRadius: 1,
              textDecoration: isModifying && questionStatus[currentQuestionIndex]?.answer ? 'line-through' : 'none',
              opacity: isModifying && questionStatus[currentQuestionIndex]?.answer ? 0.7 : 1,
            }}
          >
            {isPreviewMode
              ? mergedSpeech
              : questionStatus[currentQuestionIndex]?.answer || 'Waiting for your answer...'}
          </Typography>

          {/* Mic status indicator */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              padding: '4px 8px',
              borderRadius: 8,
              backgroundColor: isPaused ? 'rgba(211, 47, 47, 0.1)' : 
                                isSpeechActive ? 'rgba(46, 125, 50, 0.1)' : 
                                'rgba(0, 0, 0, 0.05)',
              transition: 'all 0.3s ease',
            }}
          >
            <MicIcon 
              sx={{ 
                fontSize: 18, 
                color: isPaused ? '#d32f2f' : 
                       isSpeechActive ? '#2e7d32' : 
                       'rgba(0, 0, 0, 0.4)',
                animation: isSpeechActive && !isPaused ? 'pulse 1.5s infinite ease-in-out' : 'none',
              }} 
            />
            <Typography 
              variant="caption" 
              sx={{ 
                color: isPaused ? '#d32f2f' : 
                       isSpeechActive ? '#2e7d32' : 
                       'rgba(0, 0, 0, 0.6)',
                fontWeight: 500,
              }}
            >
              {isPaused ? 'Paused' : 
               isSpeechActive ? 'Listening' : 
               'Ready'}
            </Typography>
          </Box>

          {/* New answer preview when editing */}
          {isModifying && mergedSpeech && questionStatus[currentQuestionIndex]?.answer && (
            <Typography
              variant="body1"
              sx={{
                p: 2,
                color: 'text.primary',
                transition: 'all 0.3s ease',
                fontSize: { xs: '0.9rem', sm: '1rem' },
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                backgroundColor: 'rgba(46, 125, 50, 0.05)',
                borderRadius: 1,
                borderLeft: '3px solid #2e7d32',
                animation: `${slideInFromRightAnimation} 0.3s ease-out`,
                mt: 1,
              }}
            >
              {mergedSpeech}
            </Typography>
          )}

          {/* Edit status message */}
          {isModifying && mergedSpeech && (
            <Typography
              variant="body2"
              sx={{
                mt: 2,
                p: 1,
                backgroundColor: 'rgba(25, 118, 210, 0.08)',
                borderRadius: 1,
                animation: `${replaceAnimation} 1.5s ease-in-out, ${fadeInAnimation} 0.3s ease-out`,
                border: '1px solid rgba(25, 118, 210, 0.2)',
                fontWeight: 500,
              }}
            >
              <Box component="span" sx={{ opacity: 0.7 }}>Replacing with: </Box>
              <Box component="span" sx={{ fontWeight: 'bold' }}>{mergedSpeech}</Box>
            </Typography>
          )}

          {/* Edit icon */}
          {questionStatus[currentQuestionIndex]?.answer && !isModifying && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                opacity: 0.6,
              }}
            >
              <EditIcon fontSize="small" />
            </Box>
          )}
        </Paper>

        {/* Audio visualizer and status */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <AudioVisualizer isSpeechDetected={isSpeechActive} />
          <Typography sx={{ mb: 2 }}>
            {isProcessing
              ? 'Processing...'
              : isRecording
                ? 'Recording...'
                : 'Waiting for speech...'}
          </Typography>
        </Box>
      </Box>

      {/* Floating feedback display */}
      <RecognitionFeedback
        text={recognitionFeedback}
        isVisible={showFeedback}
        type={feedbackType}
      />
    </Box>
  );
}

// Visual feedback component for speech recognition and commands
const RecognitionFeedback = ({ text, isVisible, type = 'default' }) => {
  // Select background color based on feedback type
  const getBackgroundColor = () => {
    switch (type) {
      case 'transcription':
        return 'rgba(240, 240, 240, 0.95)';
      case 'command':
        return 'rgba(25, 118, 210, 0.1)';
      case 'success':
        return 'rgba(46, 125, 50, 0.1)';
      case 'error':
        return 'rgba(211, 47, 47, 0.1)';
      default:
        return 'rgba(255, 255, 255, 0.95)';
    }
  };

  // Select appropriate icon for feedback type
  const getIcon = () => {
    switch (type) {
      case 'transcription':
        return <span style={{ marginRight: '8px', opacity: 0.7 }}>🎤</span>;
      case 'command':
        return <span style={{ marginRight: '8px', opacity: 0.7 }}>⚡</span>;
      case 'success':
        return <span style={{ marginRight: '8px', opacity: 0.7 }}>✓</span>;
      case 'error':
        return <span style={{ marginRight: '8px', opacity: 0.7 }}>⚠️</span>;
      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        opacity: isVisible ? 1 : 0,
        visibility: isVisible ? 'visible' : 'hidden',
        transition: 'opacity 0.3s ease, visibility 0.3s ease',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          px: 3,
          py: 2,
          backgroundColor: getBackgroundColor(),
          backdropFilter: 'blur(8px)',
          borderRadius: 2,
          animation: `${floatInAnimation} 0.3s ease-out`,
          maxWidth: '90vw',
          margin: '0 auto',
          borderLeft: type === 'transcription' ? '3px solid rgba(0, 0, 0, 0.12)' :
            type === 'command' ? '3px solid #1976d2' :
              type === 'success' ? '3px solid #2e7d32' :
                type === 'error' ? '3px solid #d32f2f' : 'none',
        }}
      >
        <Typography
          variant="body1"
          sx={{
            color: 'text.primary',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {getIcon()}
          {text}
        </Typography>
      </Paper>
    </Box>
  );
};

export default HandsFreeInterface;