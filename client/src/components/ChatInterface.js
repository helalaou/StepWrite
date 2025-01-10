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
  
  useEffect(() => {
    if (currentQuestion?.questions) {
      const questions = currentQuestion.questions;
      
      const initialStatus = {};
      questions.forEach((question, index) => {
        if (question.response) {
          initialStatus[index] = {
            type: question.response === "user has skipped this question" ? 'skipped' : 'answered',
            answer: question.response
          };
        }
      });
      
      if (Object.keys(initialStatus).length > Object.keys(questionStatus).length) {
        setQuestionStatus(initialStatus);
        
        if (currentQuestionIndex === 0 && initialStatus[0]) {
          setInput(initialStatus[0].answer);
        }
      }
    }
  }, [currentQuestion, setQuestionStatus, currentQuestionIndex, setInput]);

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
      const newIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(newIndex);
      
      const nextAnswer = questionStatus[newIndex]?.answer || 
                        currentQuestion.questions[newIndex]?.response || 
                        '';
      setInput(nextAnswer);
    }
  };

  const handleAnswerClick = () => {
    if (questionStatus[currentQuestionIndex]?.type === 'answered') {
      setQuestionStatus({
        ...questionStatus,
        [currentQuestionIndex]: { 
          type: 'answering',
          answer: questionStatus[currentQuestionIndex].answer 
        }
      });
      return;
    }

    if (questionStatus[currentQuestionIndex]?.type === 'skipped') {
      setInput('');
    }

    const updatedQuestionStatus = { ...questionStatus };
    Object.keys(updatedQuestionStatus).forEach((key) => {
      if (parseInt(key) > currentQuestionIndex) {
        delete updatedQuestionStatus[key];
      }
    });

    setQuestionStatus({
      ...updatedQuestionStatus,
      [currentQuestionIndex]: { 
        type: 'answering',
        answer: questionStatus[currentQuestionIndex]?.answer || input 
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

  const questions = currentQuestion?.questions || [];
  const currentActiveQuestion = questions[currentQuestionIndex]?.question || '';
  const isAnswered = questionStatus[currentQuestionIndex]?.type === 'answered';
  const isAnswering = questionStatus[currentQuestionIndex]?.type === 'answering';

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
              color: questionStatus[currentQuestionIndex]?.type === 'skipped' ? 'warning.main' : 
                    questionStatus[currentQuestionIndex]?.type === 'answered' ? 'success.main' : 'info.main',
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

        {(isAnswering || isAnswered) && (
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
              disabled={isLoading || (!isAnswering && isAnswered)}
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
  );
}

export default ChatInterface;
