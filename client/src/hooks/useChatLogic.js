import { useState } from 'react';
import axios from 'axios';
import config from '../config.js';

export function useChatLogic(mode = 'write') {
  const [context, setContext] = useState('');
  const [conversationPlanning, setConversationPlanning] = useState({
    questions: [
      {
        id: 1,
        question: mode === 'write' ? 'What would you like to write?' : '',
        response: '', 
      },
    ],
    followup_needed: true,
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [finalOutput, setFinalOutput] = useState('');
  const [lastValidOutput, setLastValidOutput] = useState('');
  const [conversationHistory, setConversationHistory] = useState(null);
  const [questionStatus, setQuestionStatus] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);
  const [cameFromEditor, setCameFromEditor] = useState(false);
  const [currentEditorContent, setCurrentEditorContent] = useState('');
  const [editorPreferences, setEditorPreferences] = useState({
    fontSize: 1.3,
    oneSentencePerLine: false
  });
  const [editorHistory, setEditorHistory] = useState(null);

  // Add a question and its response to the conversationPlanning JSON
  const addQuestion = (question, response = '') => {
    if (!question) {
      console.error('Cannot add an empty question.');
      return;
    }
    setConversationPlanning((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          id: prev.questions.length + 1,
          question,
          response,
        },
      ],
    }));
  };

  // Edit a specific question's response and truncate any questions after it
  const editQuestion = (id, newResponse) => {
    setConversationPlanning((prev) => {
      const updatedQuestions = prev.questions.map((q) =>
        q.id === id ? { ...q, response: newResponse } : q
      );
      const truncatedQuestions = updatedQuestions.filter((q) => q.id <= id);
      return {
        ...prev,
        questions: truncatedQuestions,
        followup_needed: true,
      };
    });
  };

  const submitAnswer = async (questionId, answer, changedIndex, updatedConversationPlanning, isFinishCommand = false) => {
    setIsLoading(true);
    try {
      let conversationPlanningToSubmit = { ...updatedConversationPlanning };
      
      // If this is explicitly coming from a finish command, respect the followup_needed flag
      if (conversationPlanningToSubmit.followup_needed === false || isFinishCommand) {
        // For finish command, always ensure these are set
        conversationPlanningToSubmit.followup_needed = false;
      } else if (typeof changedIndex === 'number') {
        const originalAnswer = conversationHistory?.conversationPlanning?.questions[changedIndex]?.response;
        const hasChanged = originalAnswer !== answer;
        
        if (hasChanged) {
          setHasChanges(true);
          setCurrentEditorContent('');
          setEditorPreferences({
            fontSize: 1.3,
            oneSentencePerLine: false
          });
          
          // Update only the changed answer - let backend handle dependency analysis
          conversationPlanningToSubmit.questions = conversationPlanningToSubmit.questions
            .map((q, idx) => idx === changedIndex ? { ...q, response: answer } : q);
          
          conversationPlanningToSubmit.followup_needed = true;
          setFinalOutput('');
        }

        if (conversationHistory) {
          setConversationHistory({
            conversationPlanning: conversationPlanningToSubmit,
            questionStatus: questionStatus
          });
        }
      }

      const endpoint = config.core.endpoints.write;
      const payload = {
        conversationPlanning: conversationPlanningToSubmit,
        changedIndex,
        answer,
        isFinishCommand
      };

      // Add context for reply mode
      if (mode === 'reply' && context) {
        payload.context = context;
      }

      const response = await axios.post(`${config.core.apiUrl}${endpoint}`, payload);

      //iff this is a finish command or no followup needed, calculate writing time
      if (isFinishCommand || !response.data.followup_needed) {
        // Calculate writing time
        const writingStartTime = parseInt(sessionStorage.getItem('writingStartTime') || '0', 10);
        const writingTimeTotal = parseInt(sessionStorage.getItem('writingTimeTotal') || '0', 10);
        
        if (writingStartTime > 0) {
          const currentWritingTime = Math.floor((Date.now() - writingStartTime) / 1000);
          sessionStorage.setItem('writingTimeTotal', (writingTimeTotal + currentWritingTime).toString());
          //reset writing start time
          sessionStorage.removeItem('writingStartTime');
          
          //start tracking revision time
          sessionStorage.setItem('revisionStartTime', Date.now().toString());
          console.log('Starting revision time tracking');
        }
      }

      // If this is a finish command, always transition to editor regardless of response
      if (isFinishCommand) {
        const newOutput = response.data.output || '';
        setFinalOutput(newOutput);
        setLastValidOutput(newOutput);
        setShowEditor(true);
        setConversationHistory({ 
          conversationPlanning: conversationPlanningToSubmit, 
          questionStatus: questionStatus 
        });
        setConversationPlanning(prev => ({
          ...prev,
          followup_needed: false
        }));
        return null;
      }

      const needsFollowup = !!response.data.followup_needed;

      if (!needsFollowup) {
        const newOutput = response.data.output;
        setFinalOutput(newOutput);
        setLastValidOutput(newOutput);
        setShowEditor(true);
        setConversationHistory({ 
          conversationPlanning: conversationPlanningToSubmit, 
          questionStatus: questionStatus 
        });
        setConversationPlanning(prev => ({
          ...prev,
          followup_needed: false
        }));
        return null;
      }

      // Backend has performed intelligent dependency analysis
      // Update UI state with the filtered conversation planning
      if (response.data.conversationPlanning) {
        const updatedPlanning = {
          ...response.data.conversationPlanning,
          followup_needed: needsFollowup
        };

        // Clean up question status for questions that were removed by dependency analysis
        const newQuestionStatus = { ...questionStatus };
        Object.keys(newQuestionStatus).forEach((key) => {
          if (parseInt(key, 10) >= updatedPlanning.questions.length) {
            delete newQuestionStatus[key];
          }
        });

        setConversationPlanning(updatedPlanning);
        setQuestionStatus(newQuestionStatus);
        setConversationHistory({ 
          conversationPlanning: updatedPlanning, 
          questionStatus: newQuestionStatus
        });

        // Update current question index if it's beyond the remaining questions
        if (currentQuestionIndex >= updatedPlanning.questions.length) {
          setCurrentQuestionIndex(Math.max(0, updatedPlanning.questions.length - 1));
        }

        return updatedPlanning.questions.length;
      }
      
      return null;
    } catch (error) {
      console.error('Error submitting answer:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToQuestions = () => {
    setShowEditor(false);
    setHasChanges(false);
    setCameFromEditor(true);
    
    // Calculate revision time and save it
    const revisionStartTime = parseInt(sessionStorage.getItem('revisionStartTime') || '0', 10);
    const revisionTimeTotal = parseInt(sessionStorage.getItem('revisionTimeTotal') || '0', 10);
    
    if (revisionStartTime > 0) {
      const currentRevisionTime = Math.floor((Date.now() - revisionStartTime) / 1000);
      sessionStorage.setItem('revisionTimeTotal', (revisionTimeTotal + currentRevisionTime).toString());
      // Reset revision start time
      sessionStorage.removeItem('revisionStartTime');
      
      // Start tracking writing time again
      sessionStorage.setItem('writingStartTime', Date.now().toString());
      console.log('Starting writing time tracking again');
    }
    
    if (conversationHistory) {
      setConversationPlanning({
        ...conversationHistory.conversationPlanning,
        followup_needed: true
      });
      
      const restoredStatus = {};
      conversationHistory.conversationPlanning.questions.forEach((question, index) => {
        if (question.response) {
          restoredStatus[index] = {
            type: question.response === "user has skipped this question" ? 'skipped' : 'answered',
            answer: question.response
          };
        }
      });
      
      setQuestionStatus(restoredStatus);
      const lastQuestionIndex = conversationHistory.conversationPlanning.questions.length - 1;
      setCurrentQuestionIndex(lastQuestionIndex);
      setInput(conversationHistory.conversationPlanning.questions[lastQuestionIndex]?.response || '');
    }
  };

  const handleBackToEditor = () => {
    setShowEditor(true);
    
    // Stop writing time tracking and start revision time tracking
    const writingStartTime = parseInt(sessionStorage.getItem('writingStartTime') || '0', 10);
    const writingTimeTotal = parseInt(sessionStorage.getItem('writingTimeTotal') || '0', 10);
    
    if (writingStartTime > 0) {
      const currentWritingTime = Math.floor((Date.now() - writingStartTime) / 1000);
      sessionStorage.setItem('writingTimeTotal', (writingTimeTotal + currentWritingTime).toString());
      // Reset writing start time
      sessionStorage.removeItem('writingStartTime');
      
      // Start tracking revision time
      sessionStorage.setItem('revisionStartTime', Date.now().toString());
      console.log('Starting revision time tracking again');
    }
    
    // Check if there's a background draft available and we have minimum questions answered
    const answeredQuestions = conversationPlanning.questions?.filter(q => 
      q.response && q.response.trim() && q.response !== "user has skipped this question"
    ) || [];
    const hasMinimumQuestions = answeredQuestions.length >= config.continuousDrafts.minimumQuestionsForDraft;
    
    if (conversationPlanning.backgroundDraft && conversationPlanning.backgroundDraft.content && hasMinimumQuestions) {
      setFinalOutput(conversationPlanning.backgroundDraft.content);
      if (!editorHistory) {
        setEditorHistory([conversationPlanning.backgroundDraft.content]);
      }
    } else if (!hasChanges && currentEditorContent) {
      setFinalOutput(currentEditorContent);
      if (!editorHistory) {
        setEditorHistory([currentEditorContent]);
      }
    } else if (!hasChanges && lastValidOutput) {
      setFinalOutput(lastValidOutput);
      if (!editorHistory) {
        setEditorHistory([lastValidOutput]);
      }
    }
    if (hasChanges) {
      setEditorPreferences({
        fontSize: 1.3,
        oneSentencePerLine: false
      });
      setEditorHistory(null);
    }
  };

  return {
    context,
    setContext,
    conversationPlanning,
    setConversationPlanning,
    input,
    setInput,
    isLoading,
    setIsLoading,
    showEditor,
    setShowEditor,
    finalOutput,
    conversationHistory,
    questionStatus,
    setQuestionStatus,
    submitAnswer,
    handleBackToQuestions,
    addQuestion,
    editQuestion,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    hasChanges,
    setHasChanges,
    cameFromEditor,
    setCameFromEditor,
    handleBackToEditor,
    currentEditorContent,
    setCurrentEditorContent,
    editorPreferences,
    setEditorPreferences,
    editorHistory,
    setEditorHistory,
  };
}
