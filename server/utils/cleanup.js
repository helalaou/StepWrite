import fs from 'fs';
import path from 'path';
import config, { logger } from '../config.js';

// Delete TTS files not written or reused within maxAgeMs. With maxAgeMs = 0
// every file goes, which is only safe when no client can still fetch one.
export const purgeAudioFiles = (maxAgeMs = 0) => {
  const ttsTempDir = config.audio.tts.tempDir;
  if (!fs.existsSync(ttsTempDir)) return;

  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;

  for (const file of fs.readdirSync(ttsTempDir)) {
    const filePath = path.join(ttsTempDir, file);
    try {
      if (fs.statSync(filePath).mtimeMs <= cutoff) {
        fs.unlinkSync(filePath);
        removed++;
      }
    } catch (error) {
      logger.error(`Failed to delete TTS file ${filePath}:`, error);
    }
  }

  if (removed > 0) {
    logger.info(`Removed ${removed} TTS file(s)`);
  }
};
