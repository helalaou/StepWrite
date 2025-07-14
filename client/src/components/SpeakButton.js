import React, { useState, useRef, useEffect } from 'react';
import { IconButton, CircularProgress } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { keyframes } from '@mui/system';
import config from '../config';
import { initializeAudio, playAudio } from '../utils/audioUtils';

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

function SpeakButton({ text, disabled = false, autoPlay = false, onComplete = null, showAnimation = true }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  
  // Initialize audio on component mount for mobile browsers
  useEffect(() => {
    // Only initialize on user interaction
    const handleUserInteraction = async () => {
      try {
        await initializeAudio();
        // Remove event listeners once initialized
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
      } catch (err) {
        console.warn('Audio initialization failed:', err);
      }
    };
    
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });
    
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  useEffect(() => {
    if (autoPlay && text && !isLoading && !isPlaying) {
      generateAndPlayAudio();
    }
  }, [autoPlay, text]);

  const generateAndPlayAudio = async () => {
    if (isLoading || isPlaying || !text) return;

    try {
      setIsLoading(true);

      // Stop any previous audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Initialize audio context (important for mobile)
      await initializeAudio();

      const response = await fetch(`${config.core.apiUrl}${config.core.endpoints.tts}`, {
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

      // Fix for ngrok - check if the audioUrl is already a full URL
      const audioUrl = data.audioUrl.startsWith('http') 
        ? data.audioUrl 
        : `${config.core.apiUrl}${data.audioUrl}`;
      
      console.log('Playing audio from URL:', audioUrl);
      
      // Use our utility to play audio
      const audio = await playAudio(
        audioUrl,
        // On ended callback
        () => {
          setIsPlaying(false);
          if (onComplete) onComplete();
        },
        // On error callback
        (error) => {
          console.error('Audio playback error:', error);
          setIsPlaying(false);
          if (onComplete) onComplete();
        }
      );
      
      if (audio) {
        audioRef.current = audio;
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Speech generation error:', error);
      setIsPlaying(false);
      if (onComplete) onComplete();
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
        animation: showAnimation && isPlaying ? `${pulseAnimation} 2s infinite ease-in-out` : 'none',
        '&:hover': {
          color: 'primary.main',
          backgroundColor: 'rgba(161, 38, 20, 0.04)',
          transform: 'scale(1.05)',
        },
        '&:active': {
          transform: 'scale(0.95)',
        },
        ...(showAnimation && isPlaying && {
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