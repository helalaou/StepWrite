import React, { useState } from 'react';
import { Box, TextField } from '@mui/material';
import ChatInterface from './ChatInterface';

function SplitScreenEdit({
  originalText,
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
  editedText,
  setEditedText
}) {
  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100vh',
      overflow: 'hidden'
    }}>
      {/* Left side - Text Display/Edit */}
      <Box sx={{ 
        flex: 1,
        borderRight: '1px solid',
        borderColor: 'divider',
        p: 3,
        height: '100%',
        overflow: 'auto'
      }}>
        <TextField
          multiline
          fullWidth
          minRows={20}
          value={editedText || originalText}
          InputProps={{
            readOnly: true,
          }}
          sx={{
            '& .MuiInputBase-root': {
              backgroundColor: 'background.paper',
              fontSize: '1.2rem',
              lineHeight: '1.5',
              padding: '20px',
            }
          }}
        />
      </Box>

      {/* Right side - Chat Interface */}
      <Box sx={{ 
        flex: 1,
        height: '100%',
        overflow: 'auto'
      }}>
        <ChatInterface
          currentQuestion={currentQuestion}
          input={input}
          setInput={setInput}
          isLoading={isLoading}
          sendMessage={sendMessage}
          submitAnswer={submitAnswer}
          questionStatus={questionStatus}
          setQuestionStatus={setQuestionStatus}
          currentQuestionIndex={currentQuestionIndex}
          setCurrentQuestionIndex={setCurrentQuestionIndex}
        />
      </Box>
    </Box>
  );
}

export default SplitScreenEdit; 