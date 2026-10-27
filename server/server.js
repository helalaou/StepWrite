import express from 'express';
import cors from 'cors';
import config from './config.js';
import {
  classifyTextType,
  classifyTone,
  generateInitialReplyQuestion,
  performFactCheck
} from './openaiModule.js';
import { runConversationTurn, writeFlow, editFlow, forceFollowup } from './conversation.js';
import fs from 'fs';
import path from 'path';
import { logger } from './config.js';
import multer from 'multer';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import cookieParser from 'cookie-parser';
import { cleanupOnStartup } from './utils/cleanup.js';
import { isSafeCacheName } from './lib/tts.js';
import { isAllowedOrigin } from './lib/origins.js';
import { validateTurnRequest } from './lib/validation.js';
import { openai } from './lib/openaiClient.js';

const app = express();

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (isAllowedOrigin(origin, config.client.port)) {
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

// Run one conversation turn for the flow chosen from the request body.
const handleConversationTurn = (selectFlow) => async (req, res) => {
  const validationError = validateTurnRequest(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const flow = selectFlow(req.body);
  try {
    logger.info(`Processing ${flow.name} submission:`, req.body);
    res.json(await runConversationTurn(flow, req.body));
  } catch (error) {
    logger.error(`Error processing ${flow.name} submission:`, error);
    res.status(500).json({
      error: 'Failed to process submission',
      details: error.message
    });
  }
};

app.post('/api/write', handleConversationTurn(body => writeFlow(body.context)));
app.post('/api/reply', handleConversationTurn(body => writeFlow(body.originalText)));
app.post('/api/edit', handleConversationTurn(body => editFlow(body.originalText)));

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

// TTS endpoint
app.post('/api/tts/generate', async (req, res) => {
  const { text, cache_as } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required and must be a string' });
  }
  if (cache_as !== undefined && !isSafeCacheName(cache_as)) {
    return res.status(400).json({ error: 'cache_as must be a plain .mp3 file name' });
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
    
    const updatedPlanning = forceFollowup(conversationPlanning, action === 'continue');

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
