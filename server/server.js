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
    logger.info('Received reply submission:', { originalText, conversationPlanning, changedIndex, answer });

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
      const response = await generateReplyQuestion(originalText, updatedConversationPlanning);
      
      // If no more questions needed, generate final output
      if (!response.followup_needed) {
        const qaFormat = updatedConversationPlanning.questions
          .map(q => `Q: ${q.question}\nA: ${q.response}`)
          .join('\n\n');

        let toneClassification = null;
        if (config.openai.toneClassification.enabled) {
          toneClassification = await classifyTone(qaFormat, originalText);
        }

        const output = await generateReplyOutput(originalText, updatedConversationPlanning, toneClassification);
        res.json({ 
          output,
          followup_needed: false 
        });
        return;
      }

      // Add the new question to the conversation planning
      const newQuestion = {
        id: updatedConversationPlanning.questions.length + 1,
        question: response.question,
        response: ''
      };

      updatedConversationPlanning.questions.push(newQuestion);
      updatedConversationPlanning.followup_needed = response.followup_needed;

      res.json({ 
        question: response.question,
        conversationPlanning: updatedConversationPlanning,
        followup_needed: true 
      });
    } else {
      const output = await generateReplyOutput(originalText, updatedConversationPlanning);
      res.json({ 
        output,
        followup_needed: false 
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
