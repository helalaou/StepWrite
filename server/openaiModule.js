import OpenAI from 'openai';
import dotenv from 'dotenv';
import config from './config.js';
import { writeQuestionPrompt, writeOutputPrompt } from './prompts/writePrompts.js';
import { editQuestionPrompt, editOutputPrompt } from './prompts/editPrompts.js';
import { textTypeClassificationPrompt } from './prompts/textTypeClassificationPrompt.js';
import { replyQuestionPrompt, replyOutputPrompt } from './prompts/replyPrompts.js';
import { factCheckPrompt, factCorrectionPrompt } from './prompts/factCheckingPrompt.js';
import { logger } from './config.js';
import { toneClassificationPrompt } from './prompts/toneClassificationPrompt.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: config.openai.timeout,
});

function updateFollowupStatus(conversationPlanning, followupNeeded) {
  return {
    ...conversationPlanning,
    followup_needed: followupNeeded
  };
}

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
    
    let updatedConversationPlanning = {
      ...conversationPlanning,
      questions: [
        ...conversationPlanning.questions,
        {
          id: conversationPlanning.questions.length + 1,
          question,
          response: ''
        }
      ]
    };
    
    updatedConversationPlanning = updateFollowupStatus(updatedConversationPlanning, followup_needed);

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

async function generateWriteOutput(conversationPlanning, toneClassification) {
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = writeOutputPrompt(qaFormat, toneClassification);

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

    const { question, followup_needed } = parsedResponse;
    
    let updatedConversationPlanning = {
      ...conversationPlanning,
      questions: [
        ...conversationPlanning.questions,
        {
          id: conversationPlanning.questions.length + 1,
          question,
          response: ''
        }
      ]
    };
    
    updatedConversationPlanning = updateFollowupStatus(updatedConversationPlanning, followup_needed);

    logger.section('FINAL RESULT', {
      question,
      followup_needed,
      updatedQuestionCount: updatedConversationPlanning.questions.length
    });

    return { question, conversationPlanning: updatedConversationPlanning };
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

async function classifyTextType(text) {
  const prompt = textTypeClassificationPrompt(text);
  
  logger.section('TEXT TYPE CLASSIFICATION REQUEST', {
    text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
    model: config.openai.textTypeClassification.model,
    temperature: config.openai.textTypeClassification.temperature,
    maxTokens: config.openai.textTypeClassification.maxTokens
  });

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.textTypeClassification.model,
      messages: [{ role: 'system', content: prompt }],
      temperature: config.openai.textTypeClassification.temperature,
      max_tokens: config.openai.textTypeClassification.maxTokens,
    });

    const type = completion.choices[0].message.content.trim().toLowerCase();
    
    logger.section('TEXT TYPE CLASSIFICATION RESULT', {
      rawResponse: type,
      validCategories: config.openai.textTypeClassification.validCategories,
      defaultCategory: config.openai.textTypeClassification.defaultCategory,
      finalType: config.openai.textTypeClassification.validCategories.includes(type) 
        ? type 
        : config.openai.textTypeClassification.defaultCategory
    });

    return config.openai.textTypeClassification.validCategories.includes(type) 
      ? type 
      : config.openai.textTypeClassification.defaultCategory;
  } catch (error) {
    logger.error('Error in text type classification:', {
      error: error.message,
      stack: error.stack,
      defaultingTo: config.openai.textTypeClassification.defaultCategory
    });
    return config.openai.textTypeClassification.defaultCategory;
  }
}

async function generateReplyQuestion(originalText, conversationPlanning) {
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  const prompt = replyQuestionPrompt(originalText, qaFormat);

  logger.section('OPENAI REQUEST (Reply Question Generation)', {
    prompt,
    model: config.openai.reply.question.model,
    maxTokens: config.openai.reply.question.maxTokens,
    temperature: config.openai.reply.question.temperature
  });

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.reply.question.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.reply.question.maxTokens,
      temperature: config.openai.reply.question.temperature,
    });

    const responseText = completion.choices[0].message.content.trim();
    logger.section('OPENAI RESPONSE (Reply Question Generation)', {
      rawResponse: responseText
    });

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

    const { question, followup_needed } = parsedResponse;
    
    let updatedConversationPlanning = {
      ...conversationPlanning,
      questions: [
        ...conversationPlanning.questions,
        {
          id: conversationPlanning.questions.length + 1,
          question,
          response: ''
        }
      ]
    };
    
    updatedConversationPlanning = updateFollowupStatus(updatedConversationPlanning, followup_needed);

    logger.section('FINAL RESULT', {
      question,
      followup_needed,
      updatedQuestionCount: updatedConversationPlanning.questions.length
    });

    return { question, conversationPlanning: updatedConversationPlanning };

  } catch (error) {
    logger.error('Failed to generate reply question:', error);
    throw error;
  }
}

async function generateReplyOutput(originalText, conversationPlanning, toneClassification) {
  // Format Q&A with proper newlines and spacing
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}\nA: ${q.response}`)
    .join('\n\n');

  const prompt = replyOutputPrompt(originalText, qaFormat, toneClassification);

  logger.section('OPENAI REQUEST (Reply Output Generation)', {
    prompt,
    model: config.openai.reply.output.model,
    maxTokens: config.openai.reply.output.maxTokens,
    temperature: config.openai.reply.output.temperature,
    originalTextLength: originalText.length,
    qaFormatLength: qaFormat.length,
    questionsCount: conversationPlanning.questions.length,
    hasTone: !!toneClassification
  });

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.reply.output.model,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: config.openai.reply.output.maxTokens,
      temperature: config.openai.reply.output.temperature,
    });

    const output = completion.choices[0].message.content.trim();
    logger.section('OPENAI RESPONSE (Reply Output Generation)', {
      output,
      length: output.length,
      words: output.split(/\s+/).length
    });

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

async function generateOutputWithFactCheck(conversationPlanning, toneClassification, context = null) {
  logger.section('FACT CHECKING STATUS', {
    enabled: config.openai.factChecking.enabled,
    maxAttempts: config.openai.factChecking.maxAttempts
  });

  if (!config.openai.factChecking.enabled) {
    logger.info('Fact checking disabled, generating output without verification');
    return context 
      ? await generateReplyOutput(context, conversationPlanning, toneClassification)
      : await generateWriteOutput(conversationPlanning, toneClassification);
  }

  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}\nA: ${q.response}`)
    .join('\n\n');

  let attempts = 0;
  
  logger.section('INITIAL OUTPUT GENERATION', {
    questionsCount: conversationPlanning.questions.length,
    qaFormat
  });

  // Generate initial output using appropriate function
  let output = context 
    ? await generateReplyOutput(context, conversationPlanning, toneClassification)
    : await generateWriteOutput(conversationPlanning, toneClassification);

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
    const correctionPrompt = factCorrectionPrompt(qaFormat, output, checkResult.issues, toneClassification);
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

async function classifyTone(qaFormat, originalText = '') {
  const prompt = toneClassificationPrompt(qaFormat, originalText);
  
  logger.section('TONE CLASSIFICATION REQUEST', {
    prompt,
    model: config.openai.toneClassification.model,
    temperature: config.openai.toneClassification.temperature,
    hasOriginalText: !!originalText,
    qaFormatLength: qaFormat.length
  });

  try {
    const completion = await openai.chat.completions.create({
      model: config.openai.toneClassification.model,
      messages: [{ role: 'system', content: prompt }],
      temperature: config.openai.toneClassification.temperature,
      max_tokens: config.openai.toneClassification.maxTokens,
    });

    const responseText = completion.choices[0].message.content.trim();
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    
    try {
      const parsedResponse = JSON.parse(cleanedResponse);
      logger.section('TONE CLASSIFICATION RESULT', {
        tone: parsedResponse.tone,
        confidence: parsedResponse.confidence,
        reasoning: parsedResponse.reasoning,
        rawResponse: responseText
      });
      return parsedResponse;
    } catch (parseError) {
      logger.error('Error parsing tone classification response:', {
        error: parseError,
        responseText,
        cleanedResponse
      });
      return {
        tone: 'FORMAL_PROFESSIONAL',
        confidence: 1.0,
        reasoning: 'Default tone due to parsing error'
      };
    }
  } catch (error) {
    logger.error('Error in tone classification:', {
      error: error.message,
      stack: error.stack
    });
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
  classifyTextType,
  generateOutputWithFactCheck,
  classifyTone
}; 
