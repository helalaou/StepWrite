import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import { logger } from '../config.js';
import { memoryPrompt } from '../prompts/memoryPrompt.js';

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
    return memoryPrompt(memories);
  }
}

export default new MemoryManager(); 