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

  const handleSendMessage = async (changedIndex, updatedConversationPlanning) => {
    try {
      const result = await submitAnswer(
        updatedConversationPlanning.questions[changedIndex].id, 
        input,
        changedIndex,
        updatedConversationPlanning
      );
      return result;
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      throw error;
    }
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
