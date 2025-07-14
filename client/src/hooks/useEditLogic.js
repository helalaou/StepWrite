import { useState } from 'react';
import axios from 'axios';
import config from '../config.js';

export function useEditLogic() {
  const [originalText, setOriginalText] = useState('');
  const [editedText, setEditedText] = useState('');
  const [conversationPlanning, setConversationPlanning] = useState({
    questions: [
      {
        id: 1,
        question: 'What would you like to change?',
        response: '',
      },
    ],
    followup_needed: true,
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [finalOutput, setFinalOutput] = useState('');
  const [questionStatus, setQuestionStatus] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const submitAnswer = async (questionId, answer, changedIndex, updatedConversationPlanning) => {
    setIsLoading(true);
    try {
      // send the full conversation planning to backend for intelligent dependency analysis
      const response = await axios.post(`${config.core.apiUrl}/submit-edit-answer`, {
        originalText,
        conversationPlanning: updatedConversationPlanning,
        changedIndex,
        answer
      });

      if (response.data.editedText) {
        setEditedText(response.data.editedText);
      }

      // Handle the followup_needed flag from the server response
      const needsFollowup = !!response.data.followup_needed;

      if (!needsFollowup) {
        setFinalOutput(response.data.output);
        setShowEditor(true);
        return null;
      }

      // backend has performed intelligent dependency analysis
      // we uppdate UI state with the filtered conversation planning
      if (response.data.conversationPlanning) {
        const updatedPlanning = {
          ...response.data.conversationPlanning,
          followup_needed: needsFollowup
        };
        
        // clean up question status for questions that were removed by dependency analysis
        const newQuestionStatus = { ...questionStatus };
        Object.keys(newQuestionStatus).forEach((key) => {
          if (parseInt(key, 10) >= updatedPlanning.questions.length) {
            delete newQuestionStatus[key];
          }
        });
        
        setConversationPlanning(updatedPlanning);
        setQuestionStatus(newQuestionStatus);
        
        // here wee update current question index if it'ss beyond the remaining questions
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
  };

  return {
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
    setEditedText,
  };
} 