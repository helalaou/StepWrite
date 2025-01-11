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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

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
        // Reset everything after the edited index
        conversationPlanningToSubmit.questions = conversationPlanningToSubmit.questions
          .slice(0, changedIndex + 1)
          .map((q, idx) => {
            if (idx === changedIndex) {
              return { ...q, response: answer };
            }
            return q;
          });
        
        // Create a completely new status object with only statuses up to changedIndex
        const newStatus = {};
        Object.keys(questionStatus).forEach(key => {
          const index = parseInt(key);
          if (index < changedIndex) {
            newStatus[index] = questionStatus[index];
          }
        });
        
        // Only add status for the currently edited question
        newStatus[changedIndex] = {
          type: answer === "user has skipped this question" ? 'skipped' : 'answered',
          answer: answer
        };
        
        // Set the new clean status object
        setQuestionStatus(newStatus);
        
        // Reset input appropriately
        if (currentQuestionIndex !== changedIndex) {
          setInput('');
        } else {
          setInput(answer);
        }
        
        conversationPlanningToSubmit.followup_needed = true;
        setFinalOutput('');

        // Also update the conversation history to match the new state
        if (conversationHistory) {
          setConversationHistory({
            conversationPlanning: conversationPlanningToSubmit,
            questionStatus: newStatus
          });
        }
      }

      const response = await axios.post(`${config.serverUrl}/submit-answer`, {
        conversationPlanning: conversationPlanningToSubmit,
        changedIndex,
        answer
      });

      if (!response.data.followup_needed) {
        setFinalOutput(response.data.output);
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
          followup_needed: response.data.followup_needed
        };

      
        //  Cleanup statuses for truncated or newly added questions
        const newQuestionStatus = { ...questionStatus };

        // 1. Remove statuses for any questions that no longer exist
        Object.keys(newQuestionStatus).forEach((key) => {
          const idx = parseInt(key, 10);
          if (idx >= updatedPlanning.questions.length) {
            delete newQuestionStatus[idx];
          }
        });

        // 2. Ensure that brand-new question indexes are set to undefined
        updatedPlanning.questions.forEach((_, index) => {
          if (!newQuestionStatus.hasOwnProperty(index)) {
            newQuestionStatus[index] = undefined;
          }
        });

        setConversationPlanning(updatedPlanning);
        setQuestionStatus(newQuestionStatus);
        
        // Update conversation history with current state
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
    if (conversationHistory) {
      // Restore the entire conversation planning as it was
      setConversationPlanning({
        ...conversationHistory.conversationPlanning,
        followup_needed: true
      });
      
      // Restore all question statuses as they were
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
      
      // Set current question index to the last question instead of 0
      const lastQuestionIndex = conversationHistory.conversationPlanning.questions.length - 1;
      setCurrentQuestionIndex(lastQuestionIndex);
      
      // Set input to the last question's response
      const lastQuestion = conversationHistory.conversationPlanning.questions[lastQuestionIndex];
      setInput(lastQuestion?.response || '');
      
      // Clear the final output when going back to questions
      setFinalOutput('');
    }
  };

  const handleAnswerClick = (currentIndex) => {
    // If skipped, immediately switch to answering mode
    if (questionStatus[currentIndex]?.type === 'skipped') {
      setInput(''); // Clear the "user has skipped this question" message
      setQuestionStatus({
        ...questionStatus,
        [currentIndex]: { 
          type: 'answering',
          answer: '' 
        }
      });
      return;
    }

    // If already answered, switch to editing mode
    if (questionStatus[currentIndex]?.type === 'answered') {
      setQuestionStatus({
        ...questionStatus,
        [currentIndex]: { 
          type: 'answering',
          answer: questionStatus[currentIndex].answer 
        }
      });
      return;
    }

    // Remove any subsequent question statuses
    const updatedQuestionStatus = { ...questionStatus };
    Object.keys(updatedQuestionStatus).forEach((key) => {
      if (parseInt(key) > currentIndex) {
        delete updatedQuestionStatus[key];
      }
    });

    // Set current question to answering state
    setQuestionStatus({
      ...updatedQuestionStatus,
      [currentIndex]: { 
        type: 'answering',
        answer: questionStatus[currentIndex]?.answer || input 
      }
    });
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
    currentQuestionIndex,
    setCurrentQuestionIndex,
  };
}
