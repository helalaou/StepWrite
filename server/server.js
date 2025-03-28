import express from 'express';
import cors from 'cors';
import config from './config.js';
import { generateWriteQuestion, generateWriteOutput, generateEditQuestion, generateEditOutput, classifyTextType, generateReplyQuestion, generateReplyOutput, generateOutputWithFactCheck, classifyTone, generateInitialReplyQuestion } from './openaiModule.js';
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
  origin: `http://localhost:${config.client.port}`,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Submit Answer Route
app.post('/api/write', async (req, res) => {
  try {
    const { conversationPlanning, changedIndex, context, isFinishCommand } = req.body;
    logger.info('Processing submission with conversation planning:', conversationPlanning);

    // if a response was changed, remove subsequent questions
    let updatedPlanning = { ...conversationPlanning };
    if (typeof changedIndex === 'number') {
      updatedPlanning.questions = updatedPlanning.questions.slice(0, changedIndex + 1);
      // oonly force followup if not a finish command
      if (!isFinishCommand) {
        updatedPlanning = updateFollowupStatus(updatedPlanning, true);
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

      res.json({ 
        question, 
        conversationPlanning: newPlanning,
        followup_needed: true 
      });
    } else {
      // Generate output with fact checking
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
    const { originalText, conversationPlanning, changedIndex } = req.body;
    logger.info('Processing edit submission:', { originalText, conversationPlanning, changedIndex });

    // If a response was changed, remove subsequent questions
    let updatedPlanning = { ...conversationPlanning };
    if (typeof changedIndex === 'number') {
      updatedPlanning.questions = updatedPlanning.questions.slice(0, changedIndex + 1);
      updatedPlanning = updateFollowupStatus(updatedPlanning, true);
    }

    if (isFollowupNeeded(updatedPlanning)) {
      const { question, conversationPlanning: newPlanning } = await generateEditQuestion(originalText, updatedPlanning);
      
      // If no more questions needed, generate final output
      if (!isFollowupNeeded(newPlanning)) {
        const output = await generateEditOutput(originalText, newPlanning);
        res.json({ 
          output,
          followup_needed: false 
        });
        return;
      }

      res.json({ 
        question, 
        conversationPlanning: newPlanning,
        followup_needed: true 
      });
    } else {
      const output = await generateEditOutput(originalText, updatedPlanning);
      res.json({ 
        output,
        followup_needed: false 
      });
    }
  } catch (error) {
    logger.error('Error processing edit submission:', error);
    res.status(500).json({ 
      error: 'Failed to process submission',
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
    const { originalText, conversationPlanning, changedIndex, answer } = req.body;
    logger.section('PROCESSING REPLY SUBMISSION', {
      originalText,
      conversationPlanning,
      changedIndex,
      answer,
      questionsCount: conversationPlanning?.questions?.length || 0
    });

    // If a response was changed, remove subsequent questions
    let updatedConversationPlanning = { ...conversationPlanning };
    if (typeof changedIndex === 'number') {
      updatedConversationPlanning.questions = conversationPlanning.questions.slice(0, changedIndex + 1);
      if (changedIndex >= 0) {
        updatedConversationPlanning.questions[changedIndex].response = answer;
      }
      updatedConversationPlanning = updateFollowupStatus(updatedConversationPlanning, true);
    }

    if (isFollowupNeeded(updatedConversationPlanning)) {
      const { question, conversationPlanning: newPlanning } = await generateReplyQuestion(
        originalText,
        updatedConversationPlanning
      );
      
      // If no more questions needed, generate final output with fact checking
      if (!isFollowupNeeded(newPlanning)) {
        logger.section('FINAL OUTPUT GENERATION', {
          factCheckingEnabled: config.openai.factChecking.enabled
        });

        // First get tone classification
        let toneClassification = null;
        if (config.openai.toneClassification.enabled) {
          const qaFormat = newPlanning.questions
            .map(q => `Q: ${q.question}\nA: ${q.response}`)
            .join('\n\n');
          toneClassification = await classifyTone(qaFormat, originalText);
        }
        
        // Then generate output with fact checking
        const output = await generateOutputWithFactCheck(newPlanning, toneClassification, originalText);
        
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

      res.json({ 
        question,
        conversationPlanning: newPlanning,
        followup_needed: true 
      });
    } else {
      // If no followup needed, start with first question
      const { question, conversationPlanning: newPlanning } = await generateReplyQuestion(
        originalText,
        updatedConversationPlanning
      );

      res.json({
        question,
        conversationPlanning: newPlanning,
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
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    const hash = crypto.createHash('md5').update(text).digest('hex');
    const audioFilename = `${hash}.${config.audio.tts.format}`;
    const audioPath = path.join(config.audio.tts.tempDir, audioFilename);

    const sessionFiles = sessions.get(req.sessionId) || new Set();
    sessionFiles.add(audioPath);
    sessions.set(req.sessionId, sessionFiles);

    if (config.audio.tts.cacheEnabled && fs.existsSync(audioPath)) {
      const stats = fs.statSync(audioPath);
      if (stats.size > 0) {
        return res.json({ audioUrl: `/tts/${audioFilename}` });  
      }
    }

    const response = await openai.audio.speech.create({
      model: config.audio.tts.model,
      voice: config.audio.tts.voice,
      input: text,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(audioPath, buffer);

    res.json({ audioUrl: `/tts/${audioFilename}` });   
  } catch (error) {
    logger.error('TTS generation error:', error);
    res.status(500).json({ error: 'Failed to generate speech' });
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

    const { participantId, mode, modifyCount, skipCount, finalOutput } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: 'Participant ID is required' });
    }

    if (!finalOutput) {
      return res.status(400).json({ error: 'Final output is required' });
    }

    if (!['write', 'reply'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Must be "write" or "reply"' });
    }

    // Create a sanitized filename to prevent directory traversal
    const sanitizedId = participantId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${sanitizedId}_${mode}_experiment.txt`;
    const filepath = path.join(config.experiment.outputDir, filename);

    // Prepare content for the file
    const content = `user_id: ${participantId}
number of times the user used the modify command: ${modifyCount || 0}
number of times the user skipped a question: ${skipCount || 0}
final output:
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
