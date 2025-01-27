import { useState } from 'react';
import axios from 'axios';
import config from '../config.js';

export function useEditLogic() {
  const [originalText, setOriginalText] = useState('');
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
      const response = await axios.post(`${config.serverUrl}/submit-edit-answer`, {
        originalText,
        conversationPlanning: updatedConversationPlanning,
        changedIndex,
        answer
      });

      if (!response.data.followup_needed) {
        setFinalOutput(response.data.output);
        setShowEditor(true);
        return null;
      }

      if (response.data.conversationPlanning) {
        const updatedPlanning = {
          ...response.data.conversationPlanning,
          followup_needed: response.data.followup_needed
        };
        setConversationPlanning(updatedPlanning);
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
  };
} 