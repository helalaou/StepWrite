import React, { useState, useEffect } from 'react';
import { IconButton, Box, Typography, CircularProgress } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import axios from 'axios';
import config from '../config';
import { keyframes } from '@mui/system';

function VoiceInput({ 
  onTranscriptionComplete, 
  disabled = false,
  autoStart = false,
  showStopButton = false
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

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
  }, [autoStart, isRecording, disabled, isProcessing]);

  const handleVoiceActivityDetection = (stream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let silenceStart = Date.now();
    const silenceThreshold = 2000; // 2 seconds of silence
    
    const checkAudio = () => {
      if (!isRecording) return;
      
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      
      if (average < 10) { // Silence threshold
        if (Date.now() - silenceStart > silenceThreshold) {
          stopRecording();
          audioContext.close();
          return;
        }
      } else {
        silenceStart = Date.now();
      }
      
      requestAnimationFrame(checkAudio);
    };
    
    checkAudio();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      if (autoStart) {
        handleVoiceActivityDetection(stream);
      }
      
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await handleAudioTranscription(audioBlob);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      // Request data every second instead of waiting for stop
      recorder.start(1000);
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleAudioTranscription = async (audioBlob) => {
    setIsProcessing(true);
    
    try {
      // Create file object 
      const audioFile = new File([audioBlob], 'recording.webm', {
        type: 'audio/webm',
        lastModified: Date.now()
      });

      const formData = new FormData();
      formData.append('audio', audioFile);

      const response = await axios.post(
        `${config.serverUrl}/transcribe-audio`,
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
      console.error('Error transcribing audio:', error);
      alert('Failed to transcribe audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Define pulse animation
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
      <IconButton
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isProcessing || (autoStart && !isRecording)}
        sx={{
          width: { xs: 56, sm: 64 },   
          height: { xs: 56, sm: 64 },
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
            fontSize: { xs: '2rem', sm: '2.5rem' },   
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
    </Box>
  );
}

export default VoiceInput; 