import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
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
import { purgeAudioFiles } from './utils/cleanup.js';
import { chooseVoice, isSafeCacheName, splitForSpeech, TTS_VOICES } from './lib/tts.js';
import { isAllowedOrigin } from './lib/origins.js';
import { validateTurnRequest } from './lib/validation.js';
import { spokenText } from './lib/transcription.js';
import { openai } from './lib/openaiClient.js';
import { openaiCallOptions, withDeadline } from './lib/deadline.js';
import { toFile } from 'openai';

const app = express();

if (config.hosted) {
  // The hosted site's function passes each request on from this machine,
  // with the visitor's address and the site's own in X-Forwarded headers.
  app.set('trust proxy', 'loopback');

  // Every request answers within the budget (lib/deadline.js)
  app.use((req, res, next) => withDeadline(config.hosted.requestBudgetMs, next));

  // Speech requests come several times per question, so they have their own,
  // higher limit than the writing requests.
  const SPEECH_PATHS = ['/api/tts/generate', '/api/transcribe'];
  const isSpeech = req => SPEECH_PATHS.includes(req.path);
  const isWriting = req => req.path.startsWith('/api/') && !isSpeech(req) && req.path !== '/api/health';
  const hourlyLimit = (limit, appliesTo) => rateLimit({
    windowMs: 60 * 60 * 1000,
    limit,
    skip: req => !appliesTo(req),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests from this device for now. Please try again in an hour.' },
  });
  const { writing, speech } = config.hosted.requestsPerHour;
  app.use(hourlyLimit(speech, isSpeech), hourlyLimit(writing, isWriting));
}

// Middleware
app.use(cors((req, callback) => {
  const origin = req.header('Origin');
  // Allow requests with no origin (like mobile apps or curl requests), and on
  // the hosted site the pages it serves from its own address
  const allowed = !origin
    || isAllowedOrigin(origin, config.client.port)
    || (config.hosted && origin === `${req.protocol}://${req.host}`);
  if (!allowed) {
    return callback(new Error('Not allowed by CORS'));
  }
  callback(null, {
    origin: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
}));
app.use(express.json());
// Express 5 leaves req.body undefined when a request has no JSON body; the
// routes below expect an object, as in Express 4.
app.use((req, res, next) => {
  req.body ??= {};
  next();
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.audio.stt.maxUploadBytes }
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
    const { qaFormat, output, originalText } = req.body;
    if (!qaFormat || !output) {
      return res.status(400).json({ error: 'QA format and output are required' });
    }
    const factCheckResult = await performFactCheck(qaFormat, output, originalText);
    res.json(factCheckResult);
  } catch (error) {
    logger.error('Error checking facts:', error);
    res.status(500).json({ 
      error: 'Failed to check facts',
      details: error.message 
    });
  }
});

// Lets the apps' Settings check that a server address is a StepWrite server
app.get('/api/health', (req, res) => {
  res.json({ app: 'StepWrite', status: 'ok' });
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
  const voice = chooseVoice(req.body.voice, config.audio.tts.voice);
  if (!voice) {
    return res.status(400).json({ error: `voice must be one of ${TTS_VOICES.join(', ')}` });
  }

  // Clients that ask for audio (the web app) get the speech itself. The others
  // get a link to the file, which works where every request reaches the same
  // server, unlike on the hosted site.
  const wantsAudio = req.accepts(['json', 'audio/mpeg']) === 'audio/mpeg';

  try {
    // use custom filename for feedback caching or default hash-based filename
    let audioFilename;
    if (cache_as) {
      audioFilename = cache_as;
    } else {
      const hash = crypto.createHash('md5').update(`${voice}\n${text}`).digest('hex');
      audioFilename = `${hash}.${config.audio.tts.format}`;
    }

    const audioPath = path.join(config.audio.tts.tempDir, audioFilename);

    // Check if audio file is already cached
    if (config.audio.tts.cacheEnabled && fs.existsSync(audioPath)) {
      const stats = fs.statSync(audioPath);
      if (stats.size > 0) {
        // Mark the file as recently used so the periodic purge keeps it.
        const now = new Date();
        fs.utimesSync(audioPath, now, now);
        return wantsAudio
          ? res.type(config.audio.tts.format).sendFile(audioPath)
          : res.json({ audioUrl: `/tts/${audioFilename}` });
      }
    }

    // Long texts exceed the endpoint's input limit, so synthesize them in
    // chunks. MP3 frames are self-contained, so the parts play back as one file.
    const audioParts = await Promise.all(splitForSpeech(text).map(async (input) => {
      const response = await openai.audio.speech.create({
        model: config.audio.tts.model,
        voice,
        input,
      }, openaiCallOptions());
      return Buffer.from(await response.arrayBuffer());
    }));
    const buffer = Buffer.concat(audioParts);
    
    // Ensure directory exists
    if (!fs.existsSync(config.audio.tts.tempDir)) {
      fs.mkdirSync(config.audio.tts.tempDir, { recursive: true });
    }
    
    // Write the file
    fs.writeFileSync(audioPath, buffer);

    if (wantsAudio) {
      return res.type(config.audio.tts.format).send(buffer);
    }
    // Always relative: every client prefixes its configured API URL, which
    // already points at the ngrok tunnel in ngrok mode.
    return res.json({ audioUrl: `/tts/${audioFilename}` });
  } catch (error) {
    logger.error('TTS generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate speech',
      details: error.message 
    });
  }
});

// Reject oversized or malformed uploads with a JSON error instead of
// Express's default HTML error page.
const receiveAudio = (req, res, next) => upload.single('audio')(req, res, (error) => {
  if (error) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: error.message });
  }
  next();
});

// Transcribe in memory. The upload's own file name tells Whisper its format
// (the clients send WAV or WebM), so no temp file is needed. Audio without
// speech comes back as empty text, which the clients ignore.
app.post('/api/transcribe', receiveAudio, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  try {
    const { whisper } = config.audio.stt;
    const transcription = await openai.audio.transcriptions.create({
      file: await toFile(req.file.buffer, req.file.originalname || 'audio.wav', { type: req.file.mimetype }),
      model: whisper.model,
      language: whisper.language,
      response_format: whisper.response_format
    }, openaiCallOptions());

    const text = spokenText(transcription, whisper.noSpeechThreshold);
    if (text !== transcription.text.trim()) {
      logger.info(`Dropped transcribed text with no speech: "${transcription.text.trim()}"`);
    }
    res.json({ text });
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

// Purge audio nobody has used for a full interval. A blanket wipe could
// delete a file whose URL was just handed to a client that has not fetched it.
const { cleanupInterval } = config.audio.tts;
setInterval(() => purgeAudioFiles(cleanupInterval), cleanupInterval).unref();

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

    if (typeof participantId !== 'string' || !participantId.trim()) {
      return res.status(400).json({ error: 'Participant ID is required' });
    }

    if (typeof finalOutput !== 'string' || !finalOutput) {
      return res.status(400).json({ error: 'Final output is required' });
    }

    if (typeof textOutput !== 'string' || !textOutput) {
      return res.status(400).json({ error: 'Text output is required' });
    }

    if (!['write', 'reply'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Must be "write" or "reply"' });
    }

    // Sanitize the ID to prevent directory traversal, and timestamp the file so
    // a repeated session never overwrites an earlier one.
    const sanitizedId = participantId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${sanitizedId}_${mode}_${timestamp}_experiment.txt`;
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

    // 'wx' fails instead of overwriting if the name somehow already exists.
    fs.writeFileSync(filepath, content, { flag: 'wx' });

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

// Started by server.js, or run inside the hosted site's function
export default app;
