// import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import ChatInterface from './components/ChatInterface';
import TextEditor from './components/TextEditor';
import { useChatLogic } from './hooks/useChatLogic';
// import EditTextInput from './components/EditTextInput';
// import { useEditLogic } from './hooks/useEditLogic';
// import SplitScreenEdit from './components/SplitScreenEdit';
import HandsFreeInterface from './components/HandsFreeInterface';
import config from './config';
import { useEffect } from 'react';
import axios from 'axios';

function WriteFlow() {
  const chatLogic = useChatLogic('write');
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
    setQuestionStatus,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    hasChanges,
    cameFromEditor,
    handleBackToEditor,
    currentEditorContent,
    setCurrentEditorContent,
    editorPreferences,
    setEditorPreferences,
    editorHistory,
    setEditorHistory
  } = chatLogic;

  // Add voice-only mode check
  const isHandsFree = config.input.mode === 'HANDS_FREE';

  const handleSendMessage = async (changedIndex, updatedConversationPlanning, isFinishCommand = false) => {
    try {
      const result = await submitAnswer(
        updatedConversationPlanning.questions[changedIndex].id, 
        input,
        changedIndex,
        updatedConversationPlanning,
        isFinishCommand
      );
      return result;
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      throw error;
    }
  };

  return showEditor ? (
    <TextEditor 
      initialContent={finalOutput}
      onBack={handleBackToQuestions}
      onContentChange={setCurrentEditorContent}
      savedContent={currentEditorContent}
      editorPreferences={editorPreferences}
      onPreferencesChange={setEditorPreferences}
      savedHistory={editorHistory}
      onHistoryChange={setEditorHistory}
    />
  ) : isHandsFree ? (
    <HandsFreeInterface
      mode="write"
      currentQuestion={conversationPlanning}
      setInput={setInput}
      submitAnswer={submitAnswer}
      sendMessage={handleSendMessage}
      questionStatus={questionStatus}
      setQuestionStatus={setQuestionStatus}
      currentQuestionIndex={currentQuestionIndex}
      setCurrentQuestionIndex={setCurrentQuestionIndex}
      hasChanges={hasChanges}
      onBackToEditor={handleBackToEditor}
      cameFromEditor={cameFromEditor}
    />
  ) : (
    <ChatInterface
      mode="write"
      currentQuestion={conversationPlanning}
      input={input}
      setInput={setInput}
      isLoading={isLoading}
      sendMessage={handleSendMessage}
      submitAnswer={submitAnswer}
      questionStatus={questionStatus}
      setQuestionStatus={setQuestionStatus}
      currentQuestionIndex={currentQuestionIndex}
      setCurrentQuestionIndex={setCurrentQuestionIndex}
      hasChanges={hasChanges}
      onBackToEditor={handleBackToEditor}
      cameFromEditor={cameFromEditor}
    />
  );
}

/* Temporarily disabled EditFlow
function EditFlow() {
  const {
    originalText,
    setOriginalText,
    conversationPlanning,
    input,
    setInput,
    isLoading,
    submitAnswer,
    questionStatus,
    setQuestionStatus,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    editedText,
    setEditedText
  } = useEditLogic();

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

  if (!originalText) {
    return <EditTextInput onSubmit={setOriginalText} />;
  }

  return (
    <SplitScreenEdit
      originalText={originalText}
      currentQuestion={conversationPlanning}
      input={input}
      setInput={setInput}
      isLoading={isLoading}
      sendMessage={handleSendMessage}
      submitAnswer={submitAnswer}
      questionStatus={questionStatus}
      setQuestionStatus={setQuestionStatus}
      currentQuestionIndex={currentQuestionIndex}
      setCurrentQuestionIndex={setCurrentQuestionIndex}
      editedText={editedText}
      setEditedText={setEditedText}
    />
  );
}
*/

function ReplyFlow() {
  const chatLogic = useChatLogic('reply');
  const { 
    setContext,
    conversationPlanning,
    setConversationPlanning,
    input,
    setInput,
    isLoading,
    setIsLoading,
    showEditor,
    finalOutput,
    handleBackToQuestions,
    questionStatus,
    setQuestionStatus,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    hasChanges,
    handleBackToEditor,
    cameFromEditor,
    currentEditorContent,
    setCurrentEditorContent,
    editorPreferences,
    setEditorPreferences
  } = chatLogic;

  // Add voice-only mode check
  const isHandsFree = config.input.mode === 'HANDS_FREE';

  // Set the static email as context when component mounts and fetch initial question
  useEffect(() => {
    const setupReplyFlow = async () => {
      const emailContext = config.core.reply_email;
      setContext(emailContext);
      
      try {
        setIsLoading(true);
        const response = await axios.post(`${config.core.apiUrl}${config.core.endpoints.initialReplyQuestion}`, {
          originalText: emailContext
        });
        
        // Set the initial question from the API response
        const initialQuestion = response.data.question || "How would you like to respond to this message?";
        
        setConversationPlanning(prev => ({
          ...prev,
          questions: [
            {
              id: 1,
              question: initialQuestion,
              response: ''
            }
          ]
        }));
      } catch (error) {
        console.error('Failed to fetch initial question:', error);
        // Fallback to a default question if API call fails
        setConversationPlanning(prev => ({
          ...prev,
          questions: [
            {
              id: 1,
              question: "How would you like to respond to this text?",
              response: ''
            }
          ]
        }));
      } finally {
        setIsLoading(false);
      }
    };
    
    setupReplyFlow();
  }, [setContext, setConversationPlanning, setIsLoading]);

  const handleSendMessage = async (changedIndex, updatedConversationPlanning, isFinishCommand = false) => {
    try {
      const result = await chatLogic.submitAnswer(
        updatedConversationPlanning.questions[changedIndex].id, 
        input,
        changedIndex,
        updatedConversationPlanning,
        isFinishCommand
      );
      return result;
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      throw error;
    }
  };

  return showEditor ? (
    <TextEditor 
      initialContent={finalOutput}
      onBack={handleBackToQuestions}
      onContentChange={setCurrentEditorContent}
      savedContent={currentEditorContent}
      editorPreferences={editorPreferences}
      onPreferencesChange={setEditorPreferences}
    />
  ) : isHandsFree ? (
    <HandsFreeInterface
      mode="reply"
      currentQuestion={conversationPlanning}
      setInput={setInput}
      submitAnswer={chatLogic.submitAnswer}
      sendMessage={handleSendMessage}
      questionStatus={questionStatus}
      setQuestionStatus={setQuestionStatus}
      currentQuestionIndex={currentQuestionIndex}
      setCurrentQuestionIndex={setCurrentQuestionIndex}
      hasChanges={hasChanges}
      onBackToEditor={handleBackToEditor}
      cameFromEditor={cameFromEditor}
    />
  ) : (
    <ChatInterface
      mode="reply"
      currentQuestion={conversationPlanning}
      input={input}
      setInput={setInput}
      isLoading={isLoading}
      sendMessage={handleSendMessage}
      submitAnswer={chatLogic.submitAnswer}
      questionStatus={questionStatus}
      setQuestionStatus={setQuestionStatus}
      currentQuestionIndex={currentQuestionIndex}
      setCurrentQuestionIndex={setCurrentQuestionIndex}
      hasChanges={hasChanges}
      onBackToEditor={handleBackToEditor}
      cameFromEditor={cameFromEditor}
    />
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/write" element={<WriteFlow />} />
        <Route path="/reply" element={<ReplyFlow />} />
        {/* Temporarily disabled edit route
        <Route path="/edit" element={<EditFlow />} />
        */}
      </Routes>
    </Router>
  );
}

export default App;
