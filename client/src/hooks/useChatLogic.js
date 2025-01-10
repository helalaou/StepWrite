import { useState } from 'react';
import axios from 'axios';
import config from '../config.js';

export function useChatLogic() {
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
  const [output, setOutput] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [finalOutput, setFinalOutput] = useState('');
  const [conversationHistory, setConversationHistory] = useState(null);
  const [questionStatus, setQuestionStatus] = useState({});

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

  // Submit the user's response to a question
  const submitAnswer = async (questionId, answer, changedIndex, updatedConversationPlanning, updatedQuestionStatus) => {
    setIsLoading(true);
    try {
      // If we're updating an existing answer, truncate subsequent questions
      let conversationPlanningToSubmit = { ...updatedConversationPlanning };
      
      if (typeof changedIndex === 'number') {
        // Update the response for the changed question
        conversationPlanningToSubmit.questions = conversationPlanningToSubmit.questions
          .slice(0, changedIndex + 1)
          .map((q, idx) => {
            if (idx === changedIndex) {
              return { ...q, response: answer };
            }
            return q;
          });
        
        // Force followup_needed to true when editing a response
        conversationPlanningToSubmit.followup_needed = true;
      }

      const response = await axios.post(`${config.serverUrl}/submit-answer`, {
        conversationPlanning: conversationPlanningToSubmit,
        changedIndex,
        answer
      });

      // Handle case where LLM decides no more questions are needed
      if (!response.data.followup_needed) {
        setFinalOutput(response.data.output);
        setShowEditor(true);
        setConversationHistory({ 
          conversationPlanning: conversationPlanningToSubmit, 
          questionStatus: updatedQuestionStatus || questionStatus 
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
          followup_needed: response.data.followup_needed
        };
        
        setConversationPlanning(updatedPlanning);
        setConversationHistory({ 
          conversationPlanning: updatedPlanning, 
          questionStatus: updatedQuestionStatus || questionStatus 
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
    if (conversationHistory) {
      setConversationPlanning(conversationHistory.conversationPlanning);
      
      const initialStatus = {};
      conversationHistory.conversationPlanning.questions.forEach((question, index) => {
        if (question.response) {
          initialStatus[index] = {
            type: question.response === "user has skipped this question" ? 'skipped' : 'answered',
            answer: question.response
          };
        }
      });
      
      setQuestionStatus(initialStatus);
      setInput(conversationHistory.conversationPlanning.questions[0].response || '');
      
      setConversationPlanning(prev => ({
        ...prev,
        followup_needed: true
      }));
    }
  };

  return {
    conversationPlanning,
    input,
    setInput,
    isLoading,
    output,
    showEditor,
    finalOutput,
    conversationHistory,
    questionStatus,
    setQuestionStatus,
    submitAnswer,
    handleBackToQuestions,
    addQuestion,
    editQuestion,
  };
}
