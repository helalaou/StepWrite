import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import { logger } from '../config.js';
import { memoryPrompt, memoryFactCheckPrompt } from '../prompts/memoryPrompt.js';

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

  isEnabled() {
    return config.openai.memory.enabled && this.memories && Object.keys(this.memories).length > 0;
  }

  getMemoriesPrompt() {
    if (!this.isEnabled()) {
      return '';
    }
    return memoryPrompt(this.memories);
  }

  getMemoryFactCheckPrompt() {
    if (!this.isEnabled()) {
      return '';
    }
    return memoryFactCheckPrompt(this.memories);
  }

  getUserName() {
    if (!this.isEnabled()) {
      return null;
    }
    
    // Return the user's name from memories if available
    return this.memories.name || this.memories.fullName || null;
  }
}

export default new MemoryManager(); 