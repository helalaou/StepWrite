import fs from 'fs';
import config from '../config.js';
import { logger } from '../config.js';
import { memoryPrompt, memoryFactCheckPrompt } from '../prompts/memoryPrompt.js';

class MemoryManager {
  constructor() {
    this.memoriesPath = config.openai.memory.filePath;
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
    
    // Names live under personalInfo in user_memories.json; templates greet by first name.
    const info = this.memories.personalInfo || {};
    return info.firstName || info.fullName || null;
  }
}

export default new MemoryManager(); 