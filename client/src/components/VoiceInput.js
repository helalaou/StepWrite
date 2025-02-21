import React, { useState, useEffect } from 'react';
import { IconButton, Box, Typography, CircularProgress } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import axios from 'axios';
import config from '../config';

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

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      py: 1
    }}>
      <IconButton
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isProcessing || (autoStart && !isRecording)}
        color={isRecording ? 'error' : 'primary'}
        sx={{
          width: { xs: 56, sm: 64 },   
          height: { xs: 56, sm: 64 },
          borderRadius: '50%',
          backgroundColor: theme => isRecording 
            ? 'error.light'
            : 'primary.light',
          '&:hover': {
            backgroundColor: theme => isRecording 
              ? 'error.main'
              : 'primary.main',
            transform: 'scale(1.1)',
          },
          '&:active': {
            transform: 'scale(0.95)',
          },
          transition: 'all 0.2s ease',
          '& .MuiSvgIcon-root': {
            fontSize: { xs: '2rem', sm: '2.5rem' },   
            color: 'white',
          },
          visibility: autoStart && !isRecording && !showStopButton ? 'hidden' : 'visible'
        }}
      >
        {isProcessing ? (
          <CircularProgress 
            size={32}
            sx={{ color: 'white' }}
          />
        ) : isRecording ? (
          <StopIcon />
        ) : (
          <MicIcon />
        )}
      </IconButton>
      {isRecording && (
        <Typography
          variant="body1"   
          color="error"
          sx={{ 
            animation: 'pulse 1.5s infinite',
            '@keyframes pulse': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.5 },
              '100%': { opacity: 1 },
            },
            fontSize: { xs: '1rem', sm: '1.1rem' },  
            fontWeight: 500,
            minWidth: 90   
          }}
        >
          Recording...
        </Typography>
      )}
    </Box>
  );
}

export default VoiceInput; 