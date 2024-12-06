import React from 'react';
import ChatInterface from './components/ChatInterface';
import { useChatLogic } from './hooks/useChatLogic';

function App() {
  const {
    conversationPlanning,
    input,
    setInput,
    isLoading,
    submitAnswer,
  } = useChatLogic();

  const handleSendMessage = async () => {
    return submitAnswer();
  };

  return (
    <div className="App">
      <ChatInterface
        currentQuestion={conversationPlanning}
        input={input}
        setInput={setInput}
        isLoading={isLoading}
        sendMessage={handleSendMessage}
        submitAnswer={submitAnswer}
      />
    </div>
  );
}

export default App;
