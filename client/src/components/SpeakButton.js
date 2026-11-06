import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IconButton, CircularProgress } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { keyframes } from '@mui/system';
import config from '../config';
import { initializeAudio, playAudio, speechRequestBody } from '../utils/audioUtils';

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

function SpeakButton({ text, disabled = false, autoPlay = false, onComplete = null, showAnimation = true }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  // Bumped whenever playback starts or stops, so a request that resolves
  // after the text changed or the button unmounted is dropped.
  const playbackIdRef = useRef(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
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

  const stopAudio = useCallback(() => {
    playbackIdRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  const generateAndPlayAudio = useCallback(async (textToSpeak) => {
    stopAudio();
    const playbackId = playbackIdRef.current;
    const isCurrent = () => playbackId === playbackIdRef.current;

    // Only the current playback may report completion; a stopped one was
    // interrupted on purpose.
    const handleFinished = () => {
      if (!isCurrent()) return;
      audioRef.current = null;
      setIsPlaying(false);
      if (onCompleteRef.current) onCompleteRef.current();
    };

    try {
      setIsLoading(true);

      // Initialize audio context (important for mobile)
      await initializeAudio();

      const response = await fetch(`${config.core.apiUrl}${config.core.endpoints.tts}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: speechRequestBody(textToSpeak)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.audioUrl) {
        throw new Error('No audio URL in response');
      }
      if (!isCurrent()) return;

      const audio = await playAudio(
        `${config.core.apiUrl}${data.audioUrl}`,
        handleFinished,
        (error) => {
          console.error('Audio playback error:', error);
          handleFinished();
        }
      );

      if (!isCurrent()) {
        if (audio) audio.pause();
        return;
      }
      if (audio) {
        audioRef.current = audio;
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Speech generation error:', error);
      handleFinished();
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [stopAudio]);

  // Auto-play follows the text: a new text replaces whatever is playing, and
  // turning autoPlay off (e.g. because the user started speaking) or changing
  // the text without it stops the old audio.
  useEffect(() => {
    if (autoPlay && text) {
      generateAndPlayAudio(text);
    } else {
      stopAudio();
    }
  }, [autoPlay, text, generateAndPlayAudio, stopAudio]);

  useEffect(() => () => {
    playbackIdRef.current += 1;
    if (audioRef.current) audioRef.current.pause();
  }, []);

  const handleClick = () => {
    if (isLoading || isPlaying || !text) return;
    generateAndPlayAudio(text);
  };

  return (
    <IconButton
      onClick={handleClick}
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