import React, { useState } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

function TextEditor({ initialContent, onBack }) {
  const [content, setContent] = useState(initialContent);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%'
    }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        mb: 3,
        gap: 2
      }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          variant="outlined"
        >
          Back to Questions
        </Button>
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
  );
}

export default TextEditor; 