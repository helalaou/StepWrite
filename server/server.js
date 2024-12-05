import express from 'express';
import cors from 'cors';
import config from './config.js';
import { generateQuestion, generateOutput } from './ollamaModule.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = config.server.port;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
  origin: `http://localhost:${config.client.port}`,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Submit Answer Route
app.post('/submit-answer', async (req, res) => {
  try {
    const { conversationPlanning } = req.body;
    console.log('Received request to submit answer with conversation planning:', conversationPlanning);

    // Save conversation planning to local file
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    if (conversationPlanning.followup_needed) {
      console.log('Generating next question...');
      const response = await generateQuestion(conversationPlanning);
      const { question, conversationPlanning: updatedConversationPlanning } = response;
      
      fs.writeFileSync(
        path.join(tempDir, 'conversation_planning.json'), 
        JSON.stringify(updatedConversationPlanning, null, 2)
      );
      console.log('Sending question response:', question);
      res.json({ 
        question, 
        conversationPlanning: updatedConversationPlanning,
        followup_needed: true 
      });
    } else {
      console.log('Generating final output...');
      const output = await generateOutput(conversationPlanning);
      console.log('Sending output response:', output);
      res.json({ output });
    }
  } catch (error) {
    console.error('Error in /submit-answer route:', error);
    res.status(500).json({ error: 'An error occurred while submitting the answer.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`${config.app.name} server v${config.app.version} running at http://localhost:${port}`);
});
