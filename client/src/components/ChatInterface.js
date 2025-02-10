import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, CircularProgress, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EastIcon from '@mui/icons-material/East';
import WestIcon from '@mui/icons-material/West';
import { useNavigate } from 'react-router-dom';

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
  cameFromEditor
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

  // Common styles for navigation buttons
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
      // If no changes, just update status and move to next question
      console.log('No changes detected, skipping backend call');
      setQuestionStatus({
        ...questionStatus,
        [currentQuestionIndex]: { type: 'answered', answer: input }
      });
      // Move to next question if available
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
        <Box sx={{
          position: 'fixed',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'background.paper',
          borderTopRightRadius: '8px',
          borderBottomRightRadius: '8px',
          boxShadow: 2,
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-50%) translateX(5px)',
            boxShadow: 4,
          }
        }}>
          <Button
            variant="contained"
            onClick={() => navigate('/')}
            sx={{ 
              height: '60px',
              borderTopRightRadius: '8px',
              borderBottomRightRadius: '8px',
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              paddingLeft: 3,
              paddingRight: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <WestIcon />
            Back to Home
          </Button>
        </Box>
      )}

      {/* Back to Editor button */}
      {currentQuestionIndex === currentQuestion.questions.length - 1 && 
       !hasChanges && 
       cameFromEditor && 
       onBackToEditor && (
        <Box sx={{
          position: 'absolute',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'background.paper',
          borderTopLeftRadius: '8px',
          borderBottomLeftRadius: '8px',
          boxShadow: 2,
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-50%) translateX(-5px)',
            boxShadow: 4,
          }
        }}>
          <Button
            variant="contained"
            onClick={onBackToEditor}
            sx={{ 
              height: '60px',
              borderTopLeftRadius: '8px',
              borderBottomLeftRadius: '8px',
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              paddingLeft: 3,
              paddingRight: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            Back to Editor
            <EastIcon />
          </Button>
        </Box>
      )}

      {/* Left Navigation */}
      <Box sx={getNavStyles(true)}>
        <IconButton 
          onClick={handlePrevQuestion} 
          disabled={currentQuestionIndex === 0}
          sx={getNavButtonStyles(currentQuestionIndex === 0)}
        >
          <ArrowBackIcon />
        </IconButton>
      </Box>

      {/* Right Navigation */}
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
        <Typography 
          variant="h4" 
          gutterBottom 
          sx={{ 
            fontSize: { xs: '24pt', sm: '32pt', md: '42pt' },
            textAlign: 'center',
            mb: 4,
            transition: 'all 0.3s ease',
          }}
        >
          {currentQuestion.questions[currentQuestionIndex]?.question || ''}
        </Typography>

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
                height: '64px',
                fontSize: '1.2rem',
                padding: '0 40px',
                bgcolor: isAnswered ? 'success.main' : undefined,
                '&:hover': {
                  bgcolor: isAnswered ? 'success.dark' : undefined
                }
              }}
            >
              {isAnswered ? 'Edit Answer' : 'Answer'}
            </Button>

            {currentQuestionIndex > 0 && (
              <Button
                variant={questionStatus[currentQuestionIndex]?.type === 'skipped' ? 'contained' : 'outlined'}
                onClick={handleSkip}
                size="large"
                sx={{ 
                  height: '64px',
                  fontSize: '1.2rem',
                  padding: '0 40px',
                  bgcolor: questionStatus[currentQuestionIndex]?.type === 'skipped' ? 'warning.main' : undefined,
                  '&:hover': {
                    bgcolor: questionStatus[currentQuestionIndex]?.type === 'skipped' ? 'warning.dark' : undefined
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
              gap: 2
            }}>
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
                  '& .MuiInputBase-input': { 
                    fontSize: '1.5rem', 
                    padding: '15px'
                  },
                  bgcolor: !isAnswering && isAnswered ? 'action.hover' : 'background.paper'
                }}
              />
              {isAnswering && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  size="large"
                  sx={{ 
                    height: 'auto',
                    alignSelf: 'stretch',
                    width: 'auto',
                    fontSize: '1.2rem'
                  }}
                >
                  {isLoading ? <CircularProgress size={23} /> : 'SAVE'}
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default ChatInterface;
