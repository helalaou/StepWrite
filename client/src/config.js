// ====== CORE APPLICATION SETTINGS ======
// These settings are used across the entire application

// Helper function to get environment variables with defaults
const getEnvVar = (name, defaultValue) => process.env[name] || defaultValue;

const config = {
  // Core application settings
  core: {
    // API URLs
    apiUrl: getEnvVar('REACT_APP_API_URL', 'http://localhost:3001'),

    // Application metadata
    app: {
      name: 'StepWrite',
      version: '1.0.0',
    },

    // API endpoints used across components
    endpoints: {
      write: '/api/write',
      reply: '/api/reply',
      edit: '/api/edit',
      classifyTextType: '/api/classify/text-type',
      classifyTone: '/api/classify/tone',
      factCheck: '/api/fact-check',
      tts: '/api/tts/generate',
      transcribe: '/api/transcribe',
      initialReplyQuestion: '/api/generate-initial-reply-question',
      saveExperimentData: '/api/save-experiment-data'
    },

    // System settings
    llm: {
      timeout: 70000, // Range: 10000-120000ms, Maximum time to wait for LLM response
    },

    // Static email for reply flow
    reply_email:
      `Subject: Follow-Up on Your Application for Administrative Assistant Position
Hi there,
Thank you for applying for the Administrative Assistant position at [Company Name]. We were impressed by your initial application and would like to gather a few additional details to move forward in the process:
Can you confirm your expected graduation date, if applicable?
Are you legally authorized to work in the U.S., and will you require visa sponsorship now or in the future?
When would you be available to start, if offered the position?
What is your preferred working schedule (e.g., full-time, part-time, hybrid, remote)?
Do you have any prior experience with office software or tools, such as Microsoft Office, Google Workspace, or scheduling systems?
Is there anything else you would like us to know about your background or availability?
We look forward to hearing from you soon!
Best regards,`
  },

  // ====== EXPERIMENT TRACKING SETTINGS ======
  experiment: {
    enabled: true,  //enable/disable experiment tracking functionality
    outputDir: 'experiment_data', // Directory to store experiment output files
    participantIdRequired: true, // Whether participant ID is required before starting
  },

  // ====== INPUT MODE CONFIGURATION ======
  // Controls how users can input their responses
  input: {
    // Values: 'TEXT_ONLY' | 'HANDS_FREE' | 'TEXT_AND_VOICE'
    mode: getEnvVar('REACT_APP_INPUT_MODE', 'HANDS_FREE'),
  },

  // ====== TEXT-TO-SPEECH SETTINGS ======
  // Used in: SpeakButton.js
  tts: {
    mode: getEnvVar('REACT_APP_TTS_MODE', 'ENABLED'),  // 'ENABLED' | 'DISABLED'
    outputPrefix: getEnvVar('REACT_APP_TEXT_EDITOR_TTS_PREFIX', 'The final output is:'), // Prefix text before playing the output to the user
  },

  // ====== VOICE INPUT MODES ======
  // Settings for different voice input modes

  // 1. HANDS-FREE MODE SETTINGS
  // Used in: HandsFreeInterface.js, TextEditor.js (for voice commands)
  handsFree: {
    // Voice Activity Detection and Audio Processing settings
    vad: {
      // Speech detection settings
      minSpeechFrames: 4,             // Range: 3-30, Minimum frames for speech detection
      preSpeechPadFrames: 8,         // Range: 1-10, Frames to keep before speech 
      positiveSpeechThreshold: 0.80,   // Range: 0.5-0.95, Confidence for positive detection 
      negativeSpeechThreshold: 0.70,  // Range: 0.5-0.90, Confidence for negative detection
      redemptionFrames: 8,           // Range: 1-10, Frames to wait before confirming end 
      mode: 2,                        // Range: 0-3, VAD aggressiveness (3 = most aggressive)

      // Energy-based speech detection
      minEnergy: 0.004,               // Range: 0.001-0.1, Minimum amplitude for valid speech
      significantThreshold: 0.004,    // Range: 0.001-0.1, Threshold for significant audio
      minSignificantRatio: 0.20,       // Range: 0.1-0.5, Minimum ratio of significant samples

      // Audio quality settings
      sampleRate: 16000,              // Sample rate for audio processing
      channels: 1,                    // Mono audio
    },

    // Controls when to finalize and submit speech
    speech: {
      finalizeDelay: 2500,            // Range: 3000-10000ms, Wait time before submitting
      // Controls question replay behavior when no speech is detected
      replay: {
        maxAttempts: Infinity,        // Number of replay attempts before giving up
        minimumQuietPeriod: 12000,    // Range: 5000-20000ms, Minimum silence required after speech detection before TTS can play again / prevents TTS from interrupting during natural pauses in speech
        nonFirstQuestionDelay: 1500,  // Range: 500-3000ms, delay before playing TTS for non-first questions to ensure the audio clips are generated
      },
    },

    // Voice commands configuration
    commands: {
      // Command behavior settings
      behavior: {
        matching: {
          mode: getEnvVar('REACT_APP_COMMAND_MATCHING_MODE', 'FUZZY'), // EXACT (entire phrase is an exact match) | CONTAINS (speech must contain the command) | FUZZY (word by word match with confidence trheshold)
          minConfidence: 0.85,   // Only used in FUZZY mode - higher = more strict
          ignoreArticles: true //whether to ignore articles when matching 
        }
      },

      // HandsFree interface commands
      handsFree: {
        skip: {
          phrases: [
            'skip question',
            'skip this question',
            'i want to skip this question',
            'skip to next question',
            'skip to the next question',
            'i want to skip to next question',
            'skip this and continue',
            'skip this question and continue',
            'skip this and move on',
            'skip this question and move on'
          ],
          response: 'user has skipped this question'
        },
        next: {
          phrases: [
            'next question',
            'go to next question',
            'move to next question',
            'proceed to next question',
            'continue to next question',
            'go to the next question',
            'move to the next question',
            'proceed to the next question',
            'continue to the next question',
            'next question please',
            'go to next question please',
            'move to next question please',
            'proceed to next question please',
            'continue to next question please'
          ],
          response: 'Moving to next question'
        },
        previous: {
          phrases: [
            'previous question',
            'go to previous question',
            'move to previous question',
            'go back to previous question',
            'return to previous question',
            'go to the previous question',
            'move to the previous question',
            'go back to the previous question',
            'return to the previous question',
            'previous question please',
            'go to previous question please',
            'move to previous question please',
            'go back to previous question please',
            'return to previous question please'
          ],
          response: 'Moving to previous question'
        },
        toEditor: {
          phrases: [
            'next question',
            'go to editor',
            'open editor',
            'move to editor',
            'switch to editor',
            'back to editor',
            'return to editor',
            'go to the editor',
            'open the editor',
            'move to the editor',
            'switch to the editor',
            'back to the editor',
            'return to the editor',
            'go to editor please',
            'open editor please',
            'move to editor please',
            'switch to editor please',
            'back to editor please',
            'return to editor please'
          ],
          response: 'Moving to editor'
        },
        toHome: {
          phrases: [
            'go to home',
            'go to home page',
            'go to homepage',
            'return to home',
            'return to home page',
            'return to homepage',
            'back to home',
            'back to home page',
            'back to homepage',
            'go to the home',
            'go to the home page',
            'go to the homepage',
            'return to the home',
            'return to the home page',
            'return to the homepage',
            'back to the home',
            'back to the home page',
            'back to the homepage',
            'go to landing page',
            'go to the landing page',
            'return to landing page',
            'return to the landing page',
            'back to landing page',
            'back to the landing page'
          ],
          response: 'Returning to home page'
        },
        modify: {
          phrases: [
            'modify question',
            'modify this question',
            'modify this response',
            'modify this answer',
            'i want to modify this question',
            'i want to modify this response',
            'i want to modify this answer',
            'change this question',
            'change this response',
            'change this answer',
            'i want to change this question',
            'i want to change this response',
            'i want to change this answer',
            'edit this question',
            'edit this response',
            'edit this answer',
            'i want to edit this question',
            'i want to edit this response',
            'i want to edit this answer'
          ],
          response: 'Modifying this question'
        },
        pause: {
          phrases: [
            'pause flow',
            'pause experiment',
            'pause the experiment',
            'pause test',
            'pause the test',
            'pause flow',
            'pause the flow',
            'stop listening',
            'stop the listening',
            'take a break',
            'take a short break',
            'take a quick break',
            'pause for a moment',
            'pause for a minute',
            'pause for a second',
            'pause for a while',
            'pause for now',
            'pause for the moment'
          ],
          response: 'Experiment paused. Say continue to resume.'
        },
        continue: {
          phrases: [
            'continue experiment',
            'continue the experiment',
            'resume experiment',
            'resume the experiment',
            'resume test',
            'resume the test',
            'resume flow',
            'resume the flow',
            'start the listening',
            'continue please',
            'resume please',
            'continue now',
            'resume now',
            'continue the test',
            'resume the test',
            'continue the flow',
            'resume the flow'
          ],
          response: 'Resuming experiment.'
        },
        finish: {
          phrases: [
            'stop experiment',
            'finish experiment',
            'i would like to stop here',
            'stop here',
            'finish here',
            'end experiment',
            'end here',
            'lets stop here',
            'let us stop here',
            'i want to stop here',
            'i want to finish here',
            'i want to end here',
            'stop the experiment',
            'finish the experiment',
            'end the experiment'
          ],
          response: 'Finishing experiment and generating final text.',
          staticAnswer: 'user has skipped this question'
        }
      },

      // TextEditor interface commands
      textEditor: {
        toQuestions: {
          phrases: [
            'go back to questions',
            'return to questions',
            'go back to the questions',
            'return to the questions',
            'go back to questions view',
            'return to questions view',
            'go back to the questions view',
            'return to the questions view',
            'go back to questions please',
            'return to questions please',
            'go back to the questions please',
            'return to the questions please',
            'go back to questions view please',
            'return to questions view please',
            'go back to the questions view please',
            'return to the questions view please'
          ],
          response: 'Returning to questions'
        },
        play: {
          phrases: [
            'play that again',
            'play it again',
            'play the audio again',
            'play the recording again',
            'play the speech again',
            'play the text again',
            'play that again please',
            'play it again please',
            'play the audio again please',
            'play the recording again please',
            'play the speech again please',
            'play the text again please',
            'read that again',
            'read it again',
            'read the text again',
            'read that again please',
            'read it again please',
            'read the text again please',
            'speak that again',
            'speak it again',
            'speak the text again',
            'speak that again please',
            'speak it again please',
            'speak the text again please'
          ],
          response: 'Playing audio'
        },
        stop: {
          phrases: [
            'stop speaking',
            'stop talking',
            'stop the speaking',
            'stop reading',
            'stop the reading',
            'stop talking',
            'stop the talking',
            'stop audio',
            'stop the audio',
            'stop playback',
            'stop the playback',
            'stop speaking please',
            'stop the speaking please',
            'stop reading please',
            'stop the reading please',
            'stop talking please',
            'stop the talking please',
            'stop audio please',
            'stop the audio please',
            'stop playback please',
            'stop the playback please',
            'be quiet',
            'be quiet please',
            'silence',
            'silence please'
          ],
          response: 'Stopping audio'
        },
        endExperiment: {
          phrases: [
            'end experiment',
            'finish experiment',
            'end the experiment',
            'finish the experiment',
            'save experiment',
            'save and finish',
            'save and exit',
            'save experiment data',
            'finish and save'
          ],
          response: 'Ending experiment and saving data'
        }
      }
    },

    // UI messages for hands-free mode
    ui: {
      messages: {
        waiting: 'Waiting for speech...',
        recording: 'Recording...',
        processing: 'Processing...',
        paused: 'Experiment paused. Say "continue experiment" to resume...'
      }
    }
  },

  // 2. TEXT_AND_VOICE MODE SETTINGS
  // Used in: VoiceInput.js for hybrid text/voice input
  voiceInput: {
    // Audio recording settings
    recording: {
      volumeThreshold: 0.02,          // Range: 0.01-1.0, Lower = more sensitive
      fftSize: 1024,                  // Size of FFT window (values: 256, 512, 1024, 2048, 4096)
      audioBitsPerSecond: 128000,     // Audio quality in bits/sec (range: 64000-256000)
      chunkSize: 3000,                // Milliseconds per audio chunk (range: 1000-10000)
      logInterval: 300,               // How often to log audio levels in ms (range: 100-1000)
    },

    // Noise reduction settings for better voice recognition
    noiseReduction: {
      floorMultiplier: 1.2,           // Range: 1.0-3.0, Lower = keep more quiet sounds
      maxNoisePercent: 80,            // Range: 50-95, Higher = more tolerant of noise
      minSignificantPercent: 15,      // Range: 1-50, Lower = accept shorter speech
      sampleSize: 2000                // Range: 500-5000, Higher = more accurate noise detection
    }
  }
};

export default config;