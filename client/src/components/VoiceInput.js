import React, { useState, useEffect, useCallback } from 'react';
import { IconButton, Box, Typography, CircularProgress } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import axios from 'axios';
import config from '../config';
import { keyframes } from '@mui/system';
import { playClickSound } from '../utils/soundUtils';
import {
  initializeAudio,
  isMobileDevice,
  checkAudioRecordingSupport,
  getAudioContext,
  filterAndCleanAudio,
  encodeWav
} from '../utils/audioUtils';

function VoiceInput({ 
  onTranscriptionComplete, 
  disabled = false,
  autoStart = config.input.mode === 'HANDS_FREE',
  showStopButton = config.input.mode === 'HANDS_FREE'
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  // Check for recording support on mount
  useEffect(() => {
    const checkSupport = async () => {
      const supported = await checkAudioRecordingSupport();
      setIsSupported(supported);
      if (!supported) {
        console.warn('Audio recording not supported on this device');
      }
    };
    
    checkSupport();
    
    // Initialize audio on mount for better mobile support
    const handleUserInteraction = async () => {
      try {
        await initializeAudio();
        // Remove listeners once initialized
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

  const handleAudioTranscription = useCallback(async (audioBlob) => {
    setIsProcessing(true);
    try {
      // Decode on the page's shared AudioContext rather than opening (and
      // leaking) a new one per recording.
      const audioBuffer = await getAudioContext().decodeAudioData(await audioBlob.arrayBuffer());
      const cleanedData = filterAndCleanAudio(
        audioBuffer.getChannelData(0),
        config.voiceInput.noiseReduction
      );

      if (!cleanedData) {
        console.log('Recording is mostly noise or silence, skipping transcription');
        return;
      }

      const formData = new FormData();
      formData.append('audio', encodeWav(cleanedData, audioBuffer.sampleRate), 'recording.wav');

      const response = await axios.post(
        `${config.core.apiUrl}${config.core.endpoints.transcribe}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.text) {
        onTranscriptionComplete(response.data.text);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [onTranscriptionComplete]);

  const startRecording = useCallback(async () => {
    // Play click sound when manually starting recording
    if (!autoStart) {
      playClickSound();
    }
    
    if (!isSupported) {
      console.warn('Recording not supported on this device');
      return;
    }
    
    try {
      // Initialize audio context first (important for mobile)
      await initializeAudio();
      
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log('Microphone access granted');
      
      // Check if audio tracks are active
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks found in media stream');
      }
      
      console.log('Audio tracks:', audioTracks.map(track => ({
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      })));
      
      // Try different mime types for better mobile compatibility
      let mimeType = 'audio/webm';
      let options = { audioBitsPerSecond: config.voiceInput.recording.audioBitsPerSecond };
      
      // Check browser compatibility for different formats
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
        options = { audioBitsPerSecond: 128000 };
      } else if (MediaRecorder.isTypeSupported('audio/aac')) {
        mimeType = 'audio/aac';
        options = { audioBitsPerSecond: 128000 };
      }
      
      console.log('Using mime type:', mimeType);
      const recorder = new MediaRecorder(stream, {
        ...options,
        mimeType
      });
      
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
          console.log('Audio data chunk collected:', e.data.size, 'bytes');
        }
      };

      recorder.onstop = async () => {
        console.log('Recording stopped, processing audio...');
        
        if (chunks.length === 0) {
          console.error('No audio chunks collected during recording');
          setIsProcessing(false);
          setIsRecording(false);
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        const audioBlob = new Blob(chunks, { type: mimeType });
        
        console.log('Audio blob created:', audioBlob.size, 'bytes');
        
        if (audioBlob.size > 0) {
          await handleAudioTranscription(audioBlob);
        } else {
          console.error('Error: Audio blob is empty');
          setIsProcessing(false);
        }
        
        stream.getTracks().forEach(track => track.stop());
      };

      // Use shorter timeslice for mobile to ensure data is collected frequently
      const timeslice = isMobileDevice() ? 500 : 1000;
      
      // For mobile Safari, we need to start recording after a slight delay
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        setTimeout(() => {
          recorder.start(timeslice);
          console.log('Delayed recording start (iOS) with timeslice:', timeslice, 'ms');
        }, 100);
      } else {
        recorder.start(timeslice);
        console.log('Recording started with timeslice:', timeslice, 'ms');
      }
      
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check your permissions and try again.');
      setIsRecording(false);
      setIsProcessing(false);
    }
  }, [handleAudioTranscription, autoStart, isSupported]);

  const stopRecording = useCallback(() => {
    // Play click sound when manually stopping recording
    if (showStopButton) {
      playClickSound();
    }
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      console.log('Stopping recording...');
      try {
        mediaRecorder.stop();
        setIsRecording(false);
      } catch (error) {
        console.error('Error stopping recording:', error);
        // Force state reset if error occurs
        setIsRecording(false);
        setIsProcessing(false);
      }
    } else {
      console.warn('Cannot stop recording - recorder not active or already stopped');
      // Ensure UI is consistent
      setIsRecording(false);
    }
  }, [mediaRecorder, showStopButton]);

  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    };
  }, [mediaRecorder]);

  useEffect(() => {
    if (autoStart && !isRecording && !disabled && !isProcessing) {
      startRecording();
    }
  }, [autoStart, isRecording, disabled, isProcessing, startRecording]);

  // deefine pulse animation
  const pulseAnimation = keyframes`
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(161, 38, 20, 0.4);
    }
    70% {
      transform: scale(1);
      box-shadow: 0 0 0 10px rgba(161, 38, 20, 0);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(161, 38, 20, 0);
    }
  `;

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      py: 1,
      position: 'relative',
      width: { xs: 56, sm: 64 }
    }}>
      {isSupported ? (
        <IconButton
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isProcessing || (autoStart && !isRecording) || !isSupported}
          sx={{
            width: { xs: '40px', sm: '56px' },
            height: { xs: '40px', sm: '56px' },
            borderRadius: '50%',
            backgroundColor: theme => isRecording 
              ? 'error.main'
              : 'primary.main',
            '&:hover': {
              backgroundColor: theme => isRecording 
                ? 'error.dark'
                : 'primary.dark',
              transform: 'scale(1.1)',
            },
            '&:active': {
              transform: 'scale(0.95)',
            },
            transition: 'all 0.2s ease',
            animation: isRecording ? `${pulseAnimation} 2s infinite` : 'none',
            boxShadow: theme => isRecording 
              ? '0 0 10px rgba(161, 38, 20, 0.5)'
              : '0 3px 5px rgba(0, 0, 0, 0.2)',
            '& .MuiSvgIcon-root': {
              fontSize: { xs: '1.5rem', sm: '2.5rem' },
              color: '#ffffff',
              transition: 'transform 0.2s ease',
              transform: isRecording ? 'scale(0.9)' : 'scale(1)',
            },
            '&.Mui-disabled': {
              backgroundColor: theme => isRecording 
                ? 'error.light'
                : 'primary.light',
              '& .MuiSvgIcon-root': {
                color: 'rgba(255, 255, 255, 0.5)',
              }
            },
            visibility: autoStart && !isRecording && !showStopButton ? 'hidden' : 'visible'
          }}
        >
          {isProcessing ? (
            <CircularProgress 
              size={28}
              thickness={5}
              sx={{ 
                color: 'white',
                opacity: 0.9
              }}
            />
          ) : isRecording ? (
            <StopIcon />
          ) : (
            <MicIcon />
          )}
        </IconButton>
      ) : (
        <IconButton
          disabled={true}
          sx={{
            width: { xs: '40px', sm: '56px' },
            height: { xs: '40px', sm: '56px' },
            borderRadius: '50%',
            backgroundColor: 'grey.400',
            '& .MuiSvgIcon-root': {
              fontSize: { xs: '1.2rem', sm: '2rem' },
              color: 'grey.600',
            },
            cursor: 'not-allowed',
            position: 'relative',
            '&::after': {
              content: '""',
              position: 'absolute',
              width: '100%',
              height: '2px',
              backgroundColor: 'grey.600',
              transform: 'rotate(45deg)',
            }
          }}
        >
          <MicIcon />
        </IconButton>
      )}
      {isRecording && (
        <Typography
          variant="body2"   
          color="error"
          sx={{ 
            position: 'absolute',
            bottom: -24,
            left: '50%',
            transform: 'translateX(-50%)',
            animation: `${keyframes`
              0% { opacity: 1; }
              50% { opacity: 0.5; }
              100% { opacity: 1; }
            `} 1.5s infinite`,
            fontSize: '0.75rem',
            fontWeight: 500,
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            '&::before': {
              content: '""',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'error.main',
              display: 'inline-block'
            }
          }}
        >
          Recording
        </Typography>
      )}
      {!isSupported && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ 
            position: 'absolute',
            bottom: -24,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '0.7rem',
            whiteSpace: 'nowrap',
          }}
        >
          Mic not supported
        </Typography>
      )}
    </Box>
  );
}

export default VoiceInput; 