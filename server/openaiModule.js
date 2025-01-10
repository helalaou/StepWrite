import OpenAI from 'openai';
import dotenv from 'dotenv';
import config from './config.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: config.openai.timeout,
});

export async function generateQuestion(conversationPlanning) {
  // convert JSON to Q&A format
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = `
You are text editing tool that helps people with cognitive disabilities who struggles with complex information and benefits from clear, simple language and step-by-step guidance.
Your sole task is to collect information from the user that would help in writing the final output. You do not do anything else.

Given the conversation history and the current state of the conversation, generate the next relevant question to ask the user. 

Previous conversation:
${qaFormat}

Guidelines:
- Break down broad topics into very specific, single-focus questions
- Each question should focus on getting ONE piece of information only
- Keep questions short - ideally under 10 words
- Pay attention to the context, for example, don't ask for full names if its a casual context, but do ask for full names if its a professional context
- Avoid technical terms or jargon - Use familiar, everyday language
- Avoid using possessive form - use "what is your name?" instead of "what's your name?"
- Avoid questions that require complex reasoning or comparing multiple things
- Avoid asking questions that are already answered in the conversation history
- Avoid asking questions that the user has marked as skipped

For writing tasks (emails, letters, etc):
- Don't ask about greetings, closings, or formatting - use standard professional formats
- Focus on getting the key information: who, what, when, where, why
- Ask specific questions like "What is the recipient's name?" or "What date is this for?"
- For dates, ask "What day of the week?" and "What time?" separately
- Break location questions into: street number, street name, city, etc.

Examples of good questions:
❌ "What greeting would you like to use?"
✅ "What is the recipient's first name?"

❌ "Tell me about the problem"
✅ "When did you first notice the issue?"
✅ "What exactly isn't working?"

❌ "What would you like to say?"
✅ "What is the main thing you need from them?"

- If sufficient context has been collected, set "followup_needed" to false
- Don't repeat skipped questions - move on to other specific questions
- Before asking each question, review previous responses to maintain context
- For attachments, ask "What files need to be mentioned in this message?"
- if the user skipped 6 questions in a row, set "followup_needed" to false

Return JSON format:
{
  "question": "your question here",
  "followup_needed": boolean
}

if the "followup_needed" is false, return:
{
  "question": "",
  "followup_needed": false
}
`

  console.log('\n=== SENDING TO OPENAI (Question Generation) ===');
  console.log('Prompt:', prompt);
  console.log('================================================\n');

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.question_generation_settings.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.question_generation_settings.maxTokens,
      temperature: config.openai.question_generation_settings.temperature,
    });

    console.log('\n=== OPENAI RESPONSE (Question Generation) ===');
    console.log('Raw response:', completion.choices[0].message.content);
    console.log('============================================\n');

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
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = `
Generate a coherent, simple response based on the collected information from the conversation.

Previous conversation:
${qaFormat}

Guidelines:
- Use clear, concise language suitable for cognitive disabilities
- Break down information into logical steps if needed
- Keep sentences short and simple
- Focus on directly addressing the key points
- Use collected information to write the requested content (email, letter, report, etc.)
`;

  console.log('\n=== SENDING TO OPENAI (Output Generation) ===');
  console.log('Prompt:', prompt);
  console.log('=============================================\n');

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.output_generation_settings.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.output_generation_settings.maxTokens,
      temperature: config.openai.output_generation_settings.temperature,
    });

    const output = completion.choices[0].message.content.trim();
    
    console.log('\n=== OPENAI RESPONSE (Output Generation) ===');
    console.log('Generated output:', output);
    console.log('==========================================\n');

    return output;
  } catch (error) {
    console.error('Failed to generate output:', error);
    throw error;
  }
} 