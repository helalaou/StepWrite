import React, { useState, forwardRef } from 'react';
import { Button, CircularProgress } from '@mui/material';
import axios from 'axios';
import config from '../config';
import { playClickSound } from '../utils/soundUtils';

const ExperimentEndButton = forwardRef(({ content, textOutput }, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleEndExperiment = async () => {
    if (!config.experiment.enabled) {
      alert('Experiment tracking is disabled');
      return;
    }

    playClickSound();
    
    const participantId = sessionStorage.getItem('participantId');
    if (!participantId) {
      alert('No participant ID found. Cannot save experiment data.');
      return;
    }

    const experimentMode = sessionStorage.getItem('experimentMode') || 'write';
    const modifyCount = parseInt(sessionStorage.getItem('modifyCount') || '0', 10);
    const skipCount = parseInt(sessionStorage.getItem('skipCount') || '0', 10);
    
    try {
      setIsLoading(true);
      
      const response = await axios.post(`${config.core.apiUrl}${config.core.endpoints.saveExperimentData}`, {
        participantId,
        mode: experimentMode,
        modifyCount,
        skipCount,
        textOutput: textOutput || content,
        finalOutput: content
      });
      
      if (response.data.success) {
        setIsSaved(true);
        alert('Experiment data saved successfully! Thank you for participating.');
      } else {
        throw new Error('Server returned success: false');
      }
    } catch (error) {
      console.error('Failed to save experiment data:', error);
      alert('Failed to save experiment data. Please try again or contact the researcher.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Button 
      ref={ref}
      variant="contained"
      color="primary"
      onClick={handleEndExperiment}
      disabled={isLoading || isSaved || !config.experiment.enabled}
      sx={{ 
        mt: 2,
        mb: 2,
        minWidth: '180px',
        height: '50px',
        fontWeight: 'bold',
        boxShadow: 3,
        '&:hover': {
          boxShadow: 5,
        }
      }}
    >
      {isLoading ? <CircularProgress size={24} /> : isSaved ? 'Saved!' : 'End Experiment'}
    </Button>
  );
});

export default ExperimentEndButton; 