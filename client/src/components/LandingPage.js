import React from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CreateIcon from '@mui/icons-material/Create';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ReplyIcon from '@mui/icons-material/Reply';

function LandingPage() {
  const navigate = useNavigate();

  const handleWriteClick = () => {
    navigate('/write');
  };

  const handleReplyClick = () => {
    navigate('/reply');
  };

  const handleEditClick = () => {
    navigate('/edit');
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
          padding: '20px',
          '&:hover': {
            flex: 1.2,
            bgcolor: 'primary.light',
            '& .MuiTypography-h2, & .MuiTypography-body1': {
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
          fontSize: '5rem', 
          mb: 3,
          transition: 'all 0.3s ease',
          color: 'primary.main',
        }} />
        <Typography 
          variant="h2" 
          sx={{ 
            fontSize: { xs: '2.5rem', sm: '3.5rem' },
            fontWeight: 'bold',
            color: 'primary.main',
            transition: 'all 0.3s ease',
            mb: 3,
            textAlign: 'center',
          }}
        >
          START NEW
        </Typography>
        <Typography
          variant="body1"
          align="center"
          sx={{
            fontSize: '1.4rem',
            color: 'text.primary',
            transition: 'all 0.3s ease',
            maxWidth: '80%',
            lineHeight: 1.4,
          }}
        >
          Write a new text from scratch
        </Typography>
      </Box>

      {/* Divider */}
      <Box sx={{ width: '2px', bgcolor: 'grey.300', height: '100%' }} />

      {/* Reply Section (formerly Write with Context) */}
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
          padding: '20px',
          '&:hover': {
            flex: 1.2,
            bgcolor: '#2e7d32',
            '& .MuiTypography-h2, & .MuiTypography-body1': {
              color: 'white',
            },
            '& .MuiSvgIcon-root': {
              transform: 'scale(1.1)',
              color: 'white',
            },
          },
        }}
        onClick={handleReplyClick}
      >
        <ReplyIcon sx={{ 
          fontSize: '5rem', 
          mb: 3,
          transition: 'all 0.3s ease',
          color: '#1b5e20',
        }} />
        <Typography 
          variant="h2" 
          sx={{ 
            fontSize: { xs: '2.5rem', sm: '3.5rem' },
            fontWeight: 'bold',
            color: '#1b5e20',
            transition: 'all 0.3s ease',
            mb: 3,
            textAlign: 'center',
          }}
        >
          REPLY
        </Typography>
        <Typography
          variant="body1"
          align="center"
          sx={{
            fontSize: '1.4rem',
            color: 'text.primary',
            transition: 'all 0.3s ease',
            maxWidth: '80%',
            lineHeight: 1.4,
          }}
        >
          Reply to a text you have received
        </Typography>
      </Box>

      {/* Divider */}
      <Box sx={{ width: '2px', bgcolor: 'grey.300', height: '100%' }} />

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
          padding: '20px',
          '&:hover': {
            flex: 1.2,
            bgcolor: 'secondary.light',
            '& .MuiTypography-h2, & .MuiTypography-body1': {
              color: 'white',
            },
            '& .MuiSvgIcon-root': {
              transform: 'scale(1.1)',
              color: 'white',
            },
          },
        }}
        onClick={handleEditClick}
      >
        <EditNoteIcon sx={{ 
          fontSize: '5rem', 
          mb: 3,
          transition: 'all 0.3s ease',
          color: 'secondary.main',
        }} />
        <Typography 
          variant="h2" 
          sx={{ 
            fontSize: { xs: '2.5rem', sm: '3.5rem' },
            fontWeight: 'bold',
            color: 'secondary.main',
            transition: 'all 0.3s ease',
            mb: 3,
            textAlign: 'center',
          }}
        >
          EDIT
        </Typography>
        <Typography
          variant="body1"
          align="center"
          sx={{
            fontSize: '1.4rem',
            color: 'text.primary',
            transition: 'all 0.3s ease',
            maxWidth: '80%',
            lineHeight: 1.4,
          }}
        >
          Change or improve a text you have
        </Typography>
      </Box>
    </Box>
  );
}

export default LandingPage; 