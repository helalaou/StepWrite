import logger from './utils/logger.js';
import fs from 'fs';
import path from 'path';

const config = {
  server: {
    port: 3001,
  },
  client: {
    port: 3000,
  },
  app: {
    name: 'StepWrite',
    version: '1.0.0',
  },
  // Experiment tracking settings
  experiment: {
    enabled: true,
    outputDir: './temp/experiment_data',
  },
  openai: {
    timeout: 70000, // 70 seconds
    
    // Write flow settings
    write: {
      question: {
        model: 'chatgpt-4o-latest',
        temperature: 0.7,
        maxTokens: 100,
      },
      output: {
        model: 'chatgpt-4o-latest',
        temperature: 0.7,
        maxTokens: 10000,
      }
    },

    // Edit flow settings
    edit: {
      question: {
        model: 'chatgpt-4o-latest',
        temperature: 0.7,
        maxTokens: 100,
      },
      output: {
        model: 'chatgpt-4o-latest',
        temperature: 0.7,
        maxTokens: 10000,
      }
    },

    // Reply flow settings
    reply: {
      question: {
        model: 'chatgpt-4o-latest',
        temperature: 0.7,
        maxTokens: 100,
      },
      output: {
        model: 'chatgpt-4o-latest',
        temperature: 0.7,
        maxTokens: 10000,
      }
    },

    // Classification settings
    textTypeClassification: {
      model: 'chatgpt-4o-latest',
      temperature: 0,
      maxTokens: 10,
      validCategories: ['email', 'letter', 'message', 'other'],
      defaultCategory: 'other'
    },

    // fact checking setings
    factChecking: {
      enabled: true,
      maxAttempts: 5,
      check: {
        model: 'chatgpt-4o-latest',
        temperature: 0.3,
        maxTokens: 10000,
      },
      correction: {
        model: 'chatgpt-4o-latest',
        temperature: 0.7,
        maxTokens: 10000,
      }
    },

    // memory settings
    memory: {
      enabled: false,
      filePath: './data/user_memories.json'
    },

    toneClassification: {
      model: 'chatgpt-4o-latest',
      temperature: 0.3,
      maxTokens: 200,
      enabled: true,
      categories: {
        FORMAL: "A formal writing tone common in academic or professional contexts. This tone focuses on being thorough and direct yet respectful. It uses complete words rather than contractions and emphasizes facts and grammatical correctness.",
        INFORMAL: "An informal tone is conversational and expressive, similar to how you'd speak to a friend. It uses contractions, colloquial phrases, and more emotion than formal writing. Its sentence structure can be shorter and feature a choppy rhythm, or it can be long and chatty.",
        OPTIMISTIC: "Writing in an optimistic tone can convey a sense of hope and a positive outlook for the future. It uses uplifting language to express satisfaction and aspiration.",
        WORRIED: "A worried tone can make your reader apprehensive or uneasy. It communicates feelings of anxiousness about something unknown.",
        FRIENDLY: "A friendly tone is warm, nonthreatening, and can elicit trust. Depending on your writing, this tone can also have a mix of formal or informal tones. Generally, it's lighthearted and kind. Exclamation points can convey warmth or enthusiasm.",
        CURIOUS: "A curious tone in your writing tells the reader that there are compelling details that you still want to uncover. Use this tone creatively to keep your reader intrigued about learning more.",
        ASSERTIVE: "An assertive tone exudes confidence and authority. It can also be insistent and straightforward. This tone can help you persuade your audience about a topic.",
        ENCOURAGING: "An encouraging tone is supportive and understanding. It gives readers reassurance to overcome their fears and take action.",
        SURPRISED: "When writing with a surprised tone, you capture how something is unexpected. This tone can elicit different types of astonishment, such as joy or shock.",
        COOPERATIVE: "A cooperative tone is typical in the workplace. Your word choice—often evoking positivity and collaboration—and use of the pronoun we can invite mutual participation toward a shared goal.",
        DIPLOMATIC: "Careful and tactful communication that navigates sensitive topics with consideration for multiple perspectives.",
        EMPATHETIC: "Showing understanding and compassion by acknowledging emotions and experiences.",
        APOLOGETIC: "Expressing regret or making amends with genuine acknowledgment of responsibility.",
        URGENT: "Time-sensitive or important matters requiring immediate attention and action."
      }
    },

    // Initial reply question settings
    initialReplyQuestion: {
      model: 'chatgpt-4o-latest',
      temperature: 0.7,
      maxTokens: 100,
    },
  },

  // logging settings
  
  logging: {
    level: 'debug',
    file: {
      maxSize: 5242880, // 5MB
      maxFiles: 5,
      format: {
        timestamp: 'YYYY-MM-DD HH:mm:ss',
        breakLength: 120
      }
    },
    console: {
      format: {
        timestamp: 'YYYY-MM-DD HH:mm:ss',
        breakLength: 120
      }
    }
  },

  // Audio storage settings
  audio: {
    tts: {
      model: 'tts-1',
      voice: 'nova', // you can find all the supported voices here: https://platform.openai.com/docs/guides/text-to-speech/voices
      format: 'mp3',
      tempDir: './temp/tts',  
      cacheEnabled: true,
      cleanupInterval: 3600000, // 1 hour in milliseconds
    },
    stt: {
      tempDir: './temp/stt',  
      format: 'webm',
      whisper: {
        model: 'whisper-1',
        language: 'en',   
        response_format: 'text'
      }
    }
  },
};

// Create temp directories if they don't exist
try {
  fs.mkdirSync(path.resolve(config.audio.tts.tempDir), { recursive: true });
  fs.mkdirSync(path.resolve(config.audio.stt.tempDir), { recursive: true });
  
  // Create experiment data directory if enabled
  if (config.experiment.enabled) {
    fs.mkdirSync(path.resolve(config.experiment.outputDir), { recursive: true });
  }
} catch (err) {
  if (err.code !== 'EEXIST') {
    logger.error('Failed to create directories:', err);
  }
}

export { logger };
export default config;
