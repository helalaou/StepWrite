import express from 'express';
import cors from 'cors';
import config from './config.js';
import { generateWriteQuestion, generateWriteOutput, generateEditQuestion, generateEditOutput, classifyTextType, generateReplyQuestion, generateReplyOutput, generateOutputWithFactCheck, classifyTone } from './openaiModule.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { logger } from './config.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Submit Answer Route
app.post('/submit-answer', async (req, res) => {
  // ... write route implementation ...
});

// Add new route for edit flow
app.post('/submit-edit-answer', async (req, res) => {
  // ... edit route implementation ...
});

app.post('/classify-text', async (req, res) => {
  // ... classify route implementation ...
});

// Add new route for reply flow
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
