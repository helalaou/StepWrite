import React, { useState } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';
import WestIcon from '@mui/icons-material/West';

function TextEditor({ initialContent, onBack }) {
  const [content, setContent] = useState(initialContent);

  return (
    <Box sx={{ 
      display: 'flex',
      height: '100vh',
      position: 'relative',
    }}>
      {/* Back to Questions Button */}
      <Box sx={{
        position: 'fixed',
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'background.paper',
        borderTopRightRadius: '8px',
        borderBottomRightRadius: '8px',
        boxShadow: 2,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-50%) translateX(5px)',
          boxShadow: 4,
        }
      }}>
        <Button
          variant="contained"
          onClick={onBack}
          sx={{ 
            height: '60px',
            borderTopRightRadius: '8px',
            borderBottomRightRadius: '8px',
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            paddingLeft: 3,
            paddingRight: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <WestIcon />
          Back to Questions
        </Button>
      </Box>

      {/* Main Content */}
      <Box sx={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        paddingLeft: { xs: '120px', sm: '140px' }, // Add space for the button
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mb: 3,
          gap: 2
        }}>
          <Typography variant="h4">
            Edit Your Content
          </Typography>
        </Box>

        <TextField
          multiline
          fullWidth
          minRows={20}
          maxRows={40}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          sx={{
            flex: 1,
            '& .MuiInputBase-root': {
              height: '100%',
              '& textarea': {
                height: '100% !important',
                fontSize: '1.1rem',
                lineHeight: '1.5',
                padding: '20px'
              }
            }
          }}
        />

        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: 2, 
          mt: 2 
        }}>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => {/* Add save functionality */}}
          >
            Save Changes
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default TextEditor; 