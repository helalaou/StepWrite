import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, IconButton, Paper } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EditIcon from '@mui/icons-material/Edit';
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

  // Process indicators
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [isSpeechActive, setIsSpeechActive] = useState(false);

  // New state for editing mode
  const [isModifying, setIsModifying] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [recognitionFeedback, setRecognitionFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState('default');

  // Recognized segments (preserved in recorded order)
  const segmentsRef = useRef([]);
  const [mergedSpeech, setMergedSpeech] = useState('');

  // Refs for VAD and timeouts
  const vadRef = useRef(null);
  const replayTimeoutRef = useRef(null);
  const finalizeTimeoutRef = useRef(null);

  // Add a counter for replay attempts
  const replayAttemptsRef = useRef(0);

  // Add ref to track modification mode in real-time
  const isModifyingRef = useRef(false);

  // Add a state to track which questions have been modified
  const [modifiedQuestions, setModifiedQuestions] = useState(new Set());

  // Create a wrapped version of the setCurrentQuestionIndex function to add debugging
  const setCurrentQuestionIndexWithDebug = (newIndex) => {
    // Only log in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Navigation: Changing question index from ${currentQuestionIndex} to ${newIndex}`);
    }
    parentSetCurrentQuestionIndex(newIndex);
  };
  
  // Replace all uses of setCurrentQuestionIndex with the debug version
  const setCurrentQuestionIndex = setCurrentQuestionIndexWithDebug;
  
  // Add debug logging to track changes to currentQuestionIndex
  useEffect(() => {
    // Keep minimal effect logging
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Navigation: Question index updated to ${currentQuestionIndex}`);
    }
  }, [currentQuestionIndex]);
  
  // Debug navigate function
  const safeNavigate = useCallback((route) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Navigation: Navigating to ${route}`);
    }
    playClickSound();
    navigate(route);
  }, [navigate]);

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

  // Show feedback briefly with type
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

  // Update the useEffect that handles question changes
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Question changed to index: ${currentQuestionIndex}`);
    }
    if (!currentQuestion?.questions) return;

    // Reset all voice-related state when question changes
    segmentsRef.current = [];
    setMergedSpeech('');
    setIsSpeechActive(false);
    setIsRecording(false);
    setIsProcessing(false);
    setIsModifying(false); // Reset editing mode
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

    // Force TTS to play for new question
    setIsTTSPlaying(true);

    // Stop any existing VAD
    if (vadRef.current) {
      vadRef.current.destroy();
      vadRef.current = null;
    }

    // Reset modified state for the previous question when navigating away
    setModifiedQuestions(prev => {
      const updated = new Set(prev);
      // Only keep the current question in the set if it's already there
      Array.from(prev).forEach(idx => {
        if (idx !== currentQuestionIndex) {
          updated.delete(idx);
        }
      });
      return updated;
    });
  }, [currentQuestionIndex, currentQuestion]);

  // Convert float32Array audio to WAV Blob.
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
    const isSilent = avgEnergy < config.handsFree.audio.minEnergy;
    console.log('Audio silence check:', { energy: avgEnergy, threshold: config.handsFree.audio.minEnergy, isSilent });
    return isSilent;
  };

  // Update the startReplayTimeout function
  const startReplayTimeout = (attempt = 0) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Starting replay timeout, attempt: ${attempt}`);
    }
    
    // Don't start replay if this question has been modified
    if (modifiedQuestions.has(currentQuestionIndex)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Skipping replay for modified question: ${currentQuestionIndex}`);
      }
      return;
    }
    
    clearReplayTimeout();

    // Only start replay if we have no speech segments
    if (segmentsRef.current.length === 0) {
      replayTimeoutRef.current = setTimeout(() => {
        if (!isSpeechActive && !isProcessing) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('No valid speech, replaying question TTS...');
          }
          setIsTTSPlaying(true);
          replayAttemptsRef.current += 1;
          // Start next replay timeout after this one
          startReplayTimeout();
        }
      }, config.handsFree.speech.replay.interval);
    }
  };

  // Update the checkForCommands function to handle both general and specific commands
  const checkForCommands = (transcription) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Checking for commands in: ${transcription}`);
    }

    // First check for context-specific commands that take precedence

    // 1. Direct check for modify command first (highest priority)
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

  // Improve the handleCommandExecution function with better error handling
  const handleCommandExecution = async (commandCheck) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Executing command: ${commandCheck.type}`);
    }
    
    // Play sound first for all commands
    try {
      const commandSound = new Audio('/click.mp3');
      await commandSound.play();
    } catch (error) {
      // Continue even if sound fails
      console.warn('Command sound failed to play:', error);
    }
    
    // Execute the command based on type with availability checks
    switch (commandCheck.type) {
      case 'skip':
        // Skip is always available
        segmentsRef.current = [commandCheck.response];
        const merged = segmentsRef.current.join(' ');
        setMergedSpeech(merged);
        displayFeedback("Skipping this question...", 'command');
        finalizeAndSubmit();
        break;
        
      case 'modify':
        // Modify is available when we have an answer to modify or a new answer to create
        setIsModifying(true);
        isModifyingRef.current = true;
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
        break;
        
      case 'next':
        // Check if next button is available (not on last question)
        if (currentQuestionIndex < currentQuestion.questions.length - 1) {
          displayFeedback("Moving to next question...", 'command');
          setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
          // If at last question, check if we can go to editor
          if (currentQuestionIndex === currentQuestion.questions.length - 1 &&
             !hasChanges && cameFromEditor && onBackToEditor) {
            displayFeedback("Moving to editor view...", 'command');
            onBackToEditor();
          } else {
            // Not available
            displayFeedback("No more questions available yet", 'error');
            // Force feedback to show
            setShowFeedback(false);
            setTimeout(() => {
              displayFeedback("No more questions available yet", 'error');
            }, 50);
          }
        }
        break;
        
      case 'previous':
        // Check if previous button is available (not on first question)
        if (currentQuestionIndex > 0) {
          displayFeedback("Moving to previous question...", 'command');
          setCurrentQuestionIndex(currentQuestionIndex - 1);
        } else {
          // Not available - give feedback
          displayFeedback("This is the first question", 'error');
        }
        break;
        
      case 'toEditor':
        // Check if editor button is available
        if (currentQuestionIndex === currentQuestion.questions.length - 1 &&
            !hasChanges && cameFromEditor && onBackToEditor) {
          displayFeedback("Moving to editor view...", 'command');
          onBackToEditor();
        } else {
          // Not available
          displayFeedback("Editor not available here", 'error');
        }
        break;
        
      case 'toQuestions':
        // This would be for going from editor back to questions
        // Not directly applicable in the current view
        displayFeedback("Already in questions view", 'error');
        break;
        
      case 'toHome':
        // Always allow going back to home
        displayFeedback("Returning to home page...", 'command');
        safeNavigate('/');
        break;
        
      default:
        console.warn(`Unknown command type: ${commandCheck.type}`);
        displayFeedback("Unknown command", 'error');
    }
  };

  // Add sound to finalizeAndSubmit without changing core logic
  const finalizeAndSubmit = async () => {
    const finalAnswer = segmentsRef.current.join(' ');
    if (process.env.NODE_ENV !== 'production') {
      console.log('Final merged answer after silence:', finalAnswer);
      console.log('Current modifying state during finalization:', isModifying);
    }

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

        // Clear state before moving to next question
        segmentsRef.current = [];
        setMergedSpeech('');
        setIsSpeechActive(false);
        setIsRecording(false);
        if (setInput) setInput('');

        // Play sound before moving to next question
        playClickSound();
        setCurrentQuestionIndex(1);
      } else if (!questionStatus[currentQuestionIndex]?.answer) {
        // If question is unanswered, submit and potentially move to next question
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
    } finally {
      setIsModifying(false);
      isModifyingRef.current = false;
      setIsPreviewMode(false);
    }
  };

  // Add sound to handleModifySubmit without changing core logic
  const handleModifySubmit = async (text) => {
    setIsProcessing(true);
    try {
      // Create a deep copy of the questions array
      const updatedQuestions = [...currentQuestion.questions];
      
      // Update the current question's response
      updatedQuestions[currentQuestionIndex] = {
        ...updatedQuestions[currentQuestionIndex],
        response: text
      };

      // Clear subsequent responses
      for (let i = currentQuestionIndex + 1; i < updatedQuestions.length; i++) {
        updatedQuestions[i] = {
          ...updatedQuestions[i],
          response: ''
        };
      }

      // Create the updated conversation planning object
      const updatedConversationPlanning = {
        ...currentQuestion,
        questions: updatedQuestions,
        followup_needed: true // Force the backend to regenerate subsequent questions
      };

      console.log('Submitting modified answer for question index', currentQuestionIndex);
      console.log('Updated conversation planning:', updatedConversationPlanning);

      // Send the updated conversation to the backend with the changedIndex parameter
      // This tells the backend which question was modified
      const newLength = await submitAnswer(
        updatedQuestions[currentQuestionIndex].id,
        text,
        currentQuestionIndex,  // Explicitly pass the changedIndex
        updatedConversationPlanning
      );

      // Update question status immediately
      const newQuestionStatus = { ...questionStatus };
      newQuestionStatus[currentQuestionIndex] = { type: 'answered', answer: text };

      // Clear subsequent question statuses
      for (let i = currentQuestionIndex + 1; i < updatedQuestions.length; i++) {
        delete newQuestionStatus[i];
      }

      setQuestionStatus(newQuestionStatus);
      displayFeedback("Answer updated successfully and saved to conversation.", 'success');
      
      // Check if the LLM decided to end the conversation
      if (newLength === null) {
        // LLM set followup_needed to false, move to editor
        displayFeedback("Moving to editor view...", 'success');
        
        // IMPORTANT: Update the currentQuestion object to remove questions after the modified one
        // This ensures the parent component's state is updated correctly
        currentQuestion.questions = currentQuestion.questions.slice(0, currentQuestionIndex + 1);
        currentQuestion.followup_needed = false;
        
        setTimeout(() => {
          // Play sound when moving to editor
          playClickSound();
          onBackToEditor();
        }, 1500); // Short delay to let the user see the success message
      }
      // Otherwise, if there are more questions, advance to the next one
      else if (newLength && newLength > currentQuestionIndex + 1) {
        setTimeout(() => {
          // Clear the modified state for the current question when moving to the next
          setModifiedQuestions(prev => {
            const updated = new Set(prev);
            updated.delete(currentQuestionIndex);
            return updated;
          });
          
          // Play sound when advancing to next question
          playClickSound();
          setCurrentQuestionIndex(newLength - 1);
        }, 1500); // Short delay to let the user see the success message
      }

    } catch (error) {
      console.error('Error submitting modified answer:', error);
      displayFeedback("Failed to update. Please try again.", 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Simplify handleSubmitAnswer - keep only essential logging
  const handleSubmitAnswer = async (text) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Submitting answer for question ${currentQuestionIndex}: "${text.substring(0, 30)}..."`);
    }
    
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

      // Update question status immediately
      setQuestionStatus({
        ...questionStatus,
        [currentQuestionIndex]: { type: 'answered', answer: text }
      });

      // Handle backend communication
      const newLength = await sendMessage(currentQuestionIndex, updatedConversationPlanning);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Backend returned new question count: ${newLength}`);
      }

      // Clear any input
      if (setInput) {
        setInput('');
      }

      // Auto-advance to next question - ONLY if:
      // 1. We're not editing
      // 2. The backend has returned a new length
      // 3. Our current index is less than the new total length - 1
      if (!isModifying && newLength && currentQuestionIndex < newLength - 1) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`Auto-advancing to next question (index ${currentQuestionIndex + 1})`);
        }
        
        // Display feedback
        displayFeedback("Answer saved. Moving to next question.", 'success');
        
        // Create a new Audio instance for this specific navigation
        try {
          const navigationSound = new Audio('/click.mp3');
          
          // When sound ends, then navigate
          navigationSound.addEventListener('ended', () => {
            // Set a very short timeout to ensure sound is fully complete
            setTimeout(() => {
              setCurrentQuestionIndex(currentQuestionIndex + 1);
            }, 50);
          });
          
          // Handle any errors
          navigationSound.addEventListener('error', () => {
            // If sound fails, still navigate
            setCurrentQuestionIndex(currentQuestionIndex + 1);
          });
          
          // Play the sound - navigation will happen in the 'ended' event
          navigationSound.play().catch(() => {
            // If sound fails to play, still navigate
            setCurrentQuestionIndex(currentQuestionIndex + 1);
          });
        } catch (error) {
          // If there's any error with the sound, still navigate
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

  // Start voice recording using VAD.
  const startRecording = async () => {
    try {
      if (vadRef.current) {
        await vadRef.current.destroy();
        vadRef.current = null;
      }

      // Only clear segments if not in editing mode or if this is a brand new recording
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
          clearReplayTimeout();
        },
        // Updated onSpeechEnd handler with fixed editing mode logic
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
            // Only start replay if not in editing mode
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

  useEffect(() => {
    return () => {
      if (vadRef.current) vadRef.current.destroy();
      clearFinalizeTimeout();
      clearReplayTimeout();
    };
  }, []);

  // Fix component mount effect to have proper dependencies
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Component updated with new props/state');
    }
  }, [currentQuestionIndex, currentQuestion, questionStatus]);

  // Update the button click handlers for consistency
  const handlePrevClick = () => {
    if (currentQuestionIndex > 0) {
      playClickSound();
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (currentQuestionIndex === 0) {
      // First question - go to home
      playClickSound();
      safeNavigate('/');
    }
  };

  const handleNextClick = () => {
    if (currentQuestionIndex < currentQuestion.questions.length - 1) {
      playClickSound();
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentQuestionIndex === currentQuestion.questions.length - 1 &&
               !hasChanges && cameFromEditor && onBackToEditor) {
      // Last question with editor available - go to editor
      playClickSound();
      onBackToEditor();
    } else {
      // Last question but editor not available
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

        {/* Answer Display Section */}
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
          {/* Status Badge */}
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

          {/* Answer Content */}
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

          {/* New Answer Preview During Editing */}
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

          {/* Recognition Status */}
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

          {/* Edit Icon */}
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

        {/* Visualizer and Status */}
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

      {/* Recognition Feedback component */}
      <RecognitionFeedback
        text={recognitionFeedback}
        isVisible={showFeedback}
        type={feedbackType}
      />
    </Box>
  );
}

// Enhanced feedback component with different styles based on feedback type
const RecognitionFeedback = ({ text, isVisible, type = 'default' }) => {
  // Different background colors based on feedback type
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

  // Get appropriate icon based on type
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