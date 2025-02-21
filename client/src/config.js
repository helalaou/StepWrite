const config = {
  serverUrl: 'http://localhost:3001',
  app: {
    name: 'StepWrite',
    version: '1.0.0',
  },
  llm: {
    timeout: 70000, //      70 seconds 
  },
  
  // Settings to control the input mode
  input: {
    // Only uncomment one mode at a time
    mode: 'TEXT_AND_VOICE',  // Default mode - both text input and voice button
    // mode: 'TEXT_ONLY',    // Only text input, no voice button
    // mode: 'VOICE_ONLY',   // Only voice input, auto-starts recording
  }
};
export default config;
