import React from 'react';
import { Box, Typography } from '@mui/material';
import { useMessageLogic } from '../hooks/useMessageLogic';
import ReactMarkdown from 'react-markdown';

function Message({ text, sender, wordSpacing }) {
  const {
    sentences,
  } = useMessageLogic(text, null);

  const fontStyle = {
    wordSpacing: `${wordSpacing}px`,
  };

  return (
    <Box
      className={`message ${sender}`}
      sx={{
        whiteSpace: 'pre-wrap',
        marginBottom: 1,
        padding: 1,
        borderRadius: 2,
        maxWidth: '80%',
        alignSelf: sender === 'user' ? 'flex-end' : 'flex-start',
        backgroundColor: sender === 'user' ? 'primary.main' : 'grey.300',
        color: sender === 'user' ? 'white' : 'black',
        marginLeft: sender === 'user' ? 'auto' : '0',
        position: 'relative',
        ...fontStyle,
        '& p': {
          margin: 0,
          lineHeight: 1.2,
        },
        '& ul, & ol': {
          margin: '0.05em 0',
          padding: '0 1em',
          lineHeight: 1.2,
        },
        '& li': {
          margin: '0.05em 0',
          lineHeight: 1.2,
        },
        '& blockquote': {
          margin: '0.1em 0',
          lineHeight: 1.2,
        },
        '& h1, & h2, & h3, & h4': {
          margin: '0.05em 0',
          lineHeight: 1.2,
        },
      }}
    >
      {sender === 'llm' ? (
        <ReactMarkdown>
          {text}
        </ReactMarkdown>
      ) : (
        <Typography
          variant="body1"
          component="div"
          sx={{
            ...fontStyle,
            lineHeight: 1.2,
          }}
        >
          {sentences.map((sentence, index) => (
            <Box 
              key={index} 
              sx={{ 
                display: 'inline', 
                position: 'relative',
                transition: 'background-color 0.3s',
              }}
            >
              {sentence}
              {' '}
            </Box>
          ))}
        </Typography>
      )}
    </Box>
  );
}

export default Message;
