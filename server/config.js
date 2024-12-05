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
    model: 'gpt-4',
    timeout: 70000, //    70 seconds
  },
};

export default config;
