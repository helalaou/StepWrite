import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CreateIcon from '@mui/icons-material/Create';
import EditNoteIcon from '@mui/icons-material/EditNote';

function LandingPage() {
  const navigate = useNavigate();

  const handleWriteClick = () => {
    navigate('/write');
  };

  const handleEditClick = () => {
    alert('Edit flow coming soon!');
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Write Section */}
      <Box 
        sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.paper',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          '&:hover': {
            flex: 1.2,
            bgcolor: 'primary.light',
            '& .MuiTypography-h2': {
              color: 'white',
            },
            '& .MuiSvgIcon-root': {
              transform: 'scale(1.1)',
              color: 'white',
            },
          },
        }}
        onClick={handleWriteClick}
      >
        <CreateIcon sx={{ 
          fontSize: '4rem', 
          mb: 2,
          transition: 'all 0.3s ease',
          color: 'primary.main',
        }} />
        <Typography 
          variant="h2" 
          sx={{ 
            fontWeight: 'bold',
            color: 'primary.main',
            transition: 'all 0.3s ease',
          }}
        >
          WRITE
        </Typography>
      </Box>

      {/* Divider */}
      <Box sx={{ 
        width: '2px', 
        bgcolor: 'grey.300',
        height: '100%',
      }} />

      {/* Edit Section */}
      <Box 
        sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.paper',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          '&:hover': {
            flex: 1.2,
            bgcolor: 'grey.200',
            '& .MuiSvgIcon-root': {
              transform: 'scale(1.1)',
            },
          },
        }}
        onClick={handleEditClick}
      >
        <EditNoteIcon sx={{ 
          fontSize: '4rem', 
          mb: 2,
          transition: 'all 0.3s ease',
          color: 'text.primary',
        }} />
        <Typography 
          variant="h2" 
          sx={{ 
            fontWeight: 'bold',
            color: 'text.primary',
          }}
        >
          EDIT
        </Typography>
      </Box>
    </Box>
  );
}

export default LandingPage; 