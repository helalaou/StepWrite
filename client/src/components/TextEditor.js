import React, { useState, useCallback } from 'react';
import { Box, TextField, Button, Typography, IconButton, Tooltip } from '@mui/material';
import WestIcon from '@mui/icons-material/West';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import FormatLineSpacingIcon from '@mui/icons-material/FormatLineSpacing';
import TextIncreaseIcon from '@mui/icons-material/TextIncrease';
import TextDecreaseIcon from '@mui/icons-material/TextDecrease';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

function TextEditor({ initialContent, onBack }) {
  // Track content history for undo/redo
  const [contentHistory, setContentHistory] = useState([initialContent]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [content, setContent] = useState(initialContent);
  const [oneSentencePerLine, setOneSentencePerLine] = useState(false);
  // Store original format to restore it correctly
  const [originalFormat, setOriginalFormat] = useState(initialContent);
  const [fontSize, setFontSize] = useState(1.2); // 1.1rem is our default size
  const [copySuccess, setCopySuccess] = useState(false);

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

  const handleIncreaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 0.1, 2.0)); // Max size 2.0rem
  };

  const handleDecreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 0.1, 0.8)); // Min size 0.8rem
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopySuccess(true);
      // Reset success icon after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
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

      {/* Main Content Area */}
      <Box sx={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        paddingLeft: { xs: '120px', sm: '140px' },
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        position: 'relative',
      }}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          Text Editor
        </Typography>

        {/* Text Editor Container */}
        <Box sx={{ 
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <Box sx={{ 
            position: 'relative',
            flex: 1,
            '& .MuiTextField-root': {
              height: '100%',
            }
          }}>
            <TextField
              multiline
              fullWidth
              minRows={20}
              maxRows={40}
              value={content}
              onChange={handleContentChange}
              sx={{
                '& .MuiInputBase-root': {
                  height: '100%',
                  '& textarea': {
                    height: '100% !important',
                    fontSize: `${fontSize}rem`,
                    lineHeight: '1.5',
                    padding: '20px',
                  }
                }
              }}
            />

            {/* Bottom Controls */}
            <Box sx={{ 
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              right: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: '4px 8px',
              borderRadius: '4px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              zIndex: 1,
            }}>
              {/* Left side controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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

                {/* Font Size Controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Tooltip title="Decrease font size">
                    <span>
                      <IconButton
                        onClick={handleDecreaseFontSize}
                        size="small"
                        disabled={fontSize <= 0.8}
                      >
                        <TextDecreaseIcon />
                      </IconButton>
                    </span>
                  </Tooltip>

                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'text.secondary',
                      minWidth: '32px',
                      textAlign: 'center'
                    }}
                  >
                    {Math.round(fontSize * 10) / 10}x
                  </Typography>

                  <Tooltip title="Increase font size">
                    <span>
                      <IconButton
                        onClick={handleIncreaseFontSize}
                        size="small"
                        disabled={fontSize >= 2.0}
                      >
                        <TextIncreaseIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>

                <Box sx={{ 
                  height: '20px', 
                  width: '1px', 
                  backgroundColor: 'divider' 
                }} />

                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Words: {getWordCount(content)}
                </Typography>
              </Box>

              {/* Right side controls */}
              <Box sx={{ 
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <Tooltip title={copySuccess ? 'Copied!' : 'Copy to clipboard'}>
                  <IconButton
                    onClick={handleCopyToClipboard}
                    size="small"
                    color={copySuccess ? 'success' : 'default'}
                    sx={{
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {copySuccess ? <CheckIcon /> : <ContentCopyIcon />}
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default TextEditor; 