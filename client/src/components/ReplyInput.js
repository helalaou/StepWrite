import React, { useState } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import WestIcon from '@mui/icons-material/West';
import { useNavigate } from 'react-router-dom';

function ReplyInput({ onSubmit }) {
  const [text, setText] = useState('');
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (!text.trim()) {
      alert('Please paste the text you want to reply to');
      return;
    }
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

      <Typography 
        variant="h4" 
        gutterBottom 
        sx={{ 
          fontSize: { xs: '2rem', sm: '2.5rem' },
          textAlign: 'center',
          mb: 4,
        }}
      >
        Paste the text you want to reply to here
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
          placeholder="Your text will appear here..."
          sx={{
            '& .MuiInputBase-root': {
              backgroundColor: 'background.paper',
              fontSize: '1.3rem',
              lineHeight: '1.6',
              padding: '20px',
              '& textarea': {
                resize: 'vertical',
              }
            },
            mb: 2,
          }}
        />

        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          mb: 3,
          ml: 2
        }}>
          <KeyboardIcon sx={{ color: 'text.secondary' }} />
          <Typography
            variant="body1"
            sx={{
              fontSize: '1.2rem',
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

export default ReplyInput; 