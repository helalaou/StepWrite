import { useState } from 'react';
import axios from 'axios';
import config from '../config.js';

export function useChatLogic() {
  const [conversationPlanning, setConversationPlanning] = useState({
    questions: [
      {
        id: 1,
        question: 'Please provide your initial request.',
        response: '', 
      },
    ],
    followup_needed: true,
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState('');

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

  // Fetch the next question or generate the final output from the server
  const fetchNextQuestion = async () => {
    try {
      const response = await axios.post(`${config.serverUrl}/submit-answer`, {
        conversationPlanning,
      });
      if (response.data.followup_needed && response.data.question) {
        setConversationPlanning(response.data.conversationPlanning);
      } else if (response.data.output) {
        console.log('Final output:', response.data.output);
        setOutput(response.data.output);
      } else {
        console.error('Unexpected server response:', response.data);
      }
    } catch (error) {
      console.error('Error fetching next question:', error);
    }
  };

  // Submit the user's response to a question
  const submitAnswer = async (questionId, newResponse = null) => {
    return new Promise(async (resolve, reject) => {
      if ((newResponse && newResponse.trim()) || input.trim()) {
        setIsLoading(true);
        try {
          const currentResponse = input.trim();
          const updatedConversationPlanning = {
            ...conversationPlanning,
            questions: conversationPlanning.questions.map((q) =>
              q.id === (questionId || conversationPlanning.questions.length) 
                ? { ...q, response: currentResponse } 
                : q
            ),
          };
          setConversationPlanning(updatedConversationPlanning);
          
          const response = await axios.post(`${config.serverUrl}/submit-answer`, {
            conversationPlanning: updatedConversationPlanning,
          });
          
          if (response.data.conversationPlanning) {
            setConversationPlanning(response.data.conversationPlanning);
            resolve(response.data.conversationPlanning.questions.length);
          } else {
            resolve(null);
          }
          setInput('');
        } catch (error) {
          console.error('Error submitting answer:', error);
          reject(error);
        } finally {
          setIsLoading(false);
        }
      } else {
        resolve(null);
      }
    });
  };

  return {
    conversationPlanning,
    input,
    setInput,
    isLoading,
    output,
    submitAnswer,
  };
}
