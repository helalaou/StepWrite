import React, { useState } from 'react';
import { Box, TextField, Button, Typography, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import config from '../config';
import { playClickSound } from '../utils/soundUtils';

function ParticipantIdInput({ onSubmit, mode }) {
  const [participantId, setParticipantId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (!participantId.trim()) {
      alert('Please enter a Participant ID');
      return;
    }
    
    // Play click sound for submit button
    playClickSound();
    
    setIsLoading(true);
    
    // Store participant ID in session storage
    sessionStorage.setItem('participantId', participantId);
    sessionStorage.setItem('experimentMode', mode);
    
    // Initialize experiment tracking counters
    sessionStorage.setItem('modifyCount', '0');
    sessionStorage.setItem('skipCount', '0');
    
    // Initialize time tracking variables
    sessionStorage.setItem('writingStartTime', Date.now().toString());
    sessionStorage.setItem('writingTimeTotal', '0');
    sessionStorage.setItem('revisionTimeTotal', '0');
    
    setTimeout(() => {
      setIsLoading(false);
      if (typeof onSubmit === 'function') {
        onSubmit(participantId);
      }
    }, 500);
  };

  const handleBackToHome = () => {
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
      padding: { xs: '20px', sm: '40px' },
      maxWidth: '600px',
      margin: '0 auto',
    }}>
      <Typography 
        variant="h4" 
        gutterBottom 
        sx={{ 
          fontSize: { xs: '2rem', sm: '2.5rem' },
          textAlign: 'center',
          mb: 4,
        }}
      >
        Enter Participant ID
      </Typography>

      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        width: '100%',
        maxWidth: '400px',
        margin: '0 auto',
      }}>
        <TextField
          fullWidth
          value={participantId}
          onChange={(e) => setParticipantId(e.target.value)}
          placeholder="Enter ID here..."
          variant="outlined"
          sx={{
            '& .MuiInputBase-root': {
              backgroundColor: 'background.paper',
              fontSize: '1.2rem',
            }
          }}
        />

        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          gap: 2,
          mt: 2
        }}>
          <Button
            variant="outlined"
            onClick={handleBackToHome}
            sx={{ 
              width: '120px',
              height: '50px',
            }}
          >
            Back
          </Button>
          
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isLoading || !participantId.trim()}
            sx={{ 
              width: '120px',
              height: '50px',
            }}
          >
            {isLoading ? <CircularProgress size={24} /> : 'Continue'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default ParticipantIdInput; 