import express from 'express';
import cors from 'cors';
import config from './config.js';
import { generateWriteQuestion, generateWriteOutput, generateEditQuestion, generateEditOutput, classifyText, generateReplyQuestion, generateReplyOutput } from './openaiModule.js';
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
      const { question, conversationPlanning: updatedPlanning } = await generateWriteQuestion(conversationPlanning);
      
      fs.writeFileSync(
        path.join(tempDir, 'conversation_planning.json'), 
        JSON.stringify(updatedPlanning, null, 2)
      );

      // If the question generation indicates no more questions needed
      if (!updatedPlanning.followup_needed) {
        console.log('\nNo more questions needed. Generating final output...');
        console.log('----------------------------------');
        const output = await generateWriteOutput(updatedPlanning);
        console.log('Generated output:', output);
        console.log('----------------------------------\n');
        
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
      // If followup_needed is false, generate the final output
      console.log('\nGenerating final output...');
      console.log('----------------------------------');
      const output = await generateWriteOutput(conversationPlanning);
      console.log('Generated output:', output);
      console.log('----------------------------------\n');
      
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

// Add new route for edit flow
app.post('/submit-edit-answer', async (req, res) => {
  try {
    const { originalText, conversationPlanning, changedIndex, answer } = req.body;
    console.log('Received edit submission:', { originalText, conversationPlanning, changedIndex, answer });

    // If a response was changed, remove subsequent questions
    let updatedConversationPlanning = { ...conversationPlanning };
    if (typeof changedIndex === 'number') {
      updatedConversationPlanning.questions = conversationPlanning.questions.slice(0, changedIndex + 1);
      if (changedIndex >= 0) {
        updatedConversationPlanning.questions[changedIndex].response = answer;
      }
      updatedConversationPlanning.followup_needed = true;
    }

    // Generate intermediate edited text based on the current conversation
    const editedText = await generateEditOutput(originalText, updatedConversationPlanning);

    if (updatedConversationPlanning.followup_needed) {
      const response = await generateEditQuestion(originalText, updatedConversationPlanning);
      
      // If no more questions needed, generate final output
      if (!response.followup_needed) {
        const output = await generateEditOutput(originalText, updatedConversationPlanning);
        res.json({ 
          output,
          editedText,
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
        conversationPlanning: updatedConversationPlanning,
        editedText,
        followup_needed: true 
      });
    } else {
      const output = await generateEditOutput(originalText, updatedConversationPlanning);
      res.json({ 
        output,
        editedText,
        followup_needed: false 
      });
    }
  } catch (error) {
    console.error('Error processing edit submission:', error);
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

    const classification = await classifyText(text);
    res.json({ type: classification });
  } catch (error) {
    console.error('Error classifying text:', error);
    res.status(500).json({ 
      error: 'Failed to classify text',
      details: error.message 
    });
  }
});

// Add new route for reply flow
app.post('/submit-reply-answer', async (req, res) => {
  try {
    const { originalText, conversationPlanning, changedIndex, answer } = req.body;
    console.log('Received reply submission:', { originalText, conversationPlanning, changedIndex, answer });

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
        const output = await generateReplyOutput(originalText, updatedConversationPlanning);
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
    console.error('Error processing reply submission:', error);
    res.status(500).json({ 
      error: 'Failed to process submission',
      details: error.message 
    });
  }
});

// Start server
app.listen(config.server.port, () => {
  console.log(`${config.app.name} server v${config.app.version} running at http://localhost:${config.server.port}`);
});
