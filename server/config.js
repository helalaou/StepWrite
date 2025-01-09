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
    defaultModel: 'gpt-4o',
    question_generation_settings: {
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 5000,
    },
    output_generation_settings: {
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 5000,
    }
  },
};

export default config;
