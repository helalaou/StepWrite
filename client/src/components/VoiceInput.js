import React, { useState, useEffect, useCallback } from 'react';
import { IconButton, Box, Typography, CircularProgress } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import axios from 'axios';
import config from '../config';
import { keyframes } from '@mui/system';

function VoiceInput({ 
  onTranscriptionComplete, 
  disabled = false,
  autoStart = config.input.mode === 'HANDS_FREE',
  showStopButton = config.input.mode === 'HANDS_FREE'
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAudioTranscription = useCallback(async (audioBlob) => {
    setIsProcessing(true);
    try {
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());
      const rawData = audioBuffer.getChannelData(0);
      
      //1. calculate noise statistics from the entire recording
      const amplitudes = rawData.map(Math.abs);
      const sortedAmplitudes = [...amplitudes].sort((a, b) => a - b);
      
      // get noise floor (using lowest 20% of samples)
      const noiseFloorIndex = Math.floor(sortedAmplitudes.length * 0.2);
      const noiseFloor = sortedAmplitudes[noiseFloorIndex];
      
      //get median amplitude
      const medianAmplitude = sortedAmplitudes[Math.floor(sortedAmplitudes.length * 0.5)];
      
      // Calculate percentage of samples that are likely noise
      const percentNoise = (amplitudes.filter(a => a <= noiseFloor * 2).length / amplitudes.length) * 100;
      
      console.log(`Audio stats:
        Noise floor: ${noiseFloor.toFixed(4)}
        Median amplitude: ${medianAmplitude.toFixed(4)}
        Noise percentage: ${percentNoise.toFixed(1)}%`);

      // if most of the recording is at noise level, reject it
      if (percentNoise > config.voiceInput.noiseReduction.maxNoisePercent) {
        console.log('Recording is mostly noise, skipping transcription');
        setIsProcessing(false);
        return;
      }

      // (2°). Clean the audio
      const cleanedData = rawData.map(sample => {
        const amplitude = Math.abs(sample);
        
        // Strong noise gate
        if (amplitude < noiseFloor * config.voiceInput.noiseReduction.floorMultiplier) {
          return 0;
        }
        
        // Apply noise reduction
        const scaledSample = sample * (1 - (noiseFloor / amplitude));
        return scaledSample;
      });

      // 3. Check if we have enough significant sound after cleaning
      const significantSamples = cleanedData.filter(sample => 
        Math.abs(sample) > config.voiceInput.recording.volumeThreshold
      ).length;
      
      const percentSignificant = (significantSamples / cleanedData.length) * 100;
      
      console.log(`After cleaning:
        Significant samples: ${percentSignificant.toFixed(1)}% (threshold: ${config.voiceInput.noiseReduction.minSignificantPercent}%)`);

      if (percentSignificant < config.voiceInput.noiseReduction.minSignificantPercent) {
        console.log('Not enough significant audio detected - less than 15% of samples contain speech');
        setIsProcessing(false);
        return;
      }

      // Create a new audio buffer with cleaned data
      const cleanedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      cleanedBuffer.getChannelData(0).set(cleanedData);

      // Convert cleaned buffer back to blob
      const cleanedBlob = await new Promise(resolve => {
        const mediaStreamDestination = audioContext.createMediaStreamDestination();
        const source = audioContext.createBufferSource();
        source.buffer = cleanedBuffer;
        source.connect(mediaStreamDestination);
        source.start();

        const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);
        const chunks = [];

        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: 'audio/webm' }));

        mediaRecorder.start();
        source.addEventListener('ended', () => mediaRecorder.stop());
      });

      // we create file object with cleaned audio
      const audioFile = new File([cleanedBlob], 'recording.webm', {
        type: 'audio/webm',
        lastModified: Date.now()
      });

      const formData = new FormData();
      formData.append('audio', audioFile);

      //we send cleaned audio to server
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
      if (!(error instanceof RangeError)) {
        console.error('Error processing audio:', error);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [onTranscriptionComplete]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
        audioBitsPerSecond: config.voiceInput.recording.audioBitsPerSecond,
      });
      
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { 
          type: 'audio/webm; codecs=opus'
        });
        
        if (audioBlob.size > 0) {
          await handleAudioTranscription(audioBlob);
        }
        
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check your permissions.');
    }
  }, [handleAudioTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  }, [mediaRecorder]);

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
      <IconButton
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isProcessing || (autoStart && !isRecording)}
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