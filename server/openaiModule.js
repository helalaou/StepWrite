import OpenAI from 'openai';
import dotenv from 'dotenv';
import config from './config.js';
import { writeQuestionPrompt, writeOutputPrompt } from './prompts/writePrompts.js';
import { editQuestionPrompt, editOutputPrompt } from './prompts/editPrompts.js';
import { classificationPrompt } from './prompts/classificationPrompt.js';
import { replyQuestionPrompt, replyOutputPrompt } from './prompts/replyPrompts.js';
import { factCheckPrompt, factCorrectionPrompt } from './prompts/factCheckingPrompt.js';
import { logger } from './config.js';

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

  logger.section('OPENAI REQUEST (Question Generation)', {
    prompt,
    model: config.openai.write.question.model,
    maxTokens: config.openai.write.question.maxTokens,
    temperature: config.openai.write.question.temperature
  });

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.write.question.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.write.question.maxTokens,
      temperature: config.openai.write.question.temperature,
    });

    const responseText = completion.choices[0].message.content.trim();
    logger.section('OPENAI RESPONSE (Question Generation)', {
      rawResponse: responseText
    });

    // Remove markdown code blocks if present
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    logger.section('CLEANED RESPONSE', {
      original: responseText,
      cleaned: cleanedResponse
    });

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanedResponse);
      logger.section('PARSED RESPONSE', parsedResponse);
    } catch (parseError) {
      logger.warn('Failed to parse cleaned response:', parseError);
      logger.info('Attempting to fix response format...');
      
      // Fallback parsing logic
      const questionMatch = cleanedResponse.match(/"question"\s*:\s*"([^"]+)"/);
      const followupMatch = cleanedResponse.match(/"followup_needed"\s*:\s*(true|false)/);
      
      if (questionMatch && followupMatch) {
        parsedResponse = {
          question: questionMatch[1],
          followup_needed: followupMatch[1] === 'true'
        };
        logger.section('FALLBACK PARSED RESPONSE', parsedResponse);
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

    logger.section('FINAL RESULT', {
      question,
      followup_needed,
      updatedQuestionCount: updatedConversationPlanning.questions.length
    });

    return { question, conversationPlanning: updatedConversationPlanning };
  } catch (error) {
    logger.error('Failed to generate question:', error);
    throw error;
  }
}

async function generateWriteOutput(conversationPlanning) {
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = writeOutputPrompt(qaFormat);

  logger.section('OPENAI REQUEST (Output Generation)', {
    prompt,
    model: config.openai.write.output.model,
    maxTokens: config.openai.write.output.maxTokens,
    temperature: config.openai.write.output.temperature
  });

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.write.output.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.write.output.maxTokens,
      temperature: config.openai.write.output.temperature,
    });

    const output = completion.choices[0].message.content.trim();
    logger.section('OPENAI RESPONSE (Output Generation)', {
      output,
      length: output.length
    });

    return output;
  } catch (error) {
    logger.error('Failed to generate output:', error);
    throw error;
  }
}

async function generateEditQuestion(originalText, conversationPlanning) {
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = editQuestionPrompt(originalText, qaFormat);

  logger.info('\n=== SENDING TO OPENAI (Edit Question Generation) ===');
  logger.info('Prompt:', prompt);
  logger.info('================================================\n');

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.edit.question.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.edit.question.maxTokens,
      temperature: config.openai.edit.question.temperature,
    });

    const responseText = completion.choices[0].message.content.trim();
    logger.info('Raw OpenAI response:', responseText);

    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    let parsedResponse;
    
    try {
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      logger.warn('Failed to parse cleaned response:', parseError);
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
    logger.error('Failed to generate edit question:', error);
    throw error;
  }
}

async function generateEditOutput(originalText, conversationPlanning) {
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = editOutputPrompt(originalText, qaFormat);

  logger.info('\n=== SENDING TO OPENAI (Edit Output Generation) ===');
  logger.info('Prompt:', prompt);
  logger.info('=============================================\n');

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.edit.output.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.edit.output.maxTokens,
      temperature: config.openai.edit.output.temperature,
    });

    const output = completion.choices[0].message.content.trim();
    logger.info('Generated edit output:', output);
    return output;
  } catch (error) {
    logger.error('Failed to generate edit output:', error);
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
      logger.warn(`Unexpected classification: ${classification}, defaulting to "${config.openai.classification.defaultCategory}"`);
      return config.openai.classification.defaultCategory;
    }

    return classification;
  } catch (error) {
    logger.error('Failed to classify text:', error);
    throw error;
  }
}

async function generateReplyQuestion(originalText, conversationPlanning) {
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = replyQuestionPrompt(originalText, qaFormat);

  logger.info('\n=== SENDING TO OPENAI (Reply Question Generation) ===');
  logger.info('Prompt:', prompt);
  logger.info('================================================\n');

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.reply.question.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.reply.question.maxTokens,
      temperature: config.openai.reply.question.temperature,
    });

    const responseText = completion.choices[0].message.content.trim();
    logger.info('Raw OpenAI response:', responseText);

    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    let parsedResponse;
    
    try {
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      logger.warn('Failed to parse cleaned response:', parseError);
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
    logger.error('Failed to generate reply question:', error);
    throw error;
  }
}

async function generateReplyOutput(originalText, conversationPlanning) {
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = replyOutputPrompt(originalText, qaFormat);

  logger.info('\n=== SENDING TO OPENAI (Reply Output Generation) ===');
  logger.info('Prompt:', prompt);
  logger.info('=============================================\n');

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.reply.output.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.reply.output.maxTokens,
      temperature: config.openai.reply.output.temperature,
    });

    const output = completion.choices[0].message.content.trim();
    logger.info('Generated reply output:', output);
    return output;
  } catch (error) {
    logger.error('Failed to generate reply output:', error);
    throw error;
  }
}

async function performFactCheck(qaFormat, output) {
  const prompt = factCheckPrompt(qaFormat, output);

  logger.section('FACT CHECK REQUEST', {
    qaFormat,
    output,
    prompt
  });

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.factChecking.check.model,
      messages: [{ role: 'system', content: prompt }],
      temperature: config.openai.factChecking.check.temperature,
      max_tokens: config.openai.factChecking.check.maxTokens,
    });

    const responseText = completion.choices[0].message.content.trim();
    
    //cleaning json response
    const cleanedResponse = responseText
      .replace(/^```json\s*/, '') // Remove opening JSON code block
      .replace(/\s*```$/, '')     // Remove closing code block
      .trim();                    // Remove any extra whitespace

    try {
      const parsedResponse = JSON.parse(cleanedResponse);
      
      logger.section('FACT CHECK RESULTS', {
        rawResponse: responseText,
        cleaned: cleanedResponse,
        parsed: parsedResponse,
        passed: parsedResponse.passed,
        issueCount: parsedResponse.issues.length,
        issues: parsedResponse.issues
      });

      return parsedResponse;
    } catch (parseError) {
      logger.error('Failed to parse fact check response:', {
        error: parseError,
        responseText,
        cleanedResponse
      });
      // Return a default response to prevent complete failure
      return {
        passed: false,
        issues: [{
          type: "error",
          detail: "Failed to parse fact check response",
          qa_reference: "System error"
        }]
      };
    }
  } catch (error) {
    logger.error('Failed to perform fact check:', error);
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
    logger.error('Failed to generate correction:', error);
    throw error;
  }
}

async function generateOutputWithFactCheck(conversationPlanning) {
  logger.section('FACT CHECKING STATUS', {
    enabled: config.openai.factChecking.enabled,
    maxAttempts: config.openai.factChecking.maxAttempts
  });

  if (!config.openai.factChecking.enabled) {
    logger.info('Fact checking disabled, generating output without verification');
    return await generateWriteOutput(conversationPlanning);
  }

  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}\nA: ${q.response}`)
    .join('\n\n');

  let attempts = 0;
  
  logger.section('INITIAL OUTPUT GENERATION', {
    questionsCount: conversationPlanning.questions.length,
    qaFormat
  });

  let output = await generateWriteOutput(conversationPlanning);

  while (attempts < config.openai.factChecking.maxAttempts) {
    attempts++;
    logger.section(`FACT CHECK ATTEMPT ${attempts}/${config.openai.factChecking.maxAttempts}`, {
      currentOutput: output
    });
    
    const checkResult = await performFactCheck(qaFormat, output);

    if (checkResult.passed) {
      logger.section('FACT CHECK PASSED', {
        finalOutput: output
      });
      return output;
    }

    logger.section('FACT CHECK FAILED', {
      issuesFound: checkResult.issues.length,
      issues: checkResult.issues
    });

    if (attempts === config.openai.factChecking.maxAttempts) {
      logger.warn('Maximum fact check attempts reached');
    }
    
    // Generate correction based on issues
    const correctionPrompt = factCorrectionPrompt(qaFormat, output, checkResult.issues);
    logger.section('GENERATING CORRECTION', {
      attempt: attempts,
      prompt: correctionPrompt
    });

    const completion = await openai.chat.completions.create({
      model: config.openai.factChecking.correction.model,
      messages: [{ role: 'system', content: correctionPrompt }],
      temperature: config.openai.factChecking.correction.temperature,
      max_tokens: config.openai.factChecking.correction.maxTokens,
    });

    output = completion.choices[0].message.content.trim();
    logger.section('CORRECTION RESULT', {
      correctedOutput: output
    });
  }

  logger.section('FACT CHECK FINAL STATUS', {
    status: 'Maximum attempts reached without passing fact check',
    attemptsUsed: attempts,
    finalOutput: output
  });
  
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
