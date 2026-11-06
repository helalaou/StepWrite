import React from 'react';
import { Box } from '@mui/material';
import { keyframes } from '@mui/system';

const speechAnimation = keyframes`
  0% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
  100% { transform: scaleY(0.3); }
`;

function AudioVisualizer({ isSpeechDetected }) {
  const numBars = 20;
  const bars = Array(numBars).fill(0);

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0.5,
      height: '60px',
      width: '100%',
      maxWidth: '300px',
      margin: '0 auto'
    }}>
      {bars.map((_, i) => (
        <Box
          key={i}
          sx={{
            width: '4px',
            height: '100%',
            backgroundColor: 'primary.main',
            borderRadius: '2px',
            animation: isSpeechDetected ? `${speechAnimation} ${0.3 + Math.random() * 0.2}s infinite` : 'none',
            animationDelay: `${i * 0.03}s`,
            transform: 'scaleY(0.3)',
            opacity: isSpeechDetected ? 1 : 0.3,
            transition: 'opacity 0.1s ease',
          }}
        />
      ))}
    </Box>
  );
}

export default AudioVisualizer; 