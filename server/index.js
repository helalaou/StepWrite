import express from 'express';
import cors from 'cors';
import axios from 'axios';
import config from './config.js';

const app = express();
const port = config.server.port;

app.use(cors({
  origin: `http://localhost:${config.client.port}`, // Allow requests from React app
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const OLLAMA_API_URL = config.server.ollamaApiUrl;

// Function to call Ollama LLM with a timeout
async function runOllama(prompt, timeout = config.llm.timeout) {
  try {
    console.log('Starting Ollama request with prompt:', prompt);
    const response = await axios.post(
      OLLAMA_API_URL,
      {
        model: config.llm.model,
        prompt: prompt,
        stream: false,
      },
      { timeout: timeout }
    );
    console.log('Ollama response received:', response.data.response);
    return response.data.response.trim();
  } catch (error) {
    console.error('Error in runOllama:', error.message);
    throw error;
  }
}

// Generate Response Route
app.post('/generate', async (req, res) => {
  try {
    const { text } = req.body;
    console.log('Received request to generate response');

    console.log('Running Ollama');
    const generatedText = await runOllama(text);
    console.log('Sending generated response');
    res.json({ generated_text: generatedText });
  } catch (error) {
    console.error('Error in /generate route:', error);
    res.status(500).json({ error: 'An error occurred while generating the response.' });
  }
});

// Test Route
app.get('/test', (req, res) => {
  console.log('Test route hit');
  res.json({ message: 'Server is working' });
});

// Start the server
app.listen(port, () => {
  console.log(`${config.app.name} server v${config.app.version} running at http://localhost:${port}`);
  console.log('Registered routes:');
  app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
      console.log(r.route.path);
    }
  });
}); 