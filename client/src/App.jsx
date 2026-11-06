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
import ParticipantIdInput from './components/ParticipantIdInput';
import SettingsButton from './components/SettingsButton';
import SettingsDialog from './components/SettingsDialog';
import { useSettings } from './components/SettingsProvider';
import config from './config';
import { useEffect, useState } from 'react';
import axios from 'axios';

// Write and reply share one flow. Reply additionally starts from the message
// being replied to (config.core.reply_email) and asks the server for the
// first question, since it depends on that message.
function ConversationFlow({ mode }) {
  const [showIdInput, setShowIdInput] = useState(
    config.experiment.enabled && config.experiment.participantIdRequired
  );
  
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
  } = useChatLogic(mode);

  // Read so that a change of input mode in Settings re-renders the flow
  const { settings } = useSettings();
  const isHandsFree = settings.inputMode === 'HANDS_FREE';

  // Reply mode: set the message being replied to as context and fetch the first question
  useEffect(() => {
    if (mode !== 'reply' || showIdInput) return;
    
    const setupReplyFlow = async () => {
      const emailTemplate = config.core.reply_email;
      setContext(emailTemplate);
      
      let initialQuestion = "How would you like to respond to this text?";
      try {
        setIsLoading(true);
        const response = await axios.post(`${config.core.apiUrl}${config.core.endpoints.initialReplyQuestion}`, {
          originalText: emailTemplate
        });
        initialQuestion = response.data.question || "How would you like to respond to this message?";
      } catch (error) {
        console.error('Failed to fetch initial question:', error);
      } finally {
        setIsLoading(false);
      }

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
    };
    
    setupReplyFlow();
  }, [mode, setContext, setConversationPlanning, setIsLoading, showIdInput]);

  // Submit a first-time answer to the question at questionIndex. There is no
  // changedIndex, so the server treats it as new rather than as an edit.
  const handleSendMessage = (questionIndex, updatedConversationPlanning, isFinishCommand = false) => {
    const question = updatedConversationPlanning.questions[questionIndex];
    return submitAnswer(
      question.id,
      question.response,
      undefined,
      updatedConversationPlanning,
      isFinishCommand
    );
  };

  // If participant ID input is shown, don't show the rest of the interface
  if (showIdInput) {
    return <ParticipantIdInput onSubmit={() => setShowIdInput(false)} mode={mode} />;
  }

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
      conversationPlanning={conversationPlanning}
    />
  ) : isHandsFree ? (
    <HandsFreeInterface
      mode={mode}
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
      mode={mode}
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

function App() {
  return (
    <Router>
      <SettingsButton />
      <SettingsDialog />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/write" element={<ConversationFlow key="write" mode="write" />} />
        <Route path="/reply" element={<ConversationFlow key="reply" mode="reply" />} />
        {/* Temporarily disabled edit route
        <Route path="/edit" element={<EditFlow />} />
        */}
      </Routes>
    </Router>
  );
}

export default App;
