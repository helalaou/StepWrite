import express from 'express';
import cors from 'cors';
import config from './config.js';
import {
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
} from './openaiModule.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { logger } from './config.js';
import multer from 'multer';
import { Readable } from 'stream';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import cookieParser from 'cookie-parser';
import { cleanupOnStartup } from './utils/cleanup.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add near the top of the file, after imports
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all ngrok domains and localhost
    if (origin.includes('ngrok') || origin === `http://localhost:${config.client.port}`) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Update initialization:
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Track active sessions and their audio files
const sessions = new Map();

// Add session middleware
app.use((req, res, next) => {
  // Get or create session ID from cookie
  let sessionId = req.cookies?.sessionId;
  if (!sessionId) {
    sessionId = uuidv4();
    res.cookie('sessionId', sessionId, { 
      httpOnly: true,
      sameSite: 'strict'
    });
    sessions.set(sessionId, new Set()); // Track files for this session
  }
  req.sessionId = sessionId;
  next();
});

// Check if followup is needed
function isFollowupNeeded(conversationPlanning, forceFollowup = false) {
  if (forceFollowup) {
    logger.info('Followup forced by caller');
    return true;
  }
  
  const needsFollowup = !!conversationPlanning.followup_needed;
  logger.info(`Followup decision: ${needsFollowup ? 'needed' : 'not needed'}`);
  return needsFollowup;
}

// Set followup status
function updateFollowupStatus(conversationPlanning, followupNeeded) {
  return {
    ...conversationPlanning,
    followup_needed: followupNeeded
  };
}

// Force complete conversation - for the manual endpoint
function forceComplete(conversationPlanning) {
  logger.info('Manually forcing conversation completion');
  return updateFollowupStatus(conversationPlanning, false);
}

// Force continue conversation - for the manual endpoint
function forceContinue(conversationPlanning) {
  logger.info('Manually forcing conversation continuation');
  return updateFollowupStatus(conversationPlanning, true);
}

// generate a background draft and update conversation planning
async function generateAndStoreDraft(conversationPlanning, context = null) {
  if (!config.openai.continuousDrafts.enabled) {
    return conversationPlanning;
  }

  // case: only generate draft if there are answered questions
  const answeredQuestions = conversationPlanning.questions.filter(q => 
    q.response && q.response.trim() && q.response !== "user has skipped this question"
  );

  if (answeredQuestions.length === 0) {
    logger.info('No answered questions yet, skipping background draft generation');
    return conversationPlanning;
  }

  // case: check if we have minimum required questions answered
  const minQuestions = config.openai.continuousDrafts.minimumQuestionsForDraft;
  if (answeredQuestions.length < minQuestions) {
    logger.info(`Only ${answeredQuestions.length} questions answered, need at least ${minQuestions} for background draft generation`);
    return conversationPlanning;
  }

  try {
    // Generate tone classification if enabled
    let toneClassification = null;
    if (config.openai.toneClassification.enabled) {
      const qaFormat = conversationPlanning.questions
        .map(q => `Q: ${q.question}\nA: ${q.response}`)
        .join('\n\n');
      toneClassification = await classifyTone(qaFormat, context || '');
    }

    // generate background draft
    const draft = await generateBackgroundDraft(conversationPlanning, toneClassification, context);
    
    //put draft in conversation planning
    const updatedPlanning = {
      ...conversationPlanning,
      backgroundDraft: {
        content: draft,
        generatedAt: new Date().toISOString(),
        questionsCount: conversationPlanning.questions.length,
        answeredCount: answeredQuestions.length
      }
    };

    logger.section('BACKGROUND DRAFT STORED', {
      questionsCount: conversationPlanning.questions.length,
      answeredCount: answeredQuestions.length,
      draftLength: draft.length
    });

    return updatedPlanning;
  } catch (error) {
    logger.error('Error generating background draft:', error);
    // Return original planning if draft generation fails
    return conversationPlanning;
  }
}

// Submit Answer Route
app.post('/api/write', async (req, res) => {
  try {
    const { conversationPlanning, changedIndex, context, isFinishCommand, answer } = req.body;
    logger.info('Processing submission with conversation planning:', conversationPlanning);

    // if a response was changed, use intelligent dependency analysis
    let updatedPlanning = { ...conversationPlanning };
    if (typeof changedIndex === 'number') {
      // store original answer for dependency analysis
      const originalAnswer = updatedPlanning.questions[changedIndex]?.response || '';
      const newAnswer = answer || '';
      
      logger.section('DEPENDENCY ANALYSIS START', {
        changedQuestionId: changedIndex + 1, // Questions are 1-indexed in the prompt
        originalAnswer,
        newAnswer,
        totalQuestions: updatedPlanning.questions.length
      });

      // Perform dependency analysis
      const dependencyAnalysis = await analyzeDependencies(
        originalAnswer,
        newAnswer,
        changedIndex + 1, // Convert to 1-indexed for the prompt
        updatedPlanning.questions
      );

      logger.section('DEPENDENCY ANALYSIS RESULTS', dependencyAnalysis);

      // Update the changed question with new answer
      updatedPlanning.questions[changedIndex] = {
        ...updatedPlanning.questions[changedIndex],
        response: newAnswer
      };

      // Remove only the affected questions
      const affectedQuestionIds = dependencyAnalysis.affectedQuestions
        .filter(q => q.status === 'AFFECTED')
        .map(q => q.questionId);

      if (affectedQuestionIds.length > 0) {
        // Filter out affected questions (convert back to 0-indexed)
        updatedPlanning.questions = updatedPlanning.questions.filter(q => 
          q.id <= changedIndex + 1 || !affectedQuestionIds.includes(q.id)
        );
        
        logger.section('QUESTIONS REMOVED', {
          removedQuestionIds: affectedQuestionIds,
          remainingQuestions: updatedPlanning.questions.length
        });
      } else {
        logger.section('NO QUESTIONS REMOVED', {
          message: 'All subsequent questions remain valid'
        });
      }

      // Only force followup if not a finish command
      if (!isFinishCommand) {
        updatedPlanning = updateFollowupStatus(updatedPlanning, true);
      }

      //generate background draft after modification if enabled
      if (config.openai.continuousDrafts.enabled && config.openai.continuousDrafts.generateAfterModifications) {
        updatedPlanning = await generateAndStoreDraft(updatedPlanning, context);
      }
    }

    //for finish command, force output generation regardless of followup status
    if (isFinishCommand) {
      logger.section('FORCED OUTPUT GENERATION (FINISH COMMAND)', {
        factCheckingEnabled: config.openai.factChecking.enabled
      });
      
      let toneClassification = null;
      if (config.openai.toneClassification.enabled) {
        const qaFormat = updatedPlanning.questions
          .map(q => `Q: ${q.question}\nA: ${q.response}`)
          .join('\n\n');
        toneClassification = await classifyTone(qaFormat, context || '');
      }
      
      const output = await generateOutputWithFactCheck(updatedPlanning, toneClassification, context);
      
      logger.section('GENERATION COMPLETE', {
        output,
        length: output.length,
        characters: output.length,
        words: output.split(/\s+/).length,
        ...(toneClassification && { usedTone: toneClassification.tone })
      });
      
      res.json({ 
        output,
        followup_needed: false 
      });
      return;
    }

    if (isFollowupNeeded(updatedPlanning)) {
      // Use different question generation based on whether context exists (reply) or not (write)
      const { question, conversationPlanning: newPlanning } = context 
        ? await generateReplyQuestion(context, updatedPlanning)
        : await generateWriteQuestion(updatedPlanning);
      
      // If no more questions needed, generate final output
      if (!isFollowupNeeded(newPlanning)) {
        logger.section('FINAL OUTPUT GENERATION', {
          factCheckingEnabled: config.openai.factChecking.enabled
        });
        
        let toneClassification = null;
        if (config.openai.toneClassification.enabled) {
          const qaFormat = newPlanning.questions
            .map(q => `Q: ${q.question}\nA: ${q.response}`)
            .join('\n\n');
          toneClassification = await classifyTone(qaFormat, context || '');
        }
        
        const output = await generateOutputWithFactCheck(newPlanning, toneClassification, context);
        
        logger.section('GENERATION COMPLETE', {
          output,
          length: output.length,
          characters: output.length,
          words: output.split(/\s+/).length,
          ...(toneClassification && { usedTone: toneClassification.tone })
        });
        
        res.json({ 
          output,
          followup_needed: false 
        });
        return;
      }

      //generate background draft after new question if enabled
      let planningWithDraft = newPlanning;
      if (config.openai.continuousDrafts.enabled && config.openai.continuousDrafts.generateAfterEachAnswer) {
        planningWithDraft = await generateAndStoreDraft(newPlanning, context);
      }

      res.json({ 
        question, 
        conversationPlanning: planningWithDraft,
        followup_needed: true 
      });
    } else {
      //generate output with fact checking
      logger.section('FINAL OUTPUT GENERATION', {
        factCheckingEnabled: config.openai.factChecking.enabled
      });
      
      let toneClassification = null;
      if (config.openai.toneClassification.enabled) {
        const qaFormat = updatedPlanning.questions
          .map(q => `Q: ${q.question}\nA: ${q.response}`)
          .join('\n\n');
        toneClassification = await classifyTone(qaFormat, context || '');
      }
      
      const output = await generateOutputWithFactCheck(updatedPlanning, toneClassification, context);
      
      logger.section('GENERATION COMPLETE', {
        output,
        length: output.length,
        characters: output.length,
        words: output.split(/\s+/).length,
        ...(toneClassification && { usedTone: toneClassification.tone })
      });
      
      res.json({ 
        output,
        followup_needed: false 
      });
    }
  } catch (error) {
    logger.error('Error processing submission:', error);
    res.status(500).json({ 
      error: 'Failed to process submission',
      details: error.message 
    });
  }
});

app.post('/api/edit', async (req, res) => {
  try {
    const { originalText, conversationPlanning, changedIndex, answer } = req.body;
    logger.info('Processing edit submission:', { originalText, conversationPlanning, changedIndex });

    // if a response was changed, use intelligent dependency analysis
    let updatedPlanning = { ...conversationPlanning };
    if (typeof changedIndex === 'number') {
      // Store original answer for dependency analysis
      const originalAnswer = updatedPlanning.questions[changedIndex]?.response || '';
      const newAnswer = answer || '';
      
      logger.section('DEPENDENCY ANALYSIS START (EDIT)', {
        changedQuestionId: changedIndex + 1, // Questions are 1-indexed in the prompt
        originalAnswer,
        newAnswer,
        totalQuestions: updatedPlanning.questions.length
      });

      // Perform dependency analysis
      const dependencyAnalysis = await analyzeDependencies(
        originalAnswer,
        newAnswer,
        changedIndex + 1, // Convert to 1-indexed for the prompt
        updatedPlanning.questions
      );

      logger.section('DEPENDENCY ANALYSIS RESULTS (EDIT)', dependencyAnalysis);

      // Update the changed question with new answer
      updatedPlanning.questions[changedIndex] = {
        ...updatedPlanning.questions[changedIndex],
        response: newAnswer
      };

      // Remove only the affected questions
      const affectedQuestionIds = dependencyAnalysis.affectedQuestions
        .filter(q => q.status === 'AFFECTED')
        .map(q => q.questionId);

      if (affectedQuestionIds.length > 0) {
        // Filter out affected questions (convert back to 0-indexed)
        updatedPlanning.questions = updatedPlanning.questions.filter(q => 
          q.id <= changedIndex + 1 || !affectedQuestionIds.includes(q.id)
        );
        
        logger.section('QUESTIONS REMOVED (EDIT)', {
          removedQuestionIds: affectedQuestionIds,
          remainingQuestions: updatedPlanning.questions.length
        });
      } else {
        logger.section('NO QUESTIONS REMOVED (EDIT)', {
          message: 'All subsequent questions remain valid'
        });
      }

      updatedPlanning = updateFollowupStatus(updatedPlanning, true);

      // generate background draft after modification if enabled
      if (config.openai.continuousDrafts.enabled && config.openai.continuousDrafts.generateAfterModifications) {
        updatedPlanning = await generateAndStoreDraft(updatedPlanning, originalText);
      }
    }

    if (isFollowupNeeded(updatedPlanning)) {
      const { question, conversationPlanning: newPlanning } = await generateEditQuestion(
        originalText,
        updatedPlanning
      );

      // generate background draft after new question if enabled
      let planningWithDraft = newPlanning;
      if (config.openai.continuousDrafts.enabled && config.openai.continuousDrafts.generateAfterEachAnswer) {
        planningWithDraft = await generateAndStoreDraft(newPlanning, originalText);
      }

      res.json({ 
        question, 
        conversationPlanning: planningWithDraft,
        followup_needed: true 
      });
    } else {
      const editedText = await generateEditOutput(originalText, updatedPlanning);
      res.json({ 
        editedText,
        followup_needed: false 
      });
    }
  } catch (error) {
    logger.error('Error processing edit submission:', error);
    res.status(500).json({ 
      error: 'Failed to process edit submission',
      details: error.message 
    });
  }
});

app.post('/api/classify/text-type', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required and must be a string' });
    }
    const classification = await classifyTextType(text);
    res.json({ type: classification });
  } catch (error) {
    logger.error('Error classifying text type:', error);
    res.status(500).json({ 
      error: 'Failed to classify text type',
      details: error.message 
    });
  }
});

// Get current background draft
app.post('/api/draft/current', async (req, res) => {
  try {
    const { conversationPlanning } = req.body;
    
    if (!conversationPlanning) {
      return res.status(400).json({ error: 'Conversation planning is required' });
    }

    if (!conversationPlanning.backgroundDraft) {
      return res.status(404).json({ error: 'No background draft available' });
    }

    res.json({
      draft: conversationPlanning.backgroundDraft.content,
      metadata: {
        generatedAt: conversationPlanning.backgroundDraft.generatedAt,
        questionsCount: conversationPlanning.backgroundDraft.questionsCount,
        answeredCount: conversationPlanning.backgroundDraft.answeredCount
      }
    });
  } catch (error) {
    logger.error('Error retrieving background draft:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve background draft',
      details: error.message 
    });
  }
});

app.post('/api/classify/tone', async (req, res) => {
  try {
    const { text, originalText } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const toneClassification = await classifyTone(text, originalText);
    res.json(toneClassification);
  } catch (error) {
    logger.error('Error classifying tone:', error);
    res.status(500).json({ 
      error: 'Failed to classify tone',
      details: error.message 
    });
  }
});

app.post('/api/fact-check', async (req, res) => {
  try {
    const { qaFormat, output } = req.body;
    if (!qaFormat || !output) {
      return res.status(400).json({ error: 'QA format and output are required' });
    }
    const factCheckResult = await performFactCheck(qaFormat, output);
    res.json(factCheckResult);
  } catch (error) {
    logger.error('Error checking facts:', error);
    res.status(500).json({ 
      error: 'Failed to check facts',
      details: error.message 
    });
  }
});

app.post('/api/reply', async (req, res) => {
  try {
    const { originalText, conversationPlanning, changedIndex, context, isFinishCommand, answer } = req.body;
    logger.info('Processing reply submission:', { originalText, conversationPlanning, changedIndex });

    // if a response was changed, use intelligent dependency analysis
    let updatedPlanning = { ...conversationPlanning };
    if (typeof changedIndex === 'number') {
      // store original answer for dependency analysis
      const originalAnswer = updatedPlanning.questions[changedIndex]?.response || '';
      const newAnswer = answer || '';
      
      logger.section('DEPENDENCY ANALYSIS START (REPLY)', {
        changedQuestionId: changedIndex + 1, // Questions are 1-indexed in the prompt
        originalAnswer,
        newAnswer,
        totalQuestions: updatedPlanning.questions.length
      });

      // perform dependency analysis
      const dependencyAnalysis = await analyzeDependencies(
        originalAnswer,
        newAnswer,
        changedIndex + 1, // Convert to 1-indexed for the prompt
        updatedPlanning.questions
      );

      logger.section('DEPENDENCY ANALYSIS RESULTS (REPLY)', dependencyAnalysis);

      // Update the changed question with new answer
      updatedPlanning.questions[changedIndex] = {
        ...updatedPlanning.questions[changedIndex],
        response: newAnswer
      };

      // Remove only the affected questions
      const affectedQuestionIds = dependencyAnalysis.affectedQuestions
        .filter(q => q.status === 'AFFECTED')
        .map(q => q.questionId);

      if (affectedQuestionIds.length > 0) {
        // Filter out affected questions (convert back to 0-indexed)
        updatedPlanning.questions = updatedPlanning.questions.filter(q => 
          q.id <= changedIndex + 1 || !affectedQuestionIds.includes(q.id)
        );
        
        logger.section('QUESTIONS REMOVED (REPLY)', {
          removedQuestionIds: affectedQuestionIds,
          remainingQuestions: updatedPlanning.questions.length
        });
      } else {
        logger.section('NO QUESTIONS REMOVED (REPLY)', {
          message: 'All subsequent questions remain valid'
        });
      }

      // only force followup if not a finish command
      if (!isFinishCommand) {
        updatedPlanning = updateFollowupStatus(updatedPlanning, true);
      }

      // Generate background draft after modification if enabled
      if (config.openai.continuousDrafts.enabled && config.openai.continuousDrafts.generateAfterModifications) {
        updatedPlanning = await generateAndStoreDraft(updatedPlanning, originalText);
      }
    }

    // for finish command, force output generation regardless of followup status
    if (isFinishCommand) {
      logger.section('FORCED OUTPUT GENERATION (FINISH COMMAND - REPLY)', {
        factCheckingEnabled: config.openai.factChecking.enabled
      });
      
      let toneClassification = null;
      if (config.openai.toneClassification.enabled) {
        const qaFormat = updatedPlanning.questions
          .map(q => `Q: ${q.question}\nA: ${q.response}`)
          .join('\n\n');
        toneClassification = await classifyTone(qaFormat, originalText || '');
      }
      
      const output = await generateOutputWithFactCheck(updatedPlanning, toneClassification, originalText);
      
      logger.section('GENERATION COMPLETE (REPLY)', {
        output,
        length: output.length,
        characters: output.length,
        words: output.split(/\s+/).length,
        ...(toneClassification && { usedTone: toneClassification.tone })
      });
      
      res.json({ 
        output,
        followup_needed: false 
      });
      return;
    }

    if (isFollowupNeeded(updatedPlanning)) {
      const { question, conversationPlanning: newPlanning } = await generateReplyQuestion(
        originalText,
        updatedPlanning
      );
      
      //ff no more questions needed, generate final output
      if (!isFollowupNeeded(newPlanning)) {
        logger.section('FINAL OUTPUT GENERATION (REPLY)', {
          factCheckingEnabled: config.openai.factChecking.enabled
        });
        
        let toneClassification = null;
        if (config.openai.toneClassification.enabled) {
          const qaFormat = newPlanning.questions
            .map(q => `Q: ${q.question}\nA: ${q.response}`)
            .join('\n\n');
          toneClassification = await classifyTone(qaFormat, originalText || '');
        }
        
        const output = await generateOutputWithFactCheck(newPlanning, toneClassification, originalText);
        
        logger.section('GENERATION COMPLETE (REPLY)', {
          output,
          length: output.length,
          characters: output.length,
          words: output.split(/\s+/).length,
          ...(toneClassification && { usedTone: toneClassification.tone })
        });
        
        res.json({ 
          output,
          followup_needed: false 
        });
        return;
      }

      // Generate background draft after new question if enabled
      let planningWithDraft = newPlanning;
      if (config.openai.continuousDrafts.enabled && config.openai.continuousDrafts.generateAfterEachAnswer) {
        planningWithDraft = await generateAndStoreDraft(newPlanning, originalText);
      }

      res.json({ 
        question,
        conversationPlanning: planningWithDraft,
        followup_needed: true 
      });
    } else {
      // If no followup needed, start with first question
      const { question, conversationPlanning: newPlanning } = await generateReplyQuestion(
        originalText,
        updatedPlanning
      );

      // Generate background draft after first question if enabled
      let planningWithDraft = newPlanning;
      if (config.openai.continuousDrafts.enabled && config.openai.continuousDrafts.generateAfterEachAnswer) {
        planningWithDraft = await generateAndStoreDraft(newPlanning, originalText);
      }

      res.json({
        question,
        conversationPlanning: planningWithDraft,
        followup_needed: true
      });
    }
  } catch (error) {
    logger.error('Error processing reply submission:', error);
    res.status(500).json({ 
      error: 'Failed to process submission',
      details: error.message 
    });
  }
});

// TTS endpoint
app.post('/api/tts/generate', async (req, res) => {
  const { text, cache_as } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    // use custom filename for feedback caching or default hash-based filename
    let audioFilename;
    if (cache_as) {
      audioFilename = cache_as;
    } else {
      const hash = crypto.createHash('md5').update(text).digest('hex');
      audioFilename = `${hash}.${config.audio.tts.format}`;
    }
    
    const audioPath = path.join(config.audio.tts.tempDir, audioFilename);

    // only track regular TTS files in sessions, not feedback files (they should persist)
    if (!cache_as) {
      const sessionFiles = sessions.get(req.sessionId) || new Set();
      sessionFiles.add(audioPath);
      sessions.set(req.sessionId, sessionFiles);
    }

    // Check if audio file is already cached
    if (config.audio.tts.cacheEnabled && fs.existsSync(audioPath)) {
      const stats = fs.statSync(audioPath);
      if (stats.size > 0) {
        // Return absolute URL if request is coming from ngrok
        const isNgrok = req.headers.origin && req.headers.origin.includes('ngrok');
        if (isNgrok) {
          const protocol = req.headers['x-forwarded-proto'] || 'http';
          const host = req.headers.host;
          return res.json({ 
            audioUrl: `${protocol}://${host}/tts/${audioFilename}` 
          });
        }
        return res.json({ audioUrl: `/tts/${audioFilename}` });  
      }
    }

    const response = await openai.audio.speech.create({
      model: config.audio.tts.model,
      voice: config.audio.tts.voice,
      input: text,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Ensure directory exists
    if (!fs.existsSync(config.audio.tts.tempDir)) {
      fs.mkdirSync(config.audio.tts.tempDir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(audioPath, buffer);
    
    // Return absolute URL if request is coming from ngrok
    const isNgrok = req.headers.origin && req.headers.origin.includes('ngrok');
    if (isNgrok) {
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host;
      return res.json({ 
        audioUrl: `${protocol}://${host}/tts/${audioFilename}` 
      });
    }
    
    return res.json({ audioUrl: `/tts/${audioFilename}` });
  } catch (error) {
    logger.error('TTS generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate speech',
      details: error.message 
    });
  }
});

// Update STT endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  try {
    const tempFilePath = path.join(config.audio.stt.tempDir, `${Date.now()}.${config.audio.stt.format}`);
    fs.writeFileSync(tempFilePath, req.file.buffer);

    const file = fs.createReadStream(tempFilePath);
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: config.audio.stt.whisper.model,
      language: config.audio.stt.whisper.language,
      response_format: config.audio.stt.whisper.response_format
    });

    fs.unlinkSync(tempFilePath);
    res.json({ text: transcription });
  } catch (error) {
    logger.error('STT error:', error);
    res.status(500).json({ 
      error: 'Failed to transcribe audio',
      details: error.message 
    });
  }
});

// Serve static files
app.use('/tts', express.static(config.audio.tts.tempDir));

// Cleanup function
const cleanupAudioFiles = () => {
  try {
    // Clean up TTS files
    if (fs.existsSync(config.audio.tts.tempDir)) {
      const ttsFiles = fs.readdirSync(config.audio.tts.tempDir);
      ttsFiles.forEach(file => {
        const filePath = path.join(config.audio.tts.tempDir, file);
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          logger.error(`Failed to delete TTS file ${filePath}:`, error);
        }
      });
    }

    // Clean up STT files
    if (fs.existsSync(config.audio.stt.tempDir)) {
      const sttFiles = fs.readdirSync(config.audio.stt.tempDir);
      sttFiles.forEach(file => {
        const filePath = path.join(config.audio.stt.tempDir, file);
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          logger.error(`Failed to delete STT file ${filePath}:`, error);
        }
      });
    }
    
    sessions.clear();
  } catch (error) {
    logger.error('Audio cleanup error:', error);
  }
};

// Run cleanup periodically
setInterval(cleanupAudioFiles, config.audio.tts.cleanupInterval);

// Run cleanup on server start
cleanupOnStartup();

// Update the existing SIGINT handler
process.on('SIGINT', () => {
  cleanupAudioFiles();
  process.exit(0);
});

// Also handle SIGTERM
process.on('SIGTERM', () => {
  cleanupAudioFiles();
  process.exit(0);
});

// Manual control endpoint
app.post('/api/control/followup', async (req, res) => {
  try {
    const { conversationPlanning, action } = req.body;
    
    if (!conversationPlanning) {
      return res.status(400).json({ error: 'Conversation planning is required' });
    }
    
    if (!action || !['complete', 'continue'].includes(action)) {
      return res.status(400).json({ error: 'Valid action is required: "complete" or "continue"' });
    }
    
    let updatedPlanning;
    
    if (action === 'complete') {
      updatedPlanning = forceComplete(conversationPlanning);
    } else {
      updatedPlanning = forceContinue(conversationPlanning);
    }
    
    res.json({ 
      conversationPlanning: updatedPlanning,
      followup_needed: updatedPlanning.followup_needed,
      message: `Conversation ${action === 'complete' ? 'completed' : 'continued'} manually`
    });
  } catch (error) {
    logger.error('Error in manual followup control:', error);
    res.status(500).json({ 
      error: 'Failed to control followup status',
      details: error.message 
    });
  }
});

// Create a new endpoint for generating the initial reply question
app.post('/api/generate-initial-reply-question', async (req, res) => {
  try {
    const { originalText } = req.body;
    if (!originalText) {
      return res.status(400).json({ error: 'Original text is required' });
    }

    const initialQuestion = await generateInitialReplyQuestion(originalText);
    
    res.json({ 
      question: initialQuestion
    });
  } catch (error) {
    logger.error('Error generating initial reply question:', error);
    res.status(500).json({ 
      error: 'Failed to generate initial question',
      details: error.message 
    });
  }
});

// Endpoint for saving experiment data
app.post('/api/save-experiment-data', async (req, res) => {
  try {
    if (!config.experiment.enabled) {
      return res.status(403).json({ error: 'Experiment tracking is disabled in server configuration' });
    }

    const { 
      participantId, 
      mode, 
      modifyCount, 
      skipCount, 
      textOutput, 
      finalOutput, 
      writingTime, 
      revisionTime,
      conversationPlanning
    } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: 'Participant ID is required' });
    }

    if (!finalOutput) {
      return res.status(400).json({ error: 'Final output is required' });
    }

    if (!textOutput) {
      return res.status(400).json({ error: 'Text output is required' });
    }

    if (!['write', 'reply'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Must be "write" or "reply"' });
    }

    // Create a sanitized filename to prevent directory traversal
    const sanitizedId = participantId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${sanitizedId}_${mode}_experiment.txt`;
    const filepath = path.join(config.experiment.outputDir, filename);

    // Format time values
    const writingTimeStr = writingTime ? `${Math.floor(writingTime / 60)}m ${writingTime % 60}s (${writingTime}s total)` : 'not tracked';
    const revisionTimeStr = revisionTime ? `${Math.floor(revisionTime / 60)}m ${revisionTime % 60}s (${revisionTime}s total)` : 'not tracked';

    // Format the QA data
    let qaData = '';
    if (conversationPlanning && conversationPlanning.questions && conversationPlanning.questions.length > 0) {
      qaData = '\n############### QUESTION-ANSWER DATA ###############\n';
      conversationPlanning.questions.forEach((qa, index) => {
        qaData += `\nQ${index + 1}: ${qa.question}\n`;
        qaData += `A${index + 1}: ${qa.response || 'No answer provided'}\n`;
      });
    }

    // Prepare content for the file
    const content = `user_id: ${participantId}
number of times the user used the modify command: ${modifyCount || 0}
number of times the user skipped a question: ${skipCount || 0}
time taken (writing): ${writingTimeStr}
time taken (revision): ${revisionTimeStr}${qaData}
############### ORIGINAL OUTPUT ###############
${textOutput}
############### REVISED OUTPUT ###############
${finalOutput}`;

    // Write the file
    fs.writeFileSync(filepath, content);

    logger.info(`Saved experiment data for participant ${participantId} in ${mode} mode.`);
    res.json({ 
      success: true,
      message: `Experiment data saved for participant ID: ${participantId}`,
      filepath: filename
    });
  } catch (error) {
    logger.error('Error saving experiment data:', error);
    res.status(500).json({ 
      error: 'Failed to save experiment data',
      details: error.message 
    });
  }
});

// Start server
app.listen(config.server.port, () => {
  logger.info(`${config.app.name} server v${config.app.version} running at http://localhost:${config.server.port}`);
  logger.info('Registered routes:');
  app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
      logger.info(r.route.path);
    }
  });
});
