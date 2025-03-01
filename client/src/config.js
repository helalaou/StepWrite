const config = {
  // ====== CORE APPLICATION SETTINGS ======
  // Base server URL for API calls
  serverUrl: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3001',  // Remove one of these

  // Application metadata
  app: {
    name: 'StepWrite',
    version: '1.0.0',
  },

  // ====== INPUT MODE CONFIGURATION ======
  input: {
    // Controls how users can input their responses
    // Values: 'TEXT_ONLY' | 'HANDS_FREE' | 'TEXT_AND_VOICE'
    mode: process.env.REACT_APP_INPUT_MODE || 'HANDS_FREE',
  },

  // ====== TEXT-TO-SPEECH SETTINGS ======
  // Used in: SpeakButton.js, VoiceOnlyInterface.js
  tts: {
    mode: process.env.REACT_APP_TTS_MODE || 'ENABLED',  // 'ENABLED' | 'DISABLED'
  },

  // ====== API ENDPOINTS ======
  // Used across components for API calls
  endpoints: {
    write: '/api/write',
    reply: '/api/reply',
    edit: '/api/edit',
    classifyTextType: '/api/classify/text-type',
    classifyTone: '/api/classify/tone',
    factCheck: '/api/fact-check',
    tts: '/api/tts/generate',
    transcribe: '/api/transcribe'
  },

  // ====== HANDS-FREE MODE SETTINGS ======
  // Used in: HandsFreeInterface.js
  handsFreeMode: {
    // Voice commands configuration
    commands: {
      skip: {
        phrases: [
          'skip',
          'skip question', 
          'skip this',
          'skip this question',
          'i want to skip',
          'i want to skip this',
          'i want to skip this question'
        ],
        response: 'user has skipped this question'
      },
      next: {
        phrases: [
          'next',
          'next question',
          'go to next',
          'go to next question',
        ],
        response: 'Moving to next question'
      },
      previous: {
        phrases: [
          'previous',
          'previous question',
          'go to previous',
          'go to previous question'
        ],
        response: 'Moving to previous question'
      },
      toEditor: {
        phrases: [
          'next',
          'next question',
          'go to editor',
          'open editor',
          'move to editor',
          'switch to editor',
          'editor', 
        ],
        response: 'Moving to editor'
      },
      toQuestions: {
        phrases: [
          'previous',
          'previous question',
          'go back to questions',
          'go back',
          'back to questions',
          'return to questions',
        ],
        response: 'Returning to questions'
      },
      modify: {
        phrases: [
          'modify',
          'modify this',
          'modify this question',
          'modify question',
          'modify this response',
          'i want to modify',
          'i want to modify this',
        ],
        response: 'Modifying this question'
      }
    },
    
    // Controls question replay behavior when no speech is detected
    replay: {
      interval: 9000,             // Range: 5000-30000ms, Time before replaying question
      maxAttempts: Infinity       // Number of replay attempts before giving up
    },
    
    // Controls when to finalize and submit speech
    // Longer delay = more time for users to think and continue speaking
    // Shorter delay = faster response but might cut off thoughts
    concatenation: {
      finalizeDelay: 2700,        // Range: 3000-10000ms, Wait time before submitting
    },

    // Audio processing settings for hands-free mode
    audio: {
      minEnergy: 0.005,           // Range: 0.001-0.1, Minimum amplitude for valid speech
      significantThreshold: 0.005, // Range: 0.001-0.1, Threshold for significant audio
      minSignificantRatio: 0.1,   // Range: 0.1-0.5, Minimum ratio of significant samples
      // Audio quality settings
      sampleRate: 16000,          // Sample rate for audio processing
      channels: 1,                // Mono audio
      audioBitsPerSecond: 128000  // Audio quality in bits/sec
    },
    
    // Voice Activity Detection settings
    vad: {
      minSpeechFrames: 3,         // Range: 3-30, Minimum frames for speech detection
      preSpeechPadFrames: 2,      // Range: 1-10, Frames to keep before speech
      positiveSpeechThreshold: 0.70, // Range: 0.5-0.95, Confidence for positive detection
      negativeSpeechThreshold: 0.60, // Range: 0.5-0.90, Confidence for negative detection
      redemptionFrames: 3,        // Range: 1-10, Frames to wait before confirming end
      mode: 3,                    // Range: 0-3, VAD aggressiveness (3 = most aggressive)
    },

    // Status messages shown in the UI during hands-free operation
    ui: {
      messages: {
        waiting: 'Waiting for speech...',
        recording: 'Recording...',
        processing: 'Processing...'
      }
    }
  },

  // ====== TEXT_AND_VOICE MODE SETTINGS ======
  // Used in: VoiceInput.js for hybrid text/voice input
  recording: {
    // Audio processing settings
    volumeThreshold: 0.02,        // Range: 0.01-1.0, Lower = more sensitive
    fftSize: 1024,               // Size of FFT window (values: 256, 512, 1024, 2048, 4096)
    audioBitsPerSecond: 128000,   // Audio quality in bits/sec (range: 64000-256000)
    chunkSize: 3000,             // Milliseconds per audio chunk (range: 1000-10000)
    logInterval: 300,            // How often to log audio levels in ms (range: 100-1000)

    // Noise reduction settings for better voice recognition
    noiseReduction: {
      floorMultiplier: 1.2,       // Range: 1.0-3.0, Lower = keep more quiet sounds
      maxNoisePercent: 80,        // Range: 50-95, Higher = more tolerant of noise
      minSignificantPercent: 15,  // Range: 1-50, Lower = accept shorter speech
      sampleSize: 2000            // Range: 500-5000, Higher = more accurate noise detection
    }
  },

  // ====== SYSTEM SETTINGS ======
  // Used in API calls
  llm: {
    timeout: 70000, // Range: 10000-120000ms, Maximum time to wait for LLM response
  }
};

export default config;