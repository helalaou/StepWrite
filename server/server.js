import express from 'express';
import cors from 'cors';
import config from './config.js';
import { generateQuestion, generateOutput } from './openaiModule.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

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
  try {
    const { conversationPlanning, changedIndex } = req.body;
    console.log('Processing submission with conversation planning:', conversationPlanning);

    // If a response was changed, remove subsequent questions
    if (typeof changedIndex === 'number') {
      conversationPlanning.questions = conversationPlanning.questions.slice(0, changedIndex + 1);
      // Ensure followup_needed is true when editing responses
      conversationPlanning.followup_needed = true;
    }

    // Save conversation state
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    if (conversationPlanning.followup_needed) {
      const { question, conversationPlanning: updatedPlanning } = await generateQuestion(conversationPlanning);
      
      fs.writeFileSync(
        path.join(tempDir, 'conversation_planning.json'), 
        JSON.stringify(updatedPlanning, null, 2)
      );

      res.json({ 
        question, 
        conversationPlanning: updatedPlanning,
        followup_needed: true 
      });
    } else {
      console.log('\nFinal output:');
      console.log('\n----------------------------------');
      const output = await generateOutput(conversationPlanning);
      console.log('\n----------------------------------');
      res.json({ 
        output,
        followup_needed: false 
      });
    }
  } catch (error) {
    console.error('Error processing submission:', error);
    res.status(500).json({ error: 'Failed to process submission' });
  }
});

// Start server
app.listen(config.server.port, () => {
  console.log(`${config.app.name} server v${config.app.version} running at http://localhost:${config.server.port}`);
});
