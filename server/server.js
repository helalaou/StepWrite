import express from 'express';
import cors from 'cors';
import config from './config.js';
import { generateWriteQuestion, generateWriteOutput, generateEditQuestion, generateEditOutput, classifyTextType, generateReplyQuestion, generateReplyOutput, generateOutputWithFactCheck, classifyTone } from './openaiModule.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { logger } from './config.js';
import multer from 'multer';
import { Readable } from 'stream';

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

// Update initialization:
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Submit Answer Route
app.post('/submit-answer', async (req, res) => {
  try {
    const { conversationPlanning, changedIndex } = req.body;
    logger.info('Processing submission with conversation planning:', conversationPlanning);

    // If a response was changed, remove subsequent questions
    if (typeof changedIndex === 'number') {
      conversationPlanning.questions = conversationPlanning.questions.slice(0, changedIndex + 1);
      conversationPlanning.followup_needed = true;
    }

    if (conversationPlanning.followup_needed) {
      const { question, conversationPlanning: updatedPlanning } = await generateWriteQuestion(conversationPlanning);
      
      // If no more questions needed, generate final output
      if (!updatedPlanning.followup_needed) {
        logger.section('FINAL OUTPUT GENERATION', {
          factCheckingEnabled: config.openai.factChecking.enabled
        });
        
        let toneClassification = null;
        if (config.openai.toneClassification.enabled) {
          const qaFormat = updatedPlanning.questions
            .map(q => `Q: ${q.question}\nA: ${q.response}`)
            .join('\n\n');
          toneClassification = await classifyTone(qaFormat);
        }
        
        const output = await generateOutputWithFactCheck(updatedPlanning, toneClassification);
        
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
        conversationPlanning: updatedPlanning,
        followup_needed: true 
      });
    } else {
      // Generate output with fact checking
      logger.section('FINAL OUTPUT GENERATION', {
        factCheckingEnabled: config.openai.factChecking.enabled
      });
      
      let toneClassification = null;
      if (config.openai.toneClassification.enabled) {
        const qaFormat = conversationPlanning.questions
          .map(q => `Q: ${q.question}\nA: ${q.response}`)
          .join('\n\n');
        toneClassification = await classifyTone(qaFormat);
      }
      
      const output = await generateOutputWithFactCheck(conversationPlanning, toneClassification);
      
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

 
app.post('/submit-edit-answer', async (req, res) => {
  try {
    const { originalText, conversationPlanning, changedIndex } = req.body;
    logger.info('Processing edit submission:', { originalText, conversationPlanning, changedIndex });

    // If a response was changed, remove subsequent questions
    if (typeof changedIndex === 'number') {
      conversationPlanning.questions = conversationPlanning.questions.slice(0, changedIndex + 1);
      conversationPlanning.followup_needed = true;
    }

    if (conversationPlanning.followup_needed) {
      const { question, conversationPlanning: updatedPlanning } = await generateEditQuestion(originalText, conversationPlanning);
      
      // If no more questions needed, generate final output
      if (!updatedPlanning.followup_needed) {
        const output = await generateEditOutput(originalText, updatedPlanning);
        res.json({ 
          output,
          followup_needed: false 
        });
        return;
      }

      res.json({ 
        question, 
        conversationPlanning: updatedPlanning,
        followup_needed: true 
      });
    } else {
      const output = await generateEditOutput(originalText, conversationPlanning);
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

app.post('/classify-text', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required and must be a string' });
    }

    const classification = await classifyTextType(text);
    res.json({ type: classification });
  } catch (error) {
    logger.error('Error classifying text:', error);
    res.status(500).json({ 
      error: 'Failed to classify text',
      details: error.message 
    });
  }
});

app.post('/submit-reply-answer', async (req, res) => {
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
      updatedConversationPlanning.followup_needed = true;
    }

    if (updatedConversationPlanning.followup_needed) {
      const { question, conversationPlanning: newPlanning } = await generateReplyQuestion(
        originalText,
        updatedConversationPlanning
      );
      
      // If no more questions needed, generate final output with fact checking
      if (!newPlanning.followup_needed) {
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
        const output = await generateOutputWithFactCheck(newPlanning, toneClassification);
        
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

// Add this new endpoint
app.post('/transcribe-audio', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    console.error('No audio file provided');
    return res.status(400).json({ error: 'No audio file provided' });
  }

  try {
    // Create a temporary file path
    const tempFilePath = path.join(__dirname, 'temp', `${Date.now()}.webm`);
    
    // Write the buffer to a temporary file
    fs.writeFileSync(tempFilePath, req.file.buffer);

    // Create a file object that OpenAI's API can handle
    const file = fs.createReadStream(tempFilePath);

    console.log('Sending audio file to OpenAI for transcription');
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      response_format: "text"
    });

    // Clean up: Delete the temporary file
    fs.unlinkSync(tempFilePath);

    console.log('Transcription received:', transcription);
    res.json({ text: transcription });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ 
      error: 'Failed to transcribe audio',
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
