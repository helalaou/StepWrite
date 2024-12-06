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
}) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage().then((newLength) => {
        if (newLength) {
          setCurrentQuestionIndex(newLength - 1);
        }
      });
    }
  };

  const handleSubmit = () => {
    sendMessage().then((newLength) => {
      if (newLength) {
        setCurrentQuestionIndex(newLength - 1);
      }
    });
  };

  const questions = currentQuestion?.questions || [];
  const currentActiveQuestion = questions[currentQuestionIndex]?.question || '';
  const currentResponse = questions[currentQuestionIndex]?.response || '';

  // Navigation handlers
  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setInput(questions[currentQuestionIndex - 1]?.response || '');
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setInput(questions[currentQuestionIndex + 1]?.response || '');
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
        maxWidth: '800px',
        justifyContent: 'space-between'
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
          sx={{ fontSize: '36pt' }}
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

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '600px' }}>
        <TextField
          fullWidth
          variant="outlined"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={currentResponse ? '' : "Type your answer..."}
          disabled={isLoading}
          sx={{ marginRight: 2, '& .MuiInputBase-input': { fontSize: '1.5rem' } }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={isLoading}
          size="large"
        >
          {isLoading ? <CircularProgress size={24} /> : 'Send'}
        </Button>
      </Box>
    </Box>
  );
}

export default ChatInterface;
