import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import ChatInterface from './components/ChatInterface';
import TextEditor from './components/TextEditor';
import { useChatLogic } from './hooks/useChatLogic';
import EditTextInput from './components/EditTextInput';
import { useEditLogic } from './hooks/useEditLogic';
import SplitScreenEdit from './components/SplitScreenEdit';
import ReplyInput from './components/ReplyInput';
import { useReplyLogic } from './hooks/useReplyLogic';

function WriteFlow() {
  const {
    conversationPlanning,
    input,
    setInput,
    isLoading,
    showEditor,
    setShowEditor,
    finalOutput,
    submitAnswer,
    handleBackToQuestions,
    questionStatus,
    setQuestionStatus,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    hasChanges,
    setHasChanges,
    cameFromEditor,
    handleBackToEditor,
    currentEditorContent,
    setCurrentEditorContent,
    editorPreferences,
    setEditorPreferences
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

function EditFlow() {
  const {
    originalText,
    setOriginalText,
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

function ReplyFlow() {
  const {
    originalText,
    setOriginalText,
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
    setHasChanges
  } = useReplyLogic();

  const editorPreferences = {
    fontSize: 1.3,
    oneSentencePerLine: false
  };

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

  const handleBackToEditor = () => {
    if (!hasChanges) {
      setShowEditor(true);
    } else {
      alert("You can't go back to the editor because there are unsaved changes.");
    }
  };

  if (!originalText) {
    return <ReplyInput onSubmit={setOriginalText} />;
  }

  return showEditor ? (
    <TextEditor 
      initialContent={finalOutput}
      onBack={handleBackToQuestions}
      onContentChange={() => {}}
      savedContent={finalOutput}
      editorPreferences={editorPreferences}
      onPreferencesChange={() => {}}
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
      currentQuestionIndex={currentQuestionIndex}
      setCurrentQuestionIndex={setCurrentQuestionIndex}
      hasChanges={hasChanges}
      onBackToEditor={handleBackToEditor}
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
        <Route path="/edit" element={<EditFlow />} />
      </Routes>
    </Router>
  );
}

export default App;
