// import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import ChatInterface from './components/ChatInterface';
import TextEditor from './components/TextEditor';
import { useChatLogic } from './hooks/useChatLogic';
// import EditTextInput from './components/EditTextInput';
// import { useEditLogic } from './hooks/useEditLogic';
// import SplitScreenEdit from './components/SplitScreenEdit';
import ReplyInput from './components/ReplyInput';

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
    originalText, 
    setOriginalText,
    conversationPlanning,
    input,
    setInput,
    isLoading,
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

  const handleSendMessage = async (changedIndex, updatedConversationPlanning) => {
    try {
      const result = await chatLogic.submitAnswer(
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
    return <ReplyInput onSubmit={setOriginalText} />;
  }

  return showEditor ? (
    <TextEditor 
      initialContent={finalOutput}
      onBack={handleBackToQuestions}
      onContentChange={setCurrentEditorContent}
      savedContent={currentEditorContent}
      editorPreferences={editorPreferences}
      onPreferencesChange={setEditorPreferences}
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
