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
        '&:hover': {
          color: 'primary.main'
        }
      }}
    >
      {isLoading ? (
        <CircularProgress size={24} />
      ) : (
        <VolumeUpIcon />
      )}
    </IconButton>
  );
}

export default SpeakButton; 