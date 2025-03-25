import { useState } from 'react';
import axios from 'axios';
import config from '../config.js';

export function useConversationLogic(mode = 'write', initialContext = '') {
  const [context, setContext] = useState(initialContext);
  const [conversationPlanning, setConversationPlanning] = useState({
    questions: [
      {
        id: 1,
        question: 'What would you like to write?',
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

  const submitAnswer = async (questionId, answer, changedIndex, updatedConversationPlanning) => {
    setIsLoading(true);
    try {
      let conversationPlanningToSubmit = { ...updatedConversationPlanning };
      
      if (typeof changedIndex === 'number') {
        const originalAnswer = conversationHistory?.conversationPlanning?.questions[changedIndex]?.response;
        const hasChanged = originalAnswer !== answer;
        
        if (hasChanged) {
          setHasChanges(true);
          setCurrentEditorContent('');
          setEditorPreferences({
            fontSize: 1.3,
            oneSentencePerLine: false
          });
          
          conversationPlanningToSubmit.questions = conversationPlanningToSubmit.questions
            .slice(0, changedIndex + 1)
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
        context,
        conversationPlanning: conversationPlanningToSubmit,
        changedIndex,
        answer
      };

      const response = await axios.post(`${config.core.apiUrl}${endpoint}`, payload);

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

      if (response.data.conversationPlanning) {
        const updatedPlanning = {
          ...response.data.conversationPlanning,
          followup_needed: needsFollowup
        };

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
    if (!hasChanges && currentEditorContent) {
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
    input,
    setInput,
    isLoading,
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
