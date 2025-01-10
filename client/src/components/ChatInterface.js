import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, CircularProgress, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

function ChatInterface({
  currentQuestion,
  input,
  setInput,
  isLoading,
  sendMessage,
  submitAnswer,
  questionStatus,
  setQuestionStatus
}) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Navigation control variables
  const navControls = {
    width: {
      percentage: {
        xs: '12%',    // xs -- smaller width on mobile
        sm: '15%'     // sm -- original width on larger screens
      },
      min: {
        xs: '15px',    
        sm: '20px'     
      },
      max: {
        xs: '40px',    
        sm: '70px'    
      }
    },
    arrow: {
      size: {
        xs: '1.8rem', 
        sm: '2.5rem',  
        md: '3.2rem'  //md -- original size on desktop
      },
      scale: 1,
    },
    hover: {
      intensity: 0.07,
      base: 0.01
    },
    shadow: {
      intensity: 1
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
      : `rgba(0, 0, 0, ${navControls.hover.base})`,
    transition: 'all 0.3s ease',
    boxShadow: (
      isLeft ? currentQuestionIndex === 0 
             : currentQuestionIndex === currentQuestion.questions.length - 1
    )
      ? 'none'
      : `${isLeft ? 'inset -2px' : 'inset 2px'} 0px ${
          navControls.shadow.intensity * 2
        }px -${navControls.shadow.intensity}px rgba(0, 0, 0, 0.1)`,
    '&:hover': {
      backgroundColor: (
        isLeft ? currentQuestionIndex === 0 
               : currentQuestionIndex === currentQuestion.questions.length - 1
      )
        ? 'transparent'
        : `rgba(0, 0, 0, ${navControls.hover.intensity})`,
    },
  });

  // Common styles for navigation buttons
  const getNavButtonStyles = (isDisabled) => ({
    height: '100%',
    width: '100%',
    borderRadius: 0,
    '&.Mui-disabled': {
      opacity: 0,
    },
    transition: 'all 0.3s ease',
    '& .MuiSvgIcon-root': {
      fontSize: {
        xs: navControls.arrow.size.xs,
        sm: navControls.arrow.size.sm,
        md: navControls.arrow.size.md
      },
      transform: `scale(${navControls.arrow.scale})`,
      color: isDisabled ? 'action.disabled' : 'primary.main'
    }
  });

  // =============================
  // NEW: Simplified useEffect to rebuild questionStatus from scratch
  // whenever currentQuestion changes (or currentQuestionIndex changes).
  // =============================
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

    const updatedQuestions = [...currentQuestion.questions];
    updatedQuestions[currentQuestionIndex] = {
      ...updatedQuestions[currentQuestionIndex],
      response: input
    };

    const updatedConversationPlanning = {
      ...currentQuestion,
      questions: updatedQuestions
    };

    sendMessage(currentQuestionIndex, updatedConversationPlanning)
      .then((newLength) => {
        if (newLength) {
          setQuestionStatus({
            ...questionStatus,
            [currentQuestionIndex]: { type: 'answered', answer: input }
          });
          setCurrentQuestionIndex(newLength - 1);
          setInput('');
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
      setInput('');
      setQuestionStatus({
        ...questionStatus,
        [currentIndex]: { 
          type: 'answering',
          answer: '' 
        }
      });
      return;
    }

    // If already answered, switch to editing mode
    if (questionStatus[currentIndex]?.type === 'answered') {
      setQuestionStatus({
        ...questionStatus,
        [currentIndex]: { 
          type: 'answering',
          answer: questionStatus[currentIndex].answer 
        }
      });
      return;
    }

    // For new or other cases
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
  const isUnanswered = questionStatus[currentQuestionIndex] === undefined;

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
          {questionStatus[currentQuestionIndex] && (
            <Typography 
              sx={{ 
                color: questionStatus[currentQuestionIndex]?.type === 'skipped' 
                  ? 'warning.main' 
                  : questionStatus[currentQuestionIndex]?.type === 'answered' 
                    ? 'success.main' 
                    : 'info.main',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontSize: '0.9rem'
              }}
            >
              Status: {questionStatus[currentQuestionIndex]?.type}
            </Typography>
          )}

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
                  sx={{ height: '64px' }}
                >
                  {isLoading ? <CircularProgress size={24} /> : 'SAVE'}
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
