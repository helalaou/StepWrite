import config from './config.js';
import { writeQuestionPrompt, writeOutputPrompt } from './prompts/writePrompts.js';
import { editQuestionPrompt, editOutputPrompt } from './prompts/editPrompts.js';
import { textTypeClassificationPrompt } from './prompts/textTypeClassificationPrompt.js';
import { replyQuestionPrompt, replyOutputPrompt, initialReplyQuestionPrompt } from './prompts/replyPrompts.js';
import { factCheckPrompt, factCorrectionPrompt } from './prompts/factCheckingPrompt.js';
import { logger } from './config.js';
import { toneClassificationPrompt } from './prompts/toneClassificationPrompt.js';
import memoryManager from './memory/memoryManager.js';
import { dependencyAnalysisPrompt } from './prompts/dependencyAnalysisPrompt.js';
import { openai } from './lib/openaiClient.js';
import { buildCompletionParams } from './lib/completionParams.js';
import { openaiCallOptions, timeLeft } from './lib/deadline.js';

// Run a single-prompt chat completion with the given { model, temperature, maxTokens } config.
async function complete(modelConfig, prompt) {
  const completion = await openai.chat.completions.create(
    buildCompletionParams(modelConfig, [{ role: 'system', content: prompt }]),
    openaiCallOptions()
  );
  // Reasoning models can return null content when they exhaust the token budget.
  return (completion.choices[0].message.content ?? '').trim();
}

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
    const responseText = await complete(config.openai.write.question, prompt);
    logger.section('OPENAI RESPONSE (Question Generation)', {
      rawResponse: responseText
    });

    // clean
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
    
    // find the maxisting ID to avoid conflicts when questions are removed
    const maxId = conversationPlanning.questions.reduce((max, q) => Math.max(max, q.id), 0);
    
    let updatedConversationPlanning = {
      ...conversationPlanning,
      questions: [
        ...conversationPlanning.questions,
        {
          id: maxId + 1,
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
    const output = await complete(config.openai.write.output, prompt);
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
    const responseText = await complete(config.openai.edit.question, prompt);
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
    
    //fnd the max existing ID to avoid conflicts when questions are removed
    const maxId = conversationPlanning.questions.reduce((max, q) => Math.max(max, q.id), 0);
    
    let updatedConversationPlanning = {
      ...conversationPlanning,
      questions: [
        ...conversationPlanning.questions,
        {
          id: maxId + 1,
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
    const output = await complete(config.openai.edit.output, prompt);
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
    const type = (await complete(config.openai.textTypeClassification, prompt)).toLowerCase();
    
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

// Simple utility function to process email templates
function processEmailTemplate(originalText) {
  let processedText = originalText;
  
  // Get user name from memory if available
  const userName = memoryManager.isEnabled() ? memoryManager.getUserName() || "Student" : "Student";
  
  // Replace the {Name} placeholder with the user's name from memory
  processedText = originalText.replace(/\{Name\}/g, userName);
  
  return { processedText, extractedName: userName };
}

async function generateReplyQuestion(originalText, conversationPlanning) {
  const qaFormat = conversationPlanning.questions
    .map(q => `Q: ${q.question}; A: ${q.response}`)
    .join('\n');

  // Process template variables in the original text
  const { processedText, extractedName } = processEmailTemplate(originalText);

  const prompt = replyQuestionPrompt(processedText, qaFormat);

  logger.section('OPENAI REQUEST (Reply Question Generation)', {
    prompt,
    model: config.openai.reply.question.model,
    maxTokens: config.openai.reply.question.maxTokens,
    temperature: config.openai.reply.question.temperature,
    extractedRecipientName: extractedName
  });

  try {
    const responseText = await complete(config.openai.reply.question, prompt);
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
    
    // Find the maximum existing ID to avoid conflicts when questions are removed
    const maxId = conversationPlanning.questions.reduce((max, q) => Math.max(max, q.id), 0);
    
    let updatedConversationPlanning = {
      ...conversationPlanning,
      questions: [
        ...conversationPlanning.questions,
        {
          id: maxId + 1,
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
    
  // Process template variables in the original text
  const { processedText, extractedName } = processEmailTemplate(originalText);

  const prompt = replyOutputPrompt(processedText, qaFormat, toneClassification);

  logger.section('OPENAI REQUEST (Reply Output Generation)', {
    prompt,
    model: config.openai.reply.output.model,
    maxTokens: config.openai.reply.output.maxTokens,
    temperature: config.openai.reply.output.temperature,
    originalTextLength: processedText.length,
    qaFormatLength: qaFormat.length,
    questionsCount: conversationPlanning.questions.length,
    hasTone: !!toneClassification,
    extractedRecipientName: extractedName
  });

  try {
    const output = await complete(config.openai.reply.output, prompt);
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

// Check a draft against the user's answers (and, for replies, the message
// being replied to). An unreadable verdict counts as unverified rather than
// failed, so a parsing hiccup never triggers a rewrite of a good draft.
async function performFactCheck(qaFormat, output, originalText = '') {
  const prompt = factCheckPrompt(qaFormat, output, originalText);

  logger.section('FACT CHECK REQUEST', {
    qaFormat,
    output,
    prompt
  });

  const responseText = await complete(config.openai.factChecking.check, prompt);
  const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();

  let parsedResponse;
  try {
    parsedResponse = JSON.parse(cleanedResponse);
  } catch (parseError) {
    logger.error('Failed to parse fact check response:', {
      error: parseError,
      responseText
    });
    return { passed: true, unverified: true, issues: [] };
  }

  const result = {
    passed: parsedResponse.passed === true,
    issues: Array.isArray(parsedResponse.issues) ? parsedResponse.issues : []
  };

  logger.section('FACT CHECK RESULTS', {
    rawResponse: responseText,
    passed: result.passed,
    issueCount: result.issues.length,
    issues: result.issues
  });

  return result;
}

function generateCorrection(qaFormat, output, issues, toneClassification, originalText = '') {
  const prompt = factCorrectionPrompt(qaFormat, output, issues, toneClassification, originalText);
  logger.section('GENERATING CORRECTION', { prompt });
  return complete(config.openai.factChecking.correction, prompt);
}

async function generateBackgroundDraft(conversationPlanning, toneClassification, context = null) {
  logger.section('BACKGROUND DRAFT GENERATION', {
    questionsCount: conversationPlanning.questions.length,
    answeredQuestions: conversationPlanning.questions.filter(q => q.response && q.response.trim()).length,
    factCheckingEnabled: config.openai.continuousDrafts.factCheckContinuousDrafts
  });

  // here we generate the background draft without fact-checking for speed (configurable)
  if (!config.openai.continuousDrafts.factCheckContinuousDrafts) {
    const draft = context 
      ? await generateReplyOutput(context, conversationPlanning, toneClassification)
      : await generateWriteOutput(conversationPlanning, toneClassification);
    
    logger.section('BACKGROUND DRAFT COMPLETE', {
      draft: draft.substring(0, 200) + '...',
      length: draft.length
    });
    
    return draft;
  }

  //if fact-checking is enabled for continuous drafts, use the full process
  return await generateOutputWithFactCheck(conversationPlanning, toneClassification, context);
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

  logger.section('INITIAL OUTPUT GENERATION', {
    questionsCount: conversationPlanning.questions.length,
    qaFormat
  });

  // Replies are checked against the message they answer, with template
  // placeholders filled in the same way the reply prompt sees them.
  const repliedText = context ? processEmailTemplate(context).processedText : '';

  let output = context
    ? await generateReplyOutput(context, conversationPlanning, toneClassification)
    : await generateWriteOutput(conversationPlanning, toneClassification);

  const { maxAttempts, minTimeMs } = config.openai.factChecking;
  // Within a request's deadline (the hosted site), the text written so far is
  // returned once there is no longer time to check it and correct it.
  const outOfTime = (attempt) => {
    if (timeLeft() >= minTimeMs) return false;
    logger.warn(`Fact checking stopped after ${attempt - 1} attempt(s): too little time left in the request`);
    return true;
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (outOfTime(attempt)) return output;

    logger.section(`FACT CHECK ATTEMPT ${attempt}/${maxAttempts}`, {
      currentOutput: output
    });

    try {
      const checkResult = await performFactCheck(qaFormat, output, repliedText);

      // A failing verdict that names no issues gives the corrector nothing to fix.
      if (checkResult.passed || checkResult.issues.length === 0) {
        logger.section('FACT CHECK PASSED', { finalOutput: output });
        return output;
      }

      logger.section('FACT CHECK FAILED', {
        issuesFound: checkResult.issues.length,
        issues: checkResult.issues
      });

      output = await generateCorrection(qaFormat, output, checkResult.issues, toneClassification, repliedText);
      logger.section('CORRECTION RESULT', { correctedOutput: output });
    } catch (error) {
      // A call cut short by the deadline
      if (outOfTime(attempt + 1)) return output;
      throw error;
    }
  }

  logger.warn(`Maximum fact check attempts (${maxAttempts}) reached; returning the last correction`);
  return output;
}

// Used when classification fails; must be a key of config.openai.toneClassification.categories.
const DEFAULT_TONE = 'FORMAL';

async function classifyTone(qaFormat, originalText = '') {
  // Process template variables in the original text if provided
  let processedText = originalText;
  let extractedName = null;
  
  if (originalText) {
    const templateResult = processEmailTemplate(originalText);
    processedText = templateResult.processedText;
    extractedName = templateResult.extractedName;
  }
  
  const prompt = toneClassificationPrompt(qaFormat, processedText);
  
  logger.section('TONE CLASSIFICATION REQUEST', {
    prompt,
    model: config.openai.toneClassification.model,
    temperature: config.openai.toneClassification.temperature,
    hasOriginalText: !!originalText,
    qaFormatLength: qaFormat.length,
    extractedRecipientName: extractedName
  });

  const fallback = (reason) => ({ tone: DEFAULT_TONE, confidence: 0, reasoning: reason });

  // Tone only steers wording, so a failed classification should never fail the request.
  try {
    const responseText = await complete(config.openai.toneClassification, prompt);
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const parsedResponse = JSON.parse(cleanedResponse);

    if (!(parsedResponse.tone in config.openai.toneClassification.categories)) {
      logger.warn(`Unknown tone "${parsedResponse.tone}", using ${DEFAULT_TONE}`);
      return fallback(`Model returned unknown tone "${parsedResponse.tone}"`);
    }

    logger.section('TONE CLASSIFICATION RESULT', {
      tone: parsedResponse.tone,
      confidence: parsedResponse.confidence,
      reasoning: parsedResponse.reasoning,
      rawResponse: responseText
    });
    return parsedResponse;
  } catch (error) {
    logger.error('Tone classification failed, using default tone:', {
      error: error.message,
      stack: error.stack
    });
    return fallback('Default tone due to classification error');
  }
}

async function generateInitialReplyQuestion(originalText) {
  // Process template variables in the original text
  const { processedText, extractedName } = processEmailTemplate(originalText);

  const prompt = initialReplyQuestionPrompt(processedText);

  logger.section('OPENAI REQUEST (Initial Reply Question Generation)', {
    model: config.openai.initialReplyQuestion.model,
    temperature: config.openai.initialReplyQuestion.temperature,
    maxTokens: config.openai.initialReplyQuestion.maxTokens,
    extractedRecipientName: extractedName
  });

  try {
    const question = await complete(config.openai.initialReplyQuestion, prompt);
    logger.section('OPENAI RESPONSE (Initial Reply Question Generation)', {
      question
    });

    return question;
  } catch (error) {
    logger.error('Failed to generate initial reply question:', error);
    return "How would you like to respond to this message?";
  }
}

async function analyzeDependencies(originalAnswer, newAnswer, changedQuestionId, allQuestions) {
  const prompt = dependencyAnalysisPrompt(originalAnswer, newAnswer, changedQuestionId, allQuestions);

  logger.section('OPENAI REQUEST (Dependency Analysis)', {
    prompt,
    model: config.openai.dependencyAnalysis.model,
    maxTokens: config.openai.dependencyAnalysis.maxTokens,
    temperature: config.openai.dependencyAnalysis.temperature,
    changedQuestionId,
    totalQuestions: allQuestions.length
  });

  try {
    const responseText = await complete(config.openai.dependencyAnalysis, prompt);
    logger.section('OPENAI RESPONSE (Dependency Analysis)', {
      rawResponse: responseText
    });

    // cleaning json response
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanedResponse);
      logger.section('PARSED DEPENDENCY ANALYSIS', parsedResponse);
    } catch (parseError) {
      logger.warn('Failed to parse dependency analysis response:', parseError);
      logger.info('Falling back to conservative approach (invalidate all)');
      
      // fallback: mark all subsequent questions as affected
      const subsequentQuestions = allQuestions.filter(q => q.id > changedQuestionId);
      parsedResponse = {
        affectedQuestions: subsequentQuestions.map(q => ({
          questionId: q.id,
          question: q.question,
          status: 'AFFECTED',
          reasoning: 'Fallback due to parsing error - invalidating for safety'
        })),
        summary: 'Parsing failed, using conservative approach'
      };
    }

    return parsedResponse;
  } catch (error) {
    logger.error('Failed to analyze dependencies:', error);
    
    //fallback: mark all subsequent questions as affected
    const subsequentQuestions = allQuestions.filter(q => q.id > changedQuestionId);
    return {
      affectedQuestions: subsequentQuestions.map(q => ({
        questionId: q.id,
        question: q.question,
        status: 'AFFECTED',
        reasoning: 'Error in analysis - invalidating for safety'
      })),
      summary: 'Analysis failed, using conservative approach'
    };
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
  generateBackgroundDraft,
  classifyTone,
  generateInitialReplyQuestion,
  performFactCheck,
  analyzeDependencies
}; 
