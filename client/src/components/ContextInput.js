import React, { useState } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { useNavigate } from 'react-router-dom';
import NavigationButton from './NavigationButton';
import { playClickSound } from '../utils/soundUtils';

function ContextInput({ onSubmit, title = "Paste the text you want to reply to here" }) {
  const [text, setText] = useState('');
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (!text.trim()) {
      alert('Please paste the text');
      return;
    }
    
    // Play click sound for submit button
    playClickSound();
    
    if (typeof onSubmit === 'function') {
      onSubmit(text);
    } else {
      console.error('onSubmit is not a function');
    }
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
      position: 'relative',
    }}>
      {/* Back to Home Button */}
      <NavigationButton
        direction="left"
        onClick={() => navigate('/')}
        tooltip="Back to Home"
        showAt="mobile"
      />

      <Typography 
        variant="h4" 
        gutterBottom 
        sx={{ 
          fontSize: { xs: '2rem', sm: '2.5rem' },
          textAlign: 'center',
          mb: 4,
        }}
      >
        {title}
      </Typography>

      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        width: '100%',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        <TextField
          multiline
          fullWidth
          minRows={6}
          maxRows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Your text will appear here..."
          sx={{
            '& .MuiInputBase-root': {
              backgroundColor: 'background.paper',
              fontSize: { xs: '0.9rem', sm: '1.1rem' },
              lineHeight: '1.4',
              padding: { xs: '12px', sm: '16px' },
              '& textarea': {
                resize: 'vertical',
              }
            },
            mb: 1,
          }}
        />

        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          mb: 2,
          ml: 1,
        }}>
          <KeyboardIcon sx={{ 
            color: 'text.secondary',
            fontSize: { xs: '1rem', sm: '1.2rem' }
          }} />
          <Typography
            variant="body1"
            sx={{
              fontSize: { xs: '0.9rem', sm: '1rem' },
              color: 'text.secondary',
            }}
          >
            Or type it yourself
          </Typography>
        </Box>

        <Button
          variant="contained"
          size="large"
          onClick={handleSubmit}
          sx={{ 
            height: { xs: '40px', sm: '50px' },
            fontSize: { xs: '0.9rem', sm: '1rem' },
            width: { xs: '140px', sm: '160px' },
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

export default ContextInput; 