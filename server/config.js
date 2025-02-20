import logger from './utils/logger.js';

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
  openai: {
    timeout: 70000, // 70 seconds
    
    // Write flow settings
    write: {
      question: {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 30,
      },
      output: {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 10000,
      }
    },

    // Edit flow settings
    edit: {
      question: {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 30,
      },
      output: {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 10000,
      }
    },

    // Reply flow settings
    reply: {
      question: {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 30,
      },
      output: {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 10000,
      }
    },

    // Classification settings
    textTypeClassification: {
      model: 'gpt-4o',
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
        model: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 10000,
      },
      correction: {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 10000,
      }
    },

    // memory settings
    memory: {
      enabled: true,
      filePath: './data/user_memories.json'
    },

    toneClassification: {
      model: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 200,
      enabled: true,
      categories: {
        FORMAL_PROFESSIONAL: 'Strict business communication',
        FORMAL_FRIENDLY: 'Professional but warm',
        INFORMAL_RESPECTFUL: 'Casual but maintaining respect',
        INFORMAL_CASUAL: 'Very relaxed and friendly',
        INFORMAL_INTIMATE: 'Close personal relationships',
        ACADEMIC: 'Scholarly or educational context',
        TECHNICAL: 'Technical or specialized field',
        DIPLOMATIC: 'Careful and tactful',
        EMPATHETIC: 'Showing understanding and compassion',
        ASSERTIVE: 'Direct and confident',
        APOLOGETIC: 'Expressing regret or making amends',
        URGENT: 'Time-sensitive or important matters'
      }
    }
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
  }
};

export { logger };
export default config;
