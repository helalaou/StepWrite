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
- If sufficient context has been collected to proceed with generating the final output, set "followup_needed" to false and do not generate additional questions. 
- If the user has skipped a question. Don't ask that specific question again. Instead, proceed to ask other questions to extract other information that could be helpful to generating the final output.
- Ensure the question is simple, clear, and directly relevant to completing the task.
- Use the previous responses and the initial request to inform the next question. 
- If a clarification is needed, focus on resolving ambiguity or filling gaps in the collected information.
- Try to minimize the number of questions you ask while still getting all the necessary information to produce the final output.
- Before every question generation, make sure that you read the previous questions and responses and that you understand the whole context of the conversation.
- Don't ask the user for confirmation about the final draft.
- Use one short sentence at a time when asking for information and if need be, ask for clarification in a subsequent question.
- For attachments, since the user can't upload them into this writing assistant tool, you can ask the user if they want mention any attachments in the final output (email, letter, etc), then you can ask other questions about the attachments if necessary in followup questions.

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

    const responseText = completion.choices[0].message.content.trim();
    console.log('Raw OpenAI response:', responseText);

    // Remove markdown code blocks if present
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    console.log('Cleaned response:', cleanedResponse);

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse cleaned response:', parseError);
      console.log('Attempting to fix response format...');
      
      // Fallback parsing logic
      const questionMatch = cleanedResponse.match(/"question"\s*:\s*"([^"]+)"/);
      const followupMatch = cleanedResponse.match(/"followup_needed"\s*:\s*(true|false)/);
      
      if (questionMatch && followupMatch) {
        parsedResponse = {
          question: questionMatch[1],
          followup_needed: followupMatch[1] === 'true'
        };
      } else {
        throw new Error('Could not parse response into required format');
      }
    }

    const { question, followup_needed } = parsedResponse;
    
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
    console.error('Error details:', error.message);
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

    const output = completion.choices[0].message.content.trim();
    console.log('\nGenerated final output:', output, '\n');
    return output;
  } catch (error) {
    console.error('Failed to generate output:', error);
    throw error;
  }
} 