import React, { useState, useCallback } from 'react';
import { Box, TextField, Button, Typography, IconButton, Tooltip } from '@mui/material';
import WestIcon from '@mui/icons-material/West';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import FormatLineSpacingIcon from '@mui/icons-material/FormatLineSpacing';

function TextEditor({ initialContent, onBack }) {
  // Track content history for undo/redo
  const [contentHistory, setContentHistory] = useState([initialContent]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [content, setContent] = useState(initialContent);
  const [oneSentencePerLine, setOneSentencePerLine] = useState(false);
  // Store original format to restore it correctly
  const [originalFormat, setOriginalFormat] = useState(initialContent);

  // Word counter function
  const getWordCount = useCallback((text) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }, []);

  const formatToOneSentencePerLine = (text) => {
    return text
      // First preserve paragraphs by marking them
      .replace(/\n\s*\n/g, '\n[PARAGRAPH]\n')
      // Split sentences, keeping punctuation
      .replace(/([.!?])\s+/g, '$1\n\n')  // Add double newline after .!? followed by space
      .replace(/([.!?])([^.\s\n])/g, '$1\n\n$2')  // Add double newline if period is followed by non-period char
      // Restore paragraphs with extra spacing
      .replace(/\[PARAGRAPH\]/g, '\n\n')
      // Clean up any excessive newlines
      .replace(/\n{3,}/g, '\n\n');
  };

  const formatToNormal = (text) => {
    // Simply return to the original format instead of trying to reconstruct it
    return originalFormat;
  };

  const handleToggleFormat = () => {
    if (!oneSentencePerLine) {
      // When enabling one-sentence-per-line, store current format
      setOriginalFormat(content);
      const newContent = formatToOneSentencePerLine(content);
      setContent(newContent);
    } else {
      // When disabling, restore original format
      setContent(formatToNormal(content));
    }
    
    setOneSentencePerLine(!oneSentencePerLine);
    
    // Add to history
    const newHistory = contentHistory.slice(0, currentIndex + 1);
    setContentHistory([...newHistory, content]);
    setCurrentIndex(currentIndex + 1);
  };

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    if (!oneSentencePerLine) {
      setOriginalFormat(newContent);
    }
    
    // Add new content to history, removing any future redos
    const newHistory = contentHistory.slice(0, currentIndex + 1);
    setContentHistory([...newHistory, newContent]);
    setCurrentIndex(currentIndex + 1);
  };

  const handleUndo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setContent(contentHistory[currentIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (currentIndex < contentHistory.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setContent(contentHistory[currentIndex + 1]);
    }
  };

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
        paddingLeft: { xs: '120px', sm: '140px' },
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        position: 'relative', // Added for absolute positioning of bottom controls
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
          onChange={handleContentChange}
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

        {/* Bottom Controls */}
        <Box sx={{ 
          position: 'absolute',
          bottom: 40,
          left: { xs: '120px', sm: '140px' },
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          backgroundColor: 'background.paper',
          padding: '8px',
          borderRadius: '4px',
          boxShadow: 1,
        }}>
          {/* Undo/Redo Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Undo last change">
              <span>
                <IconButton 
                  onClick={handleUndo} 
                  disabled={currentIndex === 0}
                  size="small"
                >
                  <UndoIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Redo last change">
              <span>
                <IconButton 
                  onClick={handleRedo} 
                  disabled={currentIndex === contentHistory.length - 1}
                  size="small"
                >
                  <RedoIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <Box sx={{ 
            height: '20px', 
            width: '1px', 
            backgroundColor: 'divider' 
          }} />

          {/* One Sentence Per Line Toggle */}
          <Tooltip title={`${oneSentencePerLine ? 'Disable' : 'Enable'} one sentence per line`}>
            <IconButton
              onClick={handleToggleFormat}
              size="small"
              color={oneSentencePerLine ? 'primary' : 'default'}
              sx={{
                transition: 'all 0.2s ease',
                transform: oneSentencePerLine ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              <FormatLineSpacingIcon />
            </IconButton>
          </Tooltip>

          <Box sx={{ 
            height: '20px', 
            width: '1px', 
            backgroundColor: 'divider' 
          }} />

          {/* Word Counter */}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Words: {getWordCount(content)}
          </Typography>
        </Box>

        {/* Save Button */}
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