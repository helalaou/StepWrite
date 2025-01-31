import OpenAI from 'openai';
import dotenv from 'dotenv';
import config from './config.js';
import { writeQuestionPrompt, writeOutputPrompt } from './prompts/writePrompts.js';
import { editQuestionPrompt, editOutputPrompt } from './prompts/editPrompts.js';
import { classificationPrompt } from './prompts/classificationPrompt.js';
import { replyQuestionPrompt, replyOutputPrompt } from './prompts/replyPrompts.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: config.openai.timeout,
});

async function generateWriteQuestion(conversationPlanning) {
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = writeQuestionPrompt(qaFormat);

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

async function generateWriteOutput(conversationPlanning) {
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = writeOutputPrompt(qaFormat);

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

  const prompt = editQuestionPrompt(originalText, qaFormat);

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

  const prompt = editOutputPrompt(originalText, qaFormat);

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
  const prompt = classificationPrompt(text);

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.classification_settings.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Text to classify:\n${text}` }
      ],
      max_tokens: config.openai.classification_settings.maxTokens,
      temperature: config.openai.classification_settings.temperature,
    });

    const classification = completion.choices[0].message.content.trim().toLowerCase();
    
    if (!config.openai.classification_settings.validCategories.includes(classification)) {
      console.warn(`Unexpected classification: ${classification}, defaulting to "${config.openai.classification_settings.defaultCategory}"`);
      return config.openai.classification_settings.defaultCategory;
    }

    return classification;
  } catch (error) {
    console.error('Failed to classify text:', error);
    throw error;
  }
}

async function generateReplyQuestion(originalText, conversationPlanning) {
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = replyQuestionPrompt(originalText, qaFormat);

  console.log('\n=== SENDING TO OPENAI (Reply Question Generation) ===');
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
    console.error('Failed to generate reply question:', error);
    throw error;
  }
}

async function generateReplyOutput(originalText, conversationPlanning) {
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = replyOutputPrompt(originalText, qaFormat);

  console.log('\n=== SENDING TO OPENAI (Reply Output Generation) ===');
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
    console.log('Generated reply output:', output);
    return output;
  } catch (error) {
    console.error('Failed to generate reply output:', error);
    throw error;
  }
}

export {
  generateWriteQuestion,
  generateWriteOutput,
  generateEditQuestion,
  generateEditOutput,
  generateReplyQuestion,
  generateReplyOutput,
  classifyText
}; 
