const config = {
  serverUrl: 'http://localhost:3001',
  app: {
    name: 'StepWrite',
    version: '1.0.0',
  },
  llm: {
    timeout: 70000, // Timeout in milliseconds (range: 10000-120000)
  },
  
  // Settings to control the input mode 
  input: {
    // Only uncomment one mode at a time
    mode: process.env.REACT_APP_INPUT_MODE || 'TEXT_AND_VOICE',  // 'TEXT_ONLY', 'VOICE_ONLY', 'TEXT_AND_VOICE'
  },

  recording: {
    volumeThreshold: 0.02,        // Threshold for detecting speech (range: 0.01-1.0). Lower = more sensitive
    fftSize: 1024,               // Size of FFT window (values: 256, 512, 1024, 2048, 4096)
    audioBitsPerSecond: 128000,   // Audio quality in bits/sec (range: 64000-256000)
    chunkSize: 3000,             // Milliseconds per audio chunk (range: 1000-10000)
    logInterval: 300,            // How often to log audio levels in ms (range: 100-1000)
  
    noiseReduction: {
      // How much above noise floor to consider as signal
      floorMultiplier: 1.2,      // (range: 1.0-3.0) Lower = keep more quiet sounds
      
      // maximum % of recording that can be noise before rejecting
      maxNoisePercent: 80,       // (range: 50-95) Higher = more tolerant of noise
      
      // Minimum % of samples that must contain speech
      minSignificantPercent: 15, // (range: 1-50) Lower = accept shorter speech segments
      
      //number of samples to analyze for noise floor
      sampleSize: 2000           // (range: 500-5000) Higher = more accurate noise detection
    }
  },

   // TTS configuration
   tts: {
    mode: process.env.REACT_APP_TTS_MODE || 'ENABLED',  // 'ENABLED', 'DISABLED'
  },


  // API URL configuration
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3001',   

  endpoints: {
    write: '/api/write',
    reply: '/api/reply',
    edit: '/api/edit',
    classifyTextType: '/api/classify/text-type',
    classifyTone: '/api/classify/tone',
    factCheck: '/api/check/facts',
    tts: '/api/tts/generate',
    transcribe: '/api/transcribe'
  }
};

export default config;
