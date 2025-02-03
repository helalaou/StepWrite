import OpenAI from 'openai';
import dotenv from 'dotenv';
import config from './config.js';
import { writeQuestionPrompt, writeOutputPrompt } from './prompts/writePrompts.js';
import { editQuestionPrompt, editOutputPrompt } from './prompts/editPrompts.js';
import { classificationPrompt } from './prompts/classificationPrompt.js';
import { replyQuestionPrompt, replyOutputPrompt } from './prompts/replyPrompts.js';
import { factCheckPrompt, factCorrectionPrompt } from './prompts/factCheckingPrompt.js';

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
      model: config.openai.write.question.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.write.question.maxTokens,
      temperature: config.openai.write.question.temperature,
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
      model: config.openai.write.output.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.write.output.maxTokens,
      temperature: config.openai.write.output.temperature,
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
      model: config.openai.edit.question.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.edit.question.maxTokens,
      temperature: config.openai.edit.question.temperature,
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
      model: config.openai.edit.output.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.edit.output.maxTokens,
      temperature: config.openai.edit.output.temperature,
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
      model: config.openai.classification.model,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Text to classify:\n${text}` }
      ],
      max_tokens: config.openai.classification.maxTokens,
      temperature: config.openai.classification.temperature,
    });

    const classification = completion.choices[0].message.content.trim().toLowerCase();
    
    if (!config.openai.classification.validCategories.includes(classification)) {
      console.warn(`Unexpected classification: ${classification}, defaulting to "${config.openai.classification.defaultCategory}"`);
      return config.openai.classification.defaultCategory;
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
      model: config.openai.reply.question.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.reply.question.maxTokens,
      temperature: config.openai.reply.question.temperature,
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
      model: config.openai.reply.output.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.reply.output.maxTokens,
      temperature: config.openai.reply.output.temperature,
    });

    const output = completion.choices[0].message.content.trim();
    console.log('Generated reply output:', output);
    return output;
  } catch (error) {
    console.error('Failed to generate reply output:', error);
    throw error;
  }
}

async function performFactCheck(qaFormat, output) {
  const prompt = factCheckPrompt(qaFormat, output);

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.factChecking.check.model,
      messages: [{ role: 'system', content: prompt }],
      temperature: config.openai.factChecking.check.temperature,
      max_tokens: config.openai.factChecking.check.maxTokens,
    });

    const responseText = completion.choices[0].message.content.trim();
    const parsedResponse = JSON.parse(responseText);

    console.log('\n=== FACT CHECK RESULTS ===');
    console.log('Passed:', parsedResponse.passed);
    console.log('Issues found:', parsedResponse.issues.length);
    console.log('========================\n');

    return parsedResponse;
  } catch (error) {
    console.error('Failed to perform fact check:', error);
    throw error;
  }
}

async function generateCorrection(qaFormat, output, issues) {
  const prompt = factCorrectionPrompt(qaFormat, output, issues);

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.factChecking.correction.model,
      messages: [{ role: 'system', content: prompt }],
      temperature: config.openai.factChecking.correction.temperature,
      max_tokens: config.openai.factChecking.correction.maxTokens,
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Failed to generate correction:', error);
    throw error;
  }
}

async function generateOutputWithFactCheck(conversationPlanning) {
  console.log('\n=== FACT CHECKING STATUS ===');
  if (!config.openai.factChecking.enabled) {
    console.log('❌ Fact checking is disabled in config');
    console.log('Generating output without fact checking...');
    console.log('==============================\n');
    return await generateWriteOutput(conversationPlanning);
  }
  
  console.log('✓ Fact checking is enabled');
  console.log(`Maximum attempts configured: ${config.openai.factChecking.maxAttempts}`);
  console.log('==============================\n');

  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}\nA: ${q.response}`)
    .join('\n\n');

  let attempts = 0;
  
  console.log('=== INITIAL OUTPUT GENERATION ===');
  let output = await generateWriteOutput(conversationPlanning);
  console.log('Initial output generated');
  console.log('==============================\n');

  while (attempts < config.openai.factChecking.maxAttempts) {
    attempts++;
    console.log(`\n=== FACT CHECK ATTEMPT ${attempts}/${config.openai.factChecking.maxAttempts} ===`);
    
    // Perform fact check
    const checkResult = await performFactCheck(qaFormat, output);

    if (checkResult.passed) {
      console.log('✓ Fact check passed!');
      console.log('No issues found in the generated content');
      console.log('==============================\n');
      return output;
    }

    console.log('\n❌ Fact check failed');
    console.log('Issues found:', checkResult.issues.length);
    checkResult.issues.forEach((issue, index) => {
      console.log(`\nIssue ${index + 1}:`);
      console.log(`Type: ${issue.type}`);
      console.log(`Detail: ${issue.detail}`);
      console.log(`Reference: ${issue.qa_reference}`);
    });

    if (attempts === config.openai.factChecking.maxAttempts) {
      console.log('\n⚠️ Maximum attempts reached');
      console.log('Using final correction attempt...');
    } else {
      console.log('\n🔄 Generating correction...');
    }
    
    // Generate correction based on issues
    output = await generateCorrection(qaFormat, output, checkResult.issues);
    console.log('Correction generated');
    console.log('==============================\n');
  }

  console.log('⚠️ WARNING: Failed to generate fully verified output');
  console.log('Returning best attempt after maximum iterations');
  console.log('==============================\n');
  
  return output;
}

export {
  generateWriteQuestion,
  generateWriteOutput,
  generateEditQuestion,
  generateEditOutput,
  generateReplyQuestion,
  generateReplyOutput,
  classifyText,
  generateOutputWithFactCheck
}; 
