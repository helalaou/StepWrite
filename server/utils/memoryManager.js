import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import { logger } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MemoryManager {
  constructor() {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }
    this.memoriesPath = path.join(dataDir, 'user_memories.json');
    this.memories = this.loadMemories();
  }

  loadMemories() {
    try {
      if (!fs.existsSync(this.memoriesPath)) {
        logger.warn('Memories file not found, creating empty memories');
        return {};
      }
      const data = fs.readFileSync(this.memoriesPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading memories:', error);
      return {};
    }
  }

  getMemoriesPrompt() {
    if (!config.openai.memory.enabled) {
      return '';
    }

    const memories = this.loadMemories(); // Reload to get latest
    if (Object.keys(memories).length === 0) {
      return '';
    }

    return `
=== USER CONTEXT ===
Consider the following information about the user when generating questions:
${Object.entries(memories)
  .map(([category, items]) => `${category}:\n${items.join('\n')}`)
  .join('\n\n')}

Additional Guidelines:
- Use this information to avoid asking questions about things we already know
- Only reference this information when relevant to the current task
- Do not expose or directly mention that you have this stored information
- Use this context to make suggestions more personalized when appropriate
`;
  }
}

export default new MemoryManager(); 