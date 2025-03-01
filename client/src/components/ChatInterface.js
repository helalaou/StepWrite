import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, CircularProgress, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';
import NavigationButton from './NavigationButton';
import VoiceInput from './VoiceInput';
import config from '../config';
import SpeakButton from './SpeakButton';
import ClearIcon from '@mui/icons-material/Clear';

function ChatInterface({
  currentQuestion,
  input,
  setInput,
  isLoading,
  sendMessage,
  submitAnswer,
  questionStatus,
  setQuestionStatus,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  hasChanges,
  onBackToEditor,
  cameFromEditor,
}) {
  const navigate = useNavigate();

  // Navigation control variables
  const navControls = {
    width: {
      percentage: {
        xs: '15%',     
        sm: '12%'     
      },
      min: {
        xs: '20px',    
        sm: '25px'     
      },
      max: {
        xs: '50px',    
        sm: '80px'    
      }
    },
    arrow: {
      size: {
        xs: '2rem', 
        sm: '2.8rem',  
        md: '3rem'  
      },
      scale: 1.1,  
    },
    hover: {
      intensity: 0.04,
      base: 0.02
    },
    shadow: {
      intensity: 2
    }
  };

  // Common styles for navigation areas
  const getNavStyles = (isLeft) => ({
    position: 'absolute',
    [isLeft ? 'left' : 'right']: 0,
    top: 0,
    bottom: 0,
    width: {
      xs: navControls.width.percentage.xs,
      sm: navControls.width.percentage.sm
    },
    minWidth: {
      xs: navControls.width.min.xs,
      sm: navControls.width.min.sm
    },
    maxWidth: {
      xs: navControls.width.max.xs,
      sm: navControls.width.max.sm
    },
    display: 'flex',
    alignItems: 'center',
    justifyContent: isLeft ? 'flex-start' : 'flex-end',
    zIndex: 2,
    backgroundColor: (
      isLeft ? currentQuestionIndex === 0 
             : currentQuestionIndex === currentQuestion.questions.length - 1
    ) 
      ? 'transparent' 
      : `rgba(255, 255, 255, ${navControls.hover.base})`,
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    backdropFilter: 'blur(8px)',
    '&:hover': {
      backgroundColor: (
        isLeft ? currentQuestionIndex === 0 
               : currentQuestionIndex === currentQuestion.questions.length - 1
      )
        ? 'transparent'
        : `rgba(255, 255, 255, ${navControls.hover.intensity})`,
    },
  });

  // cmmoon styles for navigation buttons
  const getNavButtonStyles = (isDisabled) => ({
    height: '100%',
    width: '100%',
    borderRadius: 0,
    '&.Mui-disabled': {
      opacity: 0,
      transform: 'scale(0.95)',
    },
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    '& .MuiSvgIcon-root': {
      fontSize: {
        xs: navControls.arrow.size.xs,
        sm: navControls.arrow.size.sm,
        md: navControls.arrow.size.md
      },
      transform: `scale(${navControls.arrow.scale})`,
      color: isDisabled ? 'action.disabled' : 'primary.main',
      transition: 'transform 0.2s ease',
    },
    '&:hover .MuiSvgIcon-root': {
      transform: `scale(${navControls.arrow.scale * 1.1})`,
    },
    '&:active .MuiSvgIcon-root': {
      transform: `scale(${navControls.arrow.scale * 0.95})`,
    }
  });

  // useEffect to rebuild questionStatus from scratch
  // whenever currentQuestion changes (or currentQuestionIndex changes).
   
  useEffect(() => {
    if (!currentQuestion?.questions) return;
    
    const questions = currentQuestion.questions;
    const newStatus = {};

    // Build statuses based on existing question responses
    questions.forEach((question, index) => {
      if (question.response && question.response.trim() !== '') {
        newStatus[index] = {
          type: question.response === "user has skipped this question" 
            ? 'skipped' 
            : 'answered',
          answer: question.response
        };
      }
    });

    setQuestionStatus(newStatus);

    // If the current question has a status, restore that to the input; else clear the input
    const statusForCurrent = newStatus[currentQuestionIndex];
    if (statusForCurrent && statusForCurrent.answer) {
      setInput(statusForCurrent.answer);
    } else {
      setInput('');
    }
  }, [currentQuestion, currentQuestionIndex, setQuestionStatus, setInput]);

  // Add state to track original answer when entering edit mode
  const [originalAnswer, setOriginalAnswer] = useState('');

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!input.trim()) {
      alert('Please enter an answer before saving.');
      return;
    }

    // Check if the answer actually changed
    const hasChanged = input !== originalAnswer;
    console.log('Submitting answer:', {
      questionIndex: currentQuestionIndex,
      originalAnswer,
      newAnswer: input,
      hasChanged
    });

    const updatedQuestions = [...currentQuestion.questions];
    updatedQuestions[currentQuestionIndex] = {
      ...updatedQuestions[currentQuestionIndex],
      response: input
    };

    const updatedConversationPlanning = {
      ...currentQuestion,
      questions: updatedQuestions
    };

    // Only send to backend if answer changed
    if (hasChanged) {
      sendMessage(currentQuestionIndex, updatedConversationPlanning)
        .then((newLength) => {
          if (newLength) {
            setQuestionStatus({
              ...questionStatus,
              [currentQuestionIndex]: { type: 'answered', answer: input }
            });
            setCurrentQuestionIndex(newLength - 1);
            setInput('');
            setOriginalAnswer('');
          }
        })
        .catch((error) => {
          console.error('Error submitting answer:', error);
          alert('Failed to submit answer. Please try again.');
          setQuestionStatus({
            ...questionStatus,
            [currentQuestionIndex]: { 
              type: 'answering',
              answer: input 
            }
          });
        });
    } else {
      // If no changes, we jkust update status and move to next question
      console.log('No changes detected, skipping backend call');
      setQuestionStatus({
        ...questionStatus,
        [currentQuestionIndex]: { type: 'answered', answer: input }
      });
      //mve to next question if available
      if (currentQuestionIndex < currentQuestion.questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        const nextAnswer = questionStatus[currentQuestionIndex + 1]?.answer || 
                         currentQuestion.questions[currentQuestionIndex + 1]?.response || 
                         '';
        setInput(nextAnswer);
      }
      setOriginalAnswer('');
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      // Reset editing state if user was editing
      if (questionStatus[currentQuestionIndex]?.type === 'answering') {
        setQuestionStatus({
          ...questionStatus,
          [currentQuestionIndex]: { 
            type: 'answered',
            answer: currentQuestion.questions[currentQuestionIndex].response 
          }
        });
      }

      const newIndex = currentQuestionIndex - 1;
      setCurrentQuestionIndex(newIndex);
      
      const prevAnswer = questionStatus[newIndex]?.answer || 
                        currentQuestion.questions[newIndex]?.response || 
                        '';
      setInput(prevAnswer);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < currentQuestion.questions.length - 1) {
      // Reset editing state if user was editing
      if (questionStatus[currentQuestionIndex]?.type === 'answering') {
        setQuestionStatus({
          ...questionStatus,
          [currentQuestionIndex]: { 
            type: 'answered',
            answer: currentQuestion.questions[currentQuestionIndex].response 
          }
        });
      }

      const newIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(newIndex);
      
      const nextAnswer = questionStatus[newIndex]?.answer || 
                        currentQuestion.questions[newIndex]?.response || 
                        '';
      setInput(nextAnswer);
    }
  };

  const handleAnswerClick = () => {
    const currentIndex = currentQuestionIndex;
    
    // If skipped, immediately switch to answering mode with empty input
    if (questionStatus[currentIndex]?.type === 'skipped') {
      console.log('Changing from skipped to answering mode');
      setInput('');
      setOriginalAnswer('');
      setQuestionStatus({
        ...questionStatus,
        [currentIndex]: { 
          type: 'answering',
          answer: '' 
        }
      });
      return;
    }

    // If already answered, switch to editing mode and store original answer
    if (questionStatus[currentIndex]?.type === 'answered') {
      const currentAnswer = questionStatus[currentIndex].answer;
      console.log('Entering edit mode with original answer:', currentAnswer);
      setOriginalAnswer(currentAnswer);
      setQuestionStatus({
        ...questionStatus,
        [currentIndex]: { 
          type: 'answering',
          answer: currentAnswer 
        }
      });
      return;
    }

    // For new or other cases
    setOriginalAnswer(input);
    setQuestionStatus({
      ...questionStatus,
      [currentIndex]: { 
        type: 'answering',
        answer: questionStatus[currentIndex]?.answer || input 
      }
    });
  };

  const handleSkip = () => {
    if (questionStatus[currentQuestionIndex]?.type !== 'skipped') {
      console.log('Skipping Question:', {
        questionIndex: currentQuestionIndex,
        previousStatus: questionStatus[currentQuestionIndex]?.type,
        newStatus: 'skipped'
      });

      const skipMessage = "user has skipped this question";
      
      const updatedQuestions = [...currentQuestion.questions];
      updatedQuestions[currentQuestionIndex] = {
        ...updatedQuestions[currentQuestionIndex],
        response: skipMessage
      };

      const updatedConversationPlanning = {
        ...currentQuestion,
        questions: updatedQuestions
      };
      
      setInput(skipMessage);
      
      // Remove statuses for any subsequent questions
      const updatedQuestionStatus = { ...questionStatus };
      Object.keys(updatedQuestionStatus).forEach((key) => {
        if (parseInt(key) > currentQuestionIndex) {
          delete updatedQuestionStatus[key];
        }
      });

      setQuestionStatus({
        ...updatedQuestionStatus,
        [currentQuestionIndex]: { type: 'skipped', answer: skipMessage }
      });

      submitAnswer(
        currentQuestion.questions[currentQuestionIndex].id, 
        skipMessage,
        currentQuestionIndex,
        updatedConversationPlanning,
        updatedQuestionStatus
      )
        .then((newLength) => {
          if (newLength) {
            setCurrentQuestionIndex(newLength - 1);
            setInput('');
          }
        })
        .catch((error) => {
          console.error('Error skipping question:', error);
          alert('Failed to skip question. Please try again.');
          setQuestionStatus({
            ...questionStatus,
            [currentQuestionIndex]: { 
              type: 'answering',
              answer: input 
            }
          });
        });
    }
  };

  const isAnswering = questionStatus[currentQuestionIndex]?.type === 'answering';
  const isAnswered = questionStatus[currentQuestionIndex]?.type === 'answered';
  const isSkipped = questionStatus[currentQuestionIndex]?.type === 'skipped';

  // Update the handleVoiceTranscriptionComplete function
  const handleVoiceTranscriptionComplete = (text) => {
    if (config.input.mode === 'HANDS_FREE') {
      setInput(text);
      // Auto-submit in hands-free mode
      setTimeout(() => {
        handleSubmit();
      }, 1000);
    } else {
      // In other modes, just append to input like typing
      setInput(prev => prev + (prev ? ' ' : '') + text);
    }
  };

  useEffect(() => {
    // Function to clean up audio files
    const cleanupAudio = async () => {
      try {
        await fetch(`${config.core.apiUrl}/api/tts/cleanup`, {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.error('Failed to cleanup audio files:', error);
      }
    };

    // Add window unload event listener
    window.addEventListener('beforeunload', cleanupAudio);
    
    // Cleanup on component unmount
    return () => {
      window.removeEventListener('beforeunload', cleanupAudio);
      cleanupAudio();
    };
  }, []);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Back to Home Button - Only show on first question */}
      {currentQuestionIndex === 0 && (
        <NavigationButton
          direction="left"
          onClick={() => navigate('/')}
          tooltip="Back to Home"
        />
      )}

      {/* Back to Editor button */}
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

      {/* Left/Right Navigation */}
      <Box sx={getNavStyles(true)}>
        <IconButton 
          onClick={handlePrevQuestion} 
          disabled={currentQuestionIndex === 0}
          sx={getNavButtonStyles(currentQuestionIndex === 0)}
        >
          <ArrowBackIcon />
        </IconButton>
      </Box>

      <Box sx={getNavStyles(false)}>
        <IconButton 
          onClick={handleNextQuestion} 
          disabled={currentQuestionIndex === currentQuestion.questions.length - 1}
          sx={getNavButtonStyles(currentQuestionIndex === currentQuestion.questions.length - 1)}
        >
          <ArrowForwardIcon />
        </IconButton>
      </Box>

      <Box sx={{ 
        width: '100%',
        maxWidth: '1700px',
        padding: { xs: '0 60px', sm: '0 15%' },
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 1,
      }}>
        <Box sx={{ 
          position: 'relative',
          width: '100%',
          mb: 4
        }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontSize: { xs: '24pt', sm: '32pt', md: '42pt' },
              textAlign: 'center',
              transition: 'all 0.3s ease',
              width: '100%',
              pr: { xs: '32px', sm: '48px' }  // Make room for the speaker button
            }}
          >
            {currentQuestion.questions[currentQuestionIndex]?.question || ''}
          </Typography>
          <Box sx={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
          }}>
            {config.tts.mode === 'ENABLED' && (
              <SpeakButton 
                text={currentQuestion.questions[currentQuestionIndex]?.question} 
                disabled={isLoading}
              />
            )}
          </Box>
        </Box>

        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          width: '100%', 
          maxWidth: '800px',
          margin: '0 auto',
        }}>
          <Box sx={{ 
            display: 'flex', 
            gap: 2,
            justifyContent: 'center', 
            width: '100%'
          }}>
            <Button
              variant={isAnswering || isAnswered ? 'contained' : 'outlined'}
              onClick={handleAnswerClick}
              size="large"
              sx={{ 
                height: { xs: '28px', sm: '64px' },
                fontSize: { xs: '0.75rem', sm: '1.2rem' },
                padding: { xs: '0 10px', sm: '0 40px' },
                bgcolor: isAnswered ? 'success.main' : isAnswering ? 'primary.main' : undefined,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  bgcolor: isAnswered ? 'success.dark' : isAnswering ? 'primary.dark' : undefined,
                  transform: 'translateY(-2px)',
                  boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                }
              }}
            >
              {isAnswered ? 'Edit Answer' : isAnswering ? 'ANSWERING' : 'Answer'}
            </Button>

            {currentQuestionIndex > 0 && (
              <Button
                variant={questionStatus[currentQuestionIndex]?.type === 'skipped' ? 'contained' : 'outlined'}
                onClick={handleSkip}
                size="large"
                sx={{ 
                  height: { xs: '28px', sm: '64px' },
                  fontSize: { xs: '0.75rem', sm: '1.2rem' },
                  padding: { xs: '0 10px', sm: '0 40px' },
                  bgcolor: questionStatus[currentQuestionIndex]?.type === 'skipped' ? 'warning.main' : undefined,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    bgcolor: questionStatus[currentQuestionIndex]?.type === 'skipped' ? 'warning.dark' : undefined,
                    transform: 'translateY(-2px)',
                    boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                  }
                }}
              >
                {questionStatus[currentQuestionIndex]?.type === 'skipped' ? 'Skipped' : 'Skip'}
              </Button>
            )}
          </Box>

          {(isAnswering || isAnswered) && !isSkipped && (
            <Box sx={{ 
              display: 'flex', 
              width: '100%',
              flexDirection: 'column',
              gap: { xs: 1, sm: 2 },
              alignItems: 'center',
              minHeight: { xs: 'auto', sm: 'auto' },
              position: 'relative'
            }}>
              <Box sx={{
                display: 'flex',
                width: '100%',
                gap: 2,
                position: 'relative'
              }}>
                <Box sx={{ position: 'relative', width: '100%' }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    variant="outlined"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type your answer..."
                    disabled={!isAnswering || isLoading}
                    sx={{ 
                      width: '100%',
                      maxWidth: { xs: '100%', sm: '92%', md: '94%' },
                      '& .MuiInputBase-input': { 
                        fontSize: { xs: '1rem', sm: '1.5rem' },
                        padding: { xs: '10px', sm: '15px' }
                      },
                      bgcolor: !isAnswering && isAnswered ? 'action.hover' : 'background.paper',
                      '& .MuiOutlinedInput-root': {
                        position: 'relative'
                      }
                    }}
                  />
                  {/* Add clear button */}
                  {isAnswering && input.trim() && (
                    <IconButton
                      size="small"
                      onClick={() => setInput('')}
                      sx={{
                        position: 'absolute',
                        right: { xs: '12px', sm: '50px' },
                        top: '8px',
                        transform: 'none',
                        opacity: 0.7,
                        padding: '4px',
                        backgroundColor: 'transparent',
                        color: theme => theme.palette.primary.main,
                        '&:hover': {
                          opacity: 1,
                          backgroundColor: 'rgba(0, 0, 0, 0.04)'
                        },
                        '& .MuiSvgIcon-root': {
                          fontSize: { xs: '1.1rem', sm: '1.3rem' },
                          color: 'inherit'
                        },
                        zIndex: 10
                      }}
                    >
                      <ClearIcon />
                    </IconButton>
                  )}
                </Box>
                {(config.input.mode === 'HANDS_FREE' || config.input.mode === 'TEXT_AND_VOICE') && isAnswering && (
                  <Box sx={{
                    display: { xs: 'none', sm: 'block' },
                    position: { sm: 'absolute' },
                    right: { sm: '-32px' },
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}>
                    <VoiceInput
                      onTranscriptionComplete={handleVoiceTranscriptionComplete}
                      disabled={isLoading}
                      autoStart={config.input.mode === 'HANDS_FREE'}
                      showStopButton={config.input.mode === 'HANDS_FREE'}
                      sx={{ 
                        '& .MuiIconButton-root': {
                          width: { xs: '32px', sm: '48px' },
                          height: { xs: '32px', sm: '48px' }
                        }
                      }}
                    />
                  </Box>
                )}
              </Box>
              {isAnswering && (
                <Box sx={{
                  display: 'flex',
                  gap: 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%'
                }}>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleSubmit}
                    disabled={isLoading}
                    size="large"
                    sx={{ 
                      height: { xs: '32px', sm: '48px' },
                      fontSize: { xs: '0.8rem', sm: '1rem' },
                      padding: { xs: '0 12px', sm: '0 24px' },
                      minWidth: { xs: '80px', sm: '120px' },
                    }}
                  >
                    {isLoading ? <CircularProgress size={16} /> : 'SAVE'}
                  </Button>
                  {/* Mobile-only mic button */}
                  {(config.input.mode === 'HANDS_FREE' || config.input.mode === 'TEXT_AND_VOICE') && (
                    <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                      <VoiceInput
                        onTranscriptionComplete={handleVoiceTranscriptionComplete}
                        disabled={isLoading}
                        autoStart={config.input.mode === 'HANDS_FREE'}
                        showStopButton={config.input.mode === 'HANDS_FREE'}
                        sx={{ 
                          '& .MuiIconButton-root': {
                            width: '32px',
                            height: '32px'
                          }
                        }}
                      />
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default ChatInterface;
