import React, { useState } from 'react';
import './App.css';
import { Container, Box, Typography, Button } from '@mui/material';
import ChatInterface from './components/ChatInterface';
import { useChatLogic } from './hooks/useChatLogic';
import logo from './logo.png';

function App() {
  const {
    conversationPlanning,
    input,
    setInput,
    isLoading,
    output,
    submitAnswer,
  } = useChatLogic();

  const [isStarted, setIsStarted] = useState(false);

  const handleStart = () => {
    setIsStarted(true);
  };

  return (
    <Container maxWidth="xl" disableGutters>
      <Box className="chat-container">
        <Box className="header">
          <Box className="logo" sx={{ display: 'flex', alignItems: 'center' }}>
            <img src={logo} alt="Icon" style={{ width: '50px', height: '63px', marginRight: '0px' }} />
            <span>Gen<span style={{ color: '#a12614' }}>Assist</span></span>
          </Box>
        </Box>
        {!isStarted ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <Button variant="contained" color="primary" size="large" onClick={handleStart}>
              Start
            </Button>
          </Box>
        ) : (
          <>
            <ChatInterface
              currentQuestion={conversationPlanning}
              input={input}
              setInput={setInput}
              isLoading={isLoading}
              sendMessage={submitAnswer}
            />
            {output && (
              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom>
                  Final Output:
                </Typography>
                <Typography variant="body1">{output}</Typography>
              </Box>
            )}
          </>
        )}
        <Box className="footer" sx={{ p: 2, borderTop: 1, borderColor: 'grey.300', backgroundColor: 'white' }}>
          <Typography variant="body2" color="text.secondary" align="center">
            tbd foooter
          </Typography>
        </Box>
      </Box>
    </Container>
  );
}

export default App;
