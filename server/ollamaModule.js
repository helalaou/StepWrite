import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the OpenAI client using the API key from the environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: parseInt(process.env.OPENAI_TIMEOUT, 10) || 60000, // Optional timeout from env or default to 60 seconds
});

export async function generateQuestion(conversationPlanning) {
  const prompt = `
Given the conversation planning JSON and the current state of the conversation, generate the next relevant question to ask the user. 
- If sufficient context has been collected to proceed with generating the final output, set "followup_needed" to false and do not generate additional questions. 
- Ensure the question is simple, clear, and directly relevant to completing the task.
- Use the previous responses and the initial request to inform the next question. 
- If a clarification is needed, focus on resolving ambiguity or filling gaps in the collected information.
- Return ONLY a JSON object with two fields:
  - "question": the next question to ask
  - "followup_needed": boolean indicating if more questions are needed

You are an assistant helping a person with cognitive disabilities who struggles with complex information and benefits from clear, simple language and step-by-step guidance.

Conversation Planning: ${JSON.stringify(conversationPlanning)}

Response:`;

  try {
    console.log('Generating question with prompt:', prompt);
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });
    const responseText = completion.choices[0].message.content.trim();
    console.log('Generated response:', responseText);

    const { question, followup_needed } = JSON.parse(responseText);
    
    // Build the updated conversation planning
    const updatedConversationPlanning = {
      ...conversationPlanning,
      questions: [
        ...conversationPlanning.questions,
        {
          id: conversationPlanning.questions.length + 1,
          question: question,
          response: ''
        }
      ],
      followup_needed
    };

    return { question, conversationPlanning: updatedConversationPlanning };
  } catch (error) {
    console.error('Error generating question:', error.message);
    throw error;
  }
}

export async function generateOutput(conversationPlanning) {
  const prompt = `Given the collected information in the conversation planning JSON, generate a coherent, simple response to satisfy the user's initial request. 
- Use clear, concise language that is easy for someone with cognitive disabilities to understand.
- Break down the information into logical steps if needed.
- Focus on directly addressing the key points of the initial request.

Conversation Planning: ${JSON.stringify(conversationPlanning)}

Final Output:`;

  try {
    console.log('Generating output with prompt:', prompt);
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });
    const responseText = completion.choices[0].message.content.trim();
    console.log('Generated output:', responseText);

    return responseText;
  } catch (error) {
    console.error('Error generating output:', error.message);
    throw error;
  }
}
