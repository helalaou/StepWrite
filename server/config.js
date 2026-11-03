import logger from './utils/logger.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve everything against the server directory so the server behaves the
// same whether it is started from server/ or from the repository root.
const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(SERVER_DIR, '.env') });

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
    outputDir: path.join(SERVER_DIR, 'temp', 'experiment_data'),
  },
  openai: {
    timeout: 70000, // 70 seconds
    
    // Write flow settings
    write: {
      question: {
        model: 'gpt-4o-2024-11-20',
        temperature: 0.7,
        maxTokens: 100,
      },
      output: {
        model: 'gpt-4o-2024-11-20',
        temperature: 0.7,
        maxTokens: 10000,
      }
    },

    // Edit flow settings
    edit: {
      question: {
        model: 'gpt-4.1-mini-2025-04-14',
        temperature: 0.7,
        maxTokens: 100,
      },
      output: {
        model: 'gpt-4.1-mini-2025-04-14',
        temperature: 0.7,
        maxTokens: 10000,
      }
    },

    // Reply flow settings
    reply: {
      question: {
        model: 'gpt-4.1-mini-2025-04-14',
        temperature: 0.7,
        maxTokens: 100,
      },
      output: {
        model: 'gpt-4.1-mini-2025-04-14',
        temperature: 0.7,
        maxTokens: 10000,
      }
    },

    // Classification settings
    textTypeClassification: {
      model: 'gpt-4o-2024-11-20',
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
        model: 'o3-2025-04-16',
      },
      correction: {
        model: 'o3-2025-04-16',
      }
    },

    // memory settings
    memory: {
      enabled: false,
      filePath: path.join(SERVER_DIR, 'data', 'user_memories.json')
    },

    toneClassification: {
      model: 'gpt-4.1-2025-04-14',
      temperature: 0.5,
      maxTokens: 200,
      enabled: true,
      categories: {
        FORMAL: "Conforms to professional or institutional convention by opening and closing with courteous formulas, maintaining respectful distance throughout, and avoiding slang or overt emotion—even when the sentence structure or vocabulary is otherwise simple or includes contractions.",
      
        INFORMAL: "Conversational and casual in both greeting and closing, omitting conventional formalities, favouring first-/second-person address and relaxed phrasing; it stays free of authoritative directives, which would shift the tone toward Assertive.",
      
        FRIENDLY: "A friendly tone builds rapport through warm greetings, upbeat adjectives, polite assurances, and light humour; it stays steady and kind without diving into deep emotional validation (Empathetic) or making strong predictions about the future (Optimistic).",
      
        DIPLOMATIC: "A diplomatic tone carefully navigates sensitive topics by using neutral vocabulary, gentle hedging (‘could’, ‘might’), and balanced phrasing that acknowledges multiple perspectives, explicitly avoiding blunt commands, deadlines, or one-sided judgments.",
      
        URGENT: "An urgent tone highlights immediate importance by pairing direct wording with explicit time cues such as ‘ASAP’, ‘by 2 PM today’, or references to events starting soon; its purpose is to trigger swift action, distinguishing it from mere assertiveness by its emphasis on speed.",
      
        CONCERNED: "A concerned tone expresses unease about potential problems; it employs conditional verbs (‘could’, ‘might’), tentative language, and references to possible negative outcomes to encourage caution, without the overt anxiety of Worried or the directive thrust of Urgent.",
      
        OPTIMISTIC: "An optimistic tone projects confidence in favourable future results; it relies on hopeful verbs (‘will’, ‘can’), visionary phrases (‘exciting opportunities ahead’), and uplifting language centred on forthcoming success rather than present rapport (Friendly) or sudden astonishment (Surprised).",
      
        CURIOUS: "A curious tone signals genuine information-seeking; it is dominated by open-ended or clarifying questions and expressions of uncertainty, steering clear of imperatives, deadlines, or collaborative calls to action.",
      
        ENCOURAGING: "An encouraging tone motivates and reassures; it supplies affirmations of ability (‘you’ve got this’), references to progress, and supportive language that boosts confidence without deep emotional empathy (Empathic) or explicit time pressure (Urgent).",
      
        SURPRISED: "A surprised tone communicates sudden astonishment at unexpected news; it features strong intensifiers, exclamatory punctuation, and short emotive bursts that foreground the shock itself rather than ongoing warmth, future optimism, or requests for action.",
      
        COOPERATIVE: "A cooperative tone invites joint effort toward a shared goal; it consistently uses inclusive pronouns (‘we’, ‘our’), collaborative verbs (‘coordinate’, ‘work together’), and language that emphasises mutual benefit while avoiding solitary demands or purely polite formality.",
      
        EMPATHETIC: "An empathetic tone shows understanding and compassion by explicitly naming or validating the other person’s feelings, offering support or flexibility, and using gentle, comforting phrasing distinct from simple friendliness or motivation.",
      
        APOLOGETIC: "An apologetic tone takes responsibility for an error by stating an explicit apology (‘I’m sorry’), acknowledging fault, and describing corrective steps, thereby differentiating itself from neutral acknowledgements or defensive explanations.",
      
        ASSERTIVE: "An assertive tone delivers clear, confident instructions or expectations through imperative verbs or polite-imperative phrasing (‘please update’, ‘provide’), with minimal hedging and no necessary emphasis on tight timelines—distinguishing it from Urgent."
      }
      

    },

    // Initial reply question settings
    initialReplyQuestion: {
      model: 'gpt-4o-2024-11-20',
      temperature: 0.7,
      maxTokens: 100,
    },

    // Dependency analysis settings
    // o-series models ignore temperature, and their token cap also covers
    // hidden reasoning tokens, so it needs headroom beyond the JSON answer.
    dependencyAnalysis: {
      model: 'o3-2025-04-16',
      temperature: 0.3,  // low for consistency (chat models only)
      maxTokens: 8000,
    },

    //Continuous draft generation settings, if you change this, you need to change the same settings in the client config
    continuousDrafts: {
      enabled: true,
      generateAfterEachAnswer: true,
      generateAfterModifications: true,
      factCheckContinuousDrafts: false, // we disable fact-checking for background drafts for speed!
      minimumQuestionsForDraft: 3, // the minimum number of answered questions required before generating a background drafts
    },
  },

  // Audio storage settings
  audio: {
    tts: {
      model: 'tts-1',
      voice: 'nova', // you can find all the supported voices here: https://platform.openai.com/docs/guides/text-to-speech/voices
      format: 'mp3',
      tempDir: path.join(SERVER_DIR, 'temp', 'tts'),
      cacheEnabled: true,
      cleanupInterval: 3600000, // 1 hour in milliseconds
    },
    stt: {
      maxUploadBytes: 25 * 1024 * 1024, // Whisper's upload limit
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
  fs.mkdirSync(config.audio.tts.tempDir, { recursive: true });

  // Create experiment data directory if enabled
  if (config.experiment.enabled) {
    fs.mkdirSync(config.experiment.outputDir, { recursive: true });
  }
} catch (err) {
  if (err.code !== 'EEXIST') {
    logger.error('Failed to create directories:', err);
  }
}

export { logger };
export default config;
