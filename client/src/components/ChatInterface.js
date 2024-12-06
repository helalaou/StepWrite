import React, { useState } from 'react';
import { Box, TextField, Button, CircularProgress, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

function ChatInterface({
  currentQuestion,
  input,
  setInput,
  isLoading,
  sendMessage,
  submitAnswer
}) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionStatus, setQuestionStatus] = useState({});
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    sendMessage()
      .then((newLength) => {
        if (newLength) {
          setQuestionStatus({
            ...questionStatus,
            [currentQuestionIndex]: { type: 'answered', answer: input }
          });
          setCurrentQuestionIndex(newLength - 1);
          handleNextQuestion();
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

  const handleSkip = () => {
    // Only proceed if not already skipped
    if (questionStatus[currentQuestionIndex]?.type !== 'skipped') {
      const skipMessage = "user skipped this question";
      
      // First set the input and update UI state
      setInput(skipMessage);
      setQuestionStatus({
        ...questionStatus,
        [currentQuestionIndex]: { type: 'skipped', answer: skipMessage }
      });

      // Then immediately submit the skip and get next question
      submitAnswer(currentQuestion.questions[currentQuestionIndex].id, skipMessage)
        .then((newLength) => {
          if (newLength) {
            // Move to the new question
            setCurrentQuestionIndex(newLength - 1);
            // Clear input for next question
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

  const handleAnswerClick = () => {
    if (questionStatus[currentQuestionIndex]?.type === 'skipped') {
      setInput('');
    }
    setQuestionStatus({
      ...questionStatus,
      [currentQuestionIndex]: { 
        type: 'answering',
        answer: questionStatus[currentQuestionIndex]?.answer || input 
      }
    });
  };

  const questions = currentQuestion?.questions || [];
  const currentActiveQuestion = questions[currentQuestionIndex]?.question || '';

  // Navigation handlers
  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      const prevAnswer = questionStatus[currentQuestionIndex - 1]?.answer || '';
      setInput(prevAnswer);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      const nextAnswer = questionStatus[currentQuestionIndex + 1]?.answer || '';
      setInput(nextAnswer);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <Box sx={{ 
        textAlign: 'center', 
        mb: 4, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        width: '100%',
        maxWidth: '1700px',
        justifyContent: 'space-between',
        padding: '0 20px'
      }}>
        <IconButton 
          onClick={handlePrevQuestion} 
          disabled={currentQuestionIndex === 0}
          sx={{ 
            '& .MuiSvgIcon-root': {
              fontSize: '2.5rem',
              color: currentQuestionIndex === 0 ? 'action.disabled' : 'primary.main'
            }
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography 
          variant="h4" 
          gutterBottom 
          sx={{ fontSize: '42pt' }}
        >
          {currentActiveQuestion}
        </Typography>
        <IconButton 
          onClick={handleNextQuestion} 
          disabled={currentQuestionIndex === questions.length - 1}
          sx={{ 
            '& .MuiSvgIcon-root': {
              fontSize: '2.5rem',
              color: currentQuestionIndex === questions.length - 1 ? 'action.disabled' : 'primary.main'
            }
          }}
        >
          <ArrowForwardIcon />
        </IconButton>
      </Box>

      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        width: '100%', 
        maxWidth: '800px'
      }}>
        {questionStatus[currentQuestionIndex]?.type && (
          <Typography 
            sx={{ 
              color: questionStatus[currentQuestionIndex]?.type === 'skipped' ? 'warning.main' : 'success.main',
              fontWeight: 'bold'
            }}
          >
            Status: {questionStatus[currentQuestionIndex]?.type.toUpperCase()}
          </Typography>
        )}

        <Box sx={{ 
          display: 'flex', 
          gap: 2,
          justifyContent: 'center', 
          width: '100%'
        }}>
          <Button
            variant={questionStatus[currentQuestionIndex]?.type === 'answering' || 
                    questionStatus[currentQuestionIndex]?.type === 'answered' ? 'contained' : 'outlined'}
            onClick={handleAnswerClick}
            size="large"
            sx={{ 
              height: '64px',
              fontSize: '1.2rem',
              padding: '0 40px',
              bgcolor: questionStatus[currentQuestionIndex]?.type === 'answered' ? 'success.main' : undefined,
              '&:hover': {
                bgcolor: questionStatus[currentQuestionIndex]?.type === 'answered' ? 'success.dark' : undefined
              }
            }}
          >
            {questionStatus[currentQuestionIndex]?.type === 'answered' ? 'Answered' : 'Answer'}
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

        {(questionStatus[currentQuestionIndex]?.type === 'answering' || 
          questionStatus[currentQuestionIndex]?.type === 'answered') && (
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
              disabled={isLoading || questionStatus[currentQuestionIndex]?.type === 'answered'}
              sx={{ 
                '& .MuiInputBase-input': { 
                  fontSize: '1.5rem', 
                  padding: '15px'
                },
                bgcolor: questionStatus[currentQuestionIndex]?.type === 'answered' ? 'action.hover' : 'background.paper'
              }}
            />
            {questionStatus[currentQuestionIndex]?.type === 'answering' && (
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
  );
}

export default ChatInterface;
