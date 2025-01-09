import OpenAI from 'openai';
import dotenv from 'dotenv';
import config from './config.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: config.openai.timeout,
});

export async function generateQuestion(conversationPlanning) {
  const prompt = `
You are an assistant helping a person with cognitive disabilities who struggles with complex information and benefits from clear, simple language and step-by-step guidance.

Given the conversation planning JSON and the current state of the conversation, generate the next relevant question to ask the user. 

Guidelines:
- If sufficient context has been collected, set "followup_needed" to false
- If a question was skipped, do not repeat it
- Keep questions simple, clear, and directly relevant
- Use previous responses to inform the next question
- Minimize the number of questions while getting necessary information
- Use one short sentence at a time
- For attachments, ask if they want to mention any in the final output

Return JSON format:
{
  "question": "your question here",
  "followup_needed": boolean
}

Conversation Planning: ${JSON.stringify(conversationPlanning)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.question_generation_settings.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.question_generation_settings.maxTokens,
      temperature: config.openai.question_generation_settings.temperature,
    });

    const { question, followup_needed } = JSON.parse(completion.choices[0].message.content.trim());
    
    const updatedConversationPlanning = {
      ...conversationPlanning,
      questions: [
        ...conversationPlanning.questions,
        {
          id: conversationPlanning.questions.length + 1,
          question,
          response: ''
        }
      ],
      followup_needed
    };

    return { question, conversationPlanning: updatedConversationPlanning };
  } catch (error) {
    console.error('Failed to generate question:', error);
    throw error;
  }
}

export async function generateOutput(conversationPlanning) {
  const prompt = `
Generate a coherent, simple response based on the collected information in the conversation planning JSON.

Guidelines:
- Use clear, concise language suitable for cognitive disabilities
- Break down information into logical steps if needed
- Keep sentences short and simple
- Focus on directly addressing the key points
- Use collected information to write the requested content (email, letter, report, etc.)

Conversation Planning: ${JSON.stringify(conversationPlanning)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.output_generation_settings.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.output_generation_settings.maxTokens,
      temperature: config.openai.output_generation_settings.temperature,
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Failed to generate output:', error);
    throw error;
  }
} 