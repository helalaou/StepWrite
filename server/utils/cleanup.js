import fs from 'fs';
import path from 'path';
import config from '../config.js';
import { logger } from '../config.js';

export const cleanupOnStartup = () => {
  const ttsTempDir = config.audio.tts.tempDir;
  
  // Clean up TTS directory
  if (fs.existsSync(ttsTempDir)) {
    try {
      fs.rmSync(ttsTempDir, { recursive: true, force: true });
      fs.mkdirSync(ttsTempDir, { recursive: true });
      logger.info('Cleaned up TTS directory on startup');
    } catch (error) {
      logger.error('Failed to cleanup TTS directory on startup:', error);
    }
  }
}; 