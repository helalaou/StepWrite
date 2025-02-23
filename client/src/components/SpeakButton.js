import React, { useState, useRef } from 'react';
import { IconButton, CircularProgress } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { keyframes } from '@mui/system';
import config from '../config';

/// Pulse animation fr playing state
const pulseAnimation = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0.8;
  }
`;

// annimation for playing state
const waveAnimation = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(161, 38, 20, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(161, 38, 20, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(161, 38, 20, 0);
  }
`;

function SpeakButton({ text, disabled = false }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const generateAndPlayAudio = async () => {
    if (isLoading || isPlaying || !text) return;

    try {
      setIsLoading(true);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const response = await fetch(`${config.apiUrl}${config.endpoints.tts}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.audioUrl) {
        throw new Error('No audio URL in response');
      }

      const audio = new Audio(`${config.apiUrl}${data.audioUrl}`);
      audioRef.current = audio;

      audio.addEventListener('ended', () => setIsPlaying(false));
      audio.addEventListener('error', (e) => {
        setIsPlaying(false);
        console.error('Audio playback error:', e);
      });

      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Speech generation error:', error);
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <IconButton
      onClick={generateAndPlayAudio}
      disabled={disabled || isLoading}
      size="small"
      sx={{
        position: 'relative',
        color: isPlaying ? 'primary.main' : 'text.secondary',
        opacity: isLoading ? 0.7 : 1,
        transition: 'all 0.3s ease',
        padding: { xs: '8px', sm: '12px' },
        width: { xs: '40px', sm: '48px', md: '56px' },
        height: { xs: '40px', sm: '48px', md: '56px' },
        backgroundColor: 'transparent',
        '&:hover': {
          color: 'primary.main',
          backgroundColor: 'rgba(161, 38, 20, 0.04)',
          transform: 'scale(1.05)',
        },
        '&:active': {
          transform: 'scale(0.95)',
        },
        '& .MuiSvgIcon-root': {
          fontSize: { xs: '1.5rem', sm: '2rem', md: '2.4rem' },
          animation: isPlaying ? `${pulseAnimation} 2s infinite ease-in-out` : 'none',
        },
        ...(isPlaying && {
          animation: `${waveAnimation} 2s infinite`,
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: '50%',
            border: '2px solid',
            borderColor: 'primary.main',
            animation: `${pulseAnimation} 2s infinite`
          }
        }),
        ...(isLoading && {
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '50%',
            zIndex: 1
          }
        })
      }}
    >
      {isLoading ? (
        <CircularProgress 
          size={24}
          thickness={4}
          sx={{ 
            color: 'primary.main',
            position: 'relative',
            zIndex: 2
          }} 
        />
      ) : (
        <VolumeUpIcon />
      )}
    </IconButton>
  );
}

export default SpeakButton; 