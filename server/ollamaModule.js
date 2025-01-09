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

You are an assistant helping a person with cognitive disabilities who struggles with complex information and benefits from clear, simple language and step-by-step guidance.
Given the conversation planning JSON and the current state of the conversation, generate the next relevant question to ask the user. 
- If sufficient context has been collected to proceed with generating the final output, set "followup_needed" to false and do not generate additional questions. 
- If the user has skipped a question, DO NOT ask that specific question again. Instead, proceed to ask other questions to extract other information that could be helpful to generating the final output.
- Ensure the question is simple, clear, and directly relevant to completing the task.
- Use the previous responses and the initial request to inform the next question. 
- If a clarification is needed, focus on resolving ambiguity or filling gaps in the collected information.
- Try to minimize the number of questions you ask while still getting all the necessary information to produce the final output.
- Before every question generation, make sure that you read the previous questions and responses and that you understand the whole context of the conversation.
- Do not ask the user for confirmation about the final draft.
- Use one short sentence at a time when asking for information and if need be, ask for clarification in a subsequent question.
- For attachments, since the user can't upload them into this writing assistant tool, you can ask the user if they want mention any attachments in the final output (email, letter, etc), then you can ask other questions about the attachments if necessary in followup questions.
- Return ONLY a JSON object with two fields:
  - "question": the next question to ask
  - "followup_needed": boolean indicating if more questions are needed (true if more questions are needed, false if the final output is ready to be generated)
Conversation Planning: ${JSON.stringify(conversationPlanning)}

Response:`;

  try {
    console.log('Generating question with prompt:', prompt);
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: prompt},
      ],
      max_tokens: 5000,
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
  const prompt = `Given the collected information in the conversation planning JSON, generate a coherent, simple response to satisfy the user's request (whether its writing an email, a letter, a report, a document, etc). Use the collected information to write that for them.
- Use clear, concise language that is easy for someone with cognitive disabilities to understand.
- Break down the information into logical steps if needed.
- Keep the questions concise as the person you are helping has cognitive disabilities and benefits from concise language and short questions, meaning you can't ask them to do a lot at once, but you can ask them to do one thing at a time.
- Focus on directly addressing the key points of the initial request.
- Use one short sentence at a time when asking for information and if need be, ask for clarification in a subsequent question.
Conversation Planning: ${JSON.stringify(conversationPlanning)}

Final Output:`;

  try {
    console.log('Generating output with prompt:', prompt);
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: prompt },
      ],
      max_tokens: 5000,
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
