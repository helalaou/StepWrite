import React from 'react';
import ChatInterface from './components/ChatInterface';
import TextEditor from './components/TextEditor';
import { useChatLogic } from './hooks/useChatLogic';

function App() {
  const {
    conversationPlanning,
    input,
    setInput,
    isLoading,
    showEditor,
    finalOutput,
    submitAnswer,
    handleBackToQuestions,
    questionStatus,
    setQuestionStatus
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
      {showEditor ? (
        <TextEditor 
          initialContent={finalOutput}
          onBack={handleBackToQuestions}
        />
      ) : (
        <ChatInterface
          currentQuestion={conversationPlanning}
          input={input}
          setInput={setInput}
          isLoading={isLoading}
          sendMessage={handleSendMessage}
          submitAnswer={submitAnswer}
          questionStatus={questionStatus}
          setQuestionStatus={setQuestionStatus}
        />
      )}
    </div>
  );
}

export default App;
