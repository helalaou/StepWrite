const config = {
  server: {
    port: 3001,
  },
  client: {
    port: 3000,
  },
  app: {
    name: 'GenAssist',
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
    classification: {
      model: 'gpt-4o',
      temperature: 0,
      maxTokens: 10,
      validCategories: ['email', 'letter', 'message', 'other'],
      defaultCategory: 'other'
    }
  },
};

export default config;
