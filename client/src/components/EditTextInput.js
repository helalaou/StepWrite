import React, { useState } from 'react';
import { Box, TextField, Button, Typography, CircularProgress } from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import WestIcon from '@mui/icons-material/West';
import { useNavigate } from 'react-router-dom';
import VoiceInput from './VoiceInput';
import config from '../config';
import { playClickSound } from '../utils/soundUtils';

function EditTextInput({ onSubmit }) {
  const [text, setText] = useState('');
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = () => {
    if (!text.trim()) {
      alert('Please paste the text you want to edit');
      return;
    }
    
    // Play click sound for submit button
    playClickSound();
    
    onSubmit(text);
  };

  const handleVoiceTranscriptionComplete = (transcription) => {
    setText(transcription);
  };

  const handleBackClick = () => {
    // Play click sound for back button
    playClickSound();
    navigate('/');
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      padding: { xs: '4px', sm: '8px' },
      maxWidth: '400px',
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
        borderTopRightRadius: '2px',
        borderBottomRightRadius: '2px',
        boxShadow: 1,
        '&:hover': {
          transform: 'translateY(-50%) translateX(2px)',
          boxShadow: 2,
        }
      }}>
        <Button
          variant="contained"
          onClick={handleBackClick}
          sx={{ 
            height: { xs: '16px', sm: '20px' },
            minWidth: { xs: '16px', sm: '20px' },
            borderRadius: 0,
            padding: { xs: '2px 4px', sm: '3px 6px' },
            fontSize: { xs: '0.35rem', sm: '0.4rem' },
          }}
        >
          <WestIcon sx={{ fontSize: { xs: '0.5rem', sm: '0.6rem' } }} />
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Back</Box>
        </Button>
      </Box>

      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 0.25, sm: 0.5 },
        width: '100%',
        maxWidth: { xs: '100%', sm: '250px' },
        margin: '0 auto',
        padding: { xs: '2px', sm: '4px' }
      }}>
        <Typography 
          variant="h6" 
          sx={{ 
            textAlign: 'center',
            fontSize: { xs: '0.35rem', sm: '0.45rem' },
            opacity: 0.7,
            mb: { xs: 0.125, sm: 0.25 }
          }}
        >
          Your text will appear here...
        </Typography>

        <TextField
          multiline
          rows={{ xs: 1, sm: 2 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          variant="outlined"
          placeholder="Start typing or use voice input..."
          sx={{
            width: '100%',
            '& .MuiInputBase-input': {
              fontSize: { xs: '0.35rem', sm: '0.4rem' },
              lineHeight: { xs: 1.1, sm: 1.2 },
              padding: { xs: '3px', sm: '4px' }
            },
            '& .MuiOutlinedInput-root': {
              borderRadius: '2px'
            }
          }}
        />

        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center',
          gap: { xs: 0.25, sm: 0.5 }
        }}>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isLoading || !text.trim()}
            sx={{
              height: { xs: '12px', sm: '16px' },
              fontSize: { xs: '0.325rem', sm: '0.375rem' },
              padding: { xs: '0 3px', sm: '0 6px' },
              minWidth: { xs: '25px', sm: '35px' }
            }}
          >
            {isLoading ? <CircularProgress size={6} /> : 'Submit'}
          </Button>

          {(config.input.mode === 'HANDS_FREE' || config.input.mode === 'TEXT_AND_VOICE') && (
            <VoiceInput
              onTranscriptionComplete={handleVoiceTranscriptionComplete}
              disabled={isLoading}
              sx={{ 
                '& .MuiIconButton-root': {
                  width: { xs: '12px', sm: '16px' },
                  height: { xs: '12px', sm: '16px' }
                }
              }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default EditTextInput; 