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
      let conversationPlanningToSubmit = { ...updatedConversationPlanning };
      
      if (typeof changedIndex === 'number') {
        // Update the response for the changed question and truncate subsequent questions
        conversationPlanningToSubmit.questions = conversationPlanningToSubmit.questions
          .slice(0, changedIndex + 1)
          .map((q, idx) => {
            if (idx === changedIndex) {
              return { ...q, response: answer };
            }
            return q;
          });
        
        // Clear all question statuses after the edited index (including the edited index)
        const updatedStatus = {};
        Object.keys(questionStatus).forEach(key => {
          const index = parseInt(key);
          if (index < changedIndex) {
            updatedStatus[index] = questionStatus[index];
          }
        });
        
        // Add the new status only for the edited question
        updatedStatus[changedIndex] = {
          type: answer === "user has skipped this question" ? 'skipped' : 'answered',
          answer: answer
        };
        
        setQuestionStatus(updatedStatus);
        
        // Force followup_needed to true when editing a response
        conversationPlanningToSubmit.followup_needed = true;

        // Clear the final output when editing a question
        setFinalOutput('');
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
      
      // Clear UI state for all questions after the edited index
      const updatedQuestionStatus = { ...initialStatus };
      Object.keys(updatedQuestionStatus).forEach(key => {
        const index = parseInt(key);
        if (index > conversationHistory.conversationPlanning.questions.length - 1) {
          delete updatedQuestionStatus[key];
        }
      });
      
      setQuestionStatus(updatedQuestionStatus);
      setInput(conversationHistory.conversationPlanning.questions[0].response || '');
      
      // Reset the conversation planning to continue asking questions
      setConversationPlanning(prev => ({
        ...prev,
        followup_needed: true
      }));

      // Clear the final output when going back to questions
      setFinalOutput('');
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
