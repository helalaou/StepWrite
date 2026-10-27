import OpenAI from 'openai';
import config from '../config.js';

// Single client for every OpenAI call (chat, speech and transcription), so all
// of them share the configured timeout. config.js loads .env before this runs.
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: config.openai.timeout,
});
