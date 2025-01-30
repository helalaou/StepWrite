import OpenAI from 'openai';
import dotenv from 'dotenv';
import config from './config.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: config.openai.timeout,
});

async function generateQuestion(conversationPlanning) {
  // convert JSON to Q&A format
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

    const prompt = `
    You are a text editing tool that helps people with cognitive disabilities who struggle with complex information. 
    Your sole task is to collect information from the user that will help in writing the final output. 
    You do not do anything else.
    
    Given the conversation history and the current state of the conversation, generate the next relevant question to ask the user.
    
    Previous conversation:
    ${qaFormat}
    
    === GUIDELINES ===
    1. **Emphasize Context Sensitivity**
       - Always review the entire conversation history before asking a new question.
       - If the user already provided information (even indirectly), do not ask again.
    
    2. **Clarify the Role of the Tool**
       - You only ask questions that directly gather information needed for the final document or task.
       - You do not perform any actions beyond collecting the required details.
    
    3. **Break Down Broad Topics**
       - Each question should focus on a single piece of information.
       - Keep questions short—ideally under 10 words.
    
    4. **Guidance on Handling Partial or Indirect Answers**
       - If the user's response includes relevant details (even if it doesn't directly answer the question), extract that information so you don't need to re-ask for it.
    
    5. **Avoid Redundant or Unnecessary Questions**
       - If something is already answered in the conversation or marked as skipped, do not ask again.
    
    6. **Ask for Essential Details (Who, What, When, Where, Why)**
       - For writing tasks like emails or letters, do NOT ask about greetings, closings, or formatting—use standard professional formats.
       - Ask specific questions when needed (e.g., "What is the name of the recipient?").
    
    7. **Attachments**
       - For any files, ask: "What files need to be mentioned in this message?"
    
    8. **Skipping Questions**
       - If the user skips 6 questions in a row, set "followup_needed" to false.
    
    9. **If Sufficient Context Is Collected**
       - Once you have enough information, set "followup_needed" to false.
    
    10. **Examples of Good Questions**
       - ❌ "Tell me about the problem"
         ✅ "When did you first notice the issue?"
       - ❌ "What would you like to say?"
         ✅ "What is the main thing you need from them?"
       - ❌ "What's your name?'"
         ✅ "What is your name"
       - ❌ "What files need to be mentioned in this email?"
         ✅ "Are you going to attach any files to this email?"
    
    === OUTPUT FORMAT ===
    Return your result as valid JSON:
    
    {
      "question": "your question here",
      "followup_needed": boolean
    }
    
    - If "followup_needed" is false, return:
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

async function generateOutput(conversationPlanning) {
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

async function generateEditQuestion(originalText, conversationPlanning) {
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = `
You are a text editing assistant helping someone edit their text. The user can see their original text on the left side of the screen, and you're helping them make changes through a series of questions.

Original text to edit:
${originalText}

Previous conversation:
${qaFormat}

=== GUIDELINES FOR QUESTIONS ===
1. First Question:
   - Always start with "What would you like to change in this text?"
   - This helps identify the user's main concerns

2. Follow-up Questions:
   - After the user identifies what they want to change, ask specific questions about that part
   - If they mention a specific section, quote it and ask about the desired changes
   - Break down complex changes into simple steps

3. Question Types Based on Common Responses:
   - If user says "make it simpler": Ask "Which part is hard to understand?"
   - If user points to a section: Ask "How would you like to change this part?"
   - If user wants to add information: Ask "What information would you like to add?"
   - If user wants to remove something: Ask "Which part would you like to remove?"

4. Examples of Good Question Flow:
   User: "I want to make it simpler"
   Assistant: "Which part is difficult to understand? You can copy and paste the part from the text on the left."

   User: "This paragraph is too long"
   Assistant: "Would you like to: 1) Break it into smaller paragraphs, 2) Make it shorter, or 3) Both?"

   User: "I want to change the tone"
   Assistant: "Should the tone be: 1) More formal, 2) More friendly, or 3) More direct?"

5. Keep Questions:
   - Short and clear
   - Focused on one change at a time
   - Easy to understand
   - Related to specific parts of the text

=== OUTPUT FORMAT ===
Return your result as valid JSON:

{
  "question": "your question here",
  "followup_needed": boolean
}

- Set followup_needed to false when all necessary changes have been addressed
`;

  console.log('\n=== SENDING TO OPENAI (Edit Question Generation) ===');
  console.log('Prompt:', prompt);
  console.log('================================================\n');

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.question_generation_settings.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.question_generation_settings.maxTokens,
      temperature: config.openai.question_generation_settings.temperature,
    });

    const responseText = completion.choices[0].message.content.trim();
    console.log('Raw OpenAI response:', responseText);

    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    let parsedResponse;
    
    try {
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse cleaned response:', parseError);
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

    return parsedResponse;
  } catch (error) {
    console.error('Failed to generate edit question:', error);
    throw error;
  }
}

async function generateEditOutput(originalText, conversationPlanning) {
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = `
Edit the following text based on the user's requests. Make the text clearer and easier to understand while maintaining the original meaning.

Original text:
${originalText}

Editing instructions from conversation:
${qaFormat}

Guidelines:
- Make the text clearer and more concise
- Break down complex sentences
- Use simple language
- Maintain the original meaning
- Apply all the requested changes from the conversation
`;

  console.log('\n=== SENDING TO OPENAI (Edit Output Generation) ===');
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
    console.log('Generated edit output:', output);
    return output;
  } catch (error) {
    console.error('Failed to generate edit output:', error);
    throw error;
  }
}

async function classifyText(text) {
  const settings = config.openai.classification_settings;
  const prompt = `
You are a text classifier that categorizes input text into specific types.

=== CLASSIFICATION RULES ===
1. Analyze the text and classify it into ONE of these categories:
   - email
   - letter
   - message
   - other

2. Classification Guidelines:
   - "email": Contains email-specific elements like subject lines, email addresses, or digital correspondence format
   - "letter": Formal written correspondence with addresses, dates, or letter formatting
   - "message": Short informal communications, chat messages, or brief notes
   - "other": Any text that doesn't clearly fit the above categories

3. Return ONLY the category name as a single word, lowercase, no punctuation or explanation.

=== EXAMPLES ===
Input: "Dear Sir, I am writing to inquire about the position..."
Output: letter

Input: "Subject: Meeting Tomorrow\nHi Team,\nJust wanted to confirm..."
Output: email

Input: "Hey can you pick up milk on your way home?"
Output: message

Input: "Once upon a time in a galaxy far away..."
Output: other`;

  try {
    const completion = await openai.chat.completions.create({
      model: settings.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Text to classify:\n${text}` }
      ],
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
    });

    const classification = completion.choices[0].message.content.trim().toLowerCase();
    
    if (!settings.validCategories.includes(classification)) {
      console.warn(`Unexpected classification: ${classification}, defaulting to "${settings.defaultCategory}"`);
      return settings.defaultCategory;
    }

    return classification;
  } catch (error) {
    console.error('Failed to classify text:', error);
    throw error;
  }
}

export {
  generateQuestion,
  generateOutput,
  generateEditQuestion,
  generateEditOutput,
  classifyText
}; 
