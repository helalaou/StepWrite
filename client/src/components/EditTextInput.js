import React, { useState } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';

function EditTextInput({ onSubmit }) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim()) {
      alert('Please paste some text to edit');
      return;
    }
    onSubmit(text);
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      padding: { xs: '20px', sm: '40px' },
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      <Typography 
        variant="h4" 
        gutterBottom 
        sx={{ 
          fontSize: { xs: '24pt', sm: '32pt', md: '42pt' },
          textAlign: 'center',
          mb: 4,
        }}
      >
        Paste the text you would like to edit
      </Typography>

      <Box sx={{ 
        width: '100%',
        maxWidth: '900px',
      }}>
        <TextField
          multiline
          fullWidth
          minRows={10}
          maxRows={20}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your text here..."
          sx={{
            '& .MuiInputBase-root': {
              backgroundColor: 'background.paper',
              fontSize: '1.2rem',
              lineHeight: '1.5',
              '& textarea': {
                resize: 'vertical',
              }
            },
            mb: 3,
          }}
        />

        <Button
          variant="contained"
          size="large"
          onClick={handleSubmit}
          sx={{ 
            height: '60px',
            fontSize: '1.2rem',
            width: '200px',
            display: 'block',
            margin: '0 auto',
          }}
        >
          Submit
        </Button>
      </Box>
    </Box>
  );
}

export default EditTextInput; 