import React, { useState, useRef } from 'react';
import { IconButton, CircularProgress } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import config from '../config';

function SpeakButton({ text, disabled = false }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const generateAndPlayAudio = async () => {
    if (isLoading || isPlaying || !text) return;

    try {
      setIsLoading(true);

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // Generate audio
      const response = await fetch(`${config.apiUrl}/api/tts/generate`, {
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

      // Create and play audio
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
        color: isPlaying ? 'primary.main' : 'text.secondary',
        opacity: 0.7,
        transition: 'all 0.2s ease',
        padding: '8px',
        '&:hover': {
          color: 'primary.main',
          opacity: 1,
          transform: 'scale(1.1)',
          bgcolor: 'transparent'
        },
        '& .MuiSvgIcon-root': {
          fontSize: { xs: '1.2rem', sm: '1.5rem', md: '1.8rem' }
        }
      }}
    >
      {isLoading ? (
        <CircularProgress 
          size={20} 
          sx={{ 
            color: 'primary.main',
            opacity: 0.8
          }} 
        />
      ) : (
        <VolumeUpIcon />
      )}
    </IconButton>
  );
}

export default SpeakButton; 