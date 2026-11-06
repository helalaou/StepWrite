import config from '../config';

// Settings chosen in the app's Settings pane. They are kept in the browser (or
// the phone app's web view) and override the build's defaults from config.js.
const STORAGE_KEY = 'stepwrite-settings';

export const THEMES = ['system', 'light', 'dark'];
export const INPUT_MODES = ['HANDS_FREE', 'TEXT_AND_VOICE', 'TEXT_ONLY'];
// The voices the server accepts (server/lib/tts.js)
export const VOICES = ['alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'];
export const READING_SPEEDS = [0.75, 1, 1.25, 1.5];
// Silence, in ms, before a hands-free answer is sent
export const ANSWER_PAUSES = [600, 1000, 1500, 2000, 3000];
// Silence, in ms, before a hands-free question is asked again; 0 is never
export const REPEAT_DELAYS = [8000, 12000, 20000, 30000, 0];

// Captured before any saved settings are applied, so these stay the build's own
const BUILD_REPLAY = { ...config.handsFree.speech.replay };

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'system',
  inputMode: INPUT_MODES.includes(config.input.mode) ? config.input.mode : 'HANDS_FREE',
  readAloud: config.tts.mode === 'ENABLED',
  voice: VOICES.includes(config.tts.voice) ? config.tts.voice : 'nova',
  readingSpeed: config.tts.readingSpeed,
  answerPause: config.handsFree.speech.finalizeDelay,
  repeatAfter: BUILD_REPLAY.minimumQuietPeriod,
  serverUrl: config.core.apiUrl,
});

// The server address without trailing slashes, or null when it isn't an
// http(s) URL
export function normalizeServerUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:' ? trimmed : null;
  } catch {
    return null;
  }
}

const oneOf = (choices, value, fallback) => (choices.includes(value) ? value : fallback);

// Saved settings with anything missing or no longer valid replaced by its default
export function normalizeSettings(saved) {
  const value = saved && typeof saved === 'object' ? saved : {};
  return {
    theme: oneOf(THEMES, value.theme, DEFAULT_SETTINGS.theme),
    inputMode: oneOf(INPUT_MODES, value.inputMode, DEFAULT_SETTINGS.inputMode),
    readAloud: typeof value.readAloud === 'boolean' ? value.readAloud : DEFAULT_SETTINGS.readAloud,
    voice: oneOf(VOICES, value.voice, DEFAULT_SETTINGS.voice),
    readingSpeed: oneOf(READING_SPEEDS, value.readingSpeed, DEFAULT_SETTINGS.readingSpeed),
    answerPause: oneOf(ANSWER_PAUSES, value.answerPause, DEFAULT_SETTINGS.answerPause),
    repeatAfter: oneOf(REPEAT_DELAYS, value.repeatAfter, DEFAULT_SETTINGS.repeatAfter),
    serverUrl: normalizeServerUrl(value.serverUrl) || DEFAULT_SETTINGS.serverUrl,
  };
}

export function loadSettings(storage = window.localStorage) {
  try {
    return normalizeSettings(JSON.parse(storage.getItem(STORAGE_KEY)));
  } catch {
    return normalizeSettings(null);
  }
}

// Only the settings that differ from the defaults are stored, so a later build
// with new defaults still applies them.
export function saveSettings(settings, storage = window.localStorage) {
  const changed = Object.fromEntries(
    Object.entries(settings).filter(([key, value]) => value !== DEFAULT_SETTINGS[key])
  );
  try {
    if (Object.keys(changed).length) {
      storage.setItem(STORAGE_KEY, JSON.stringify(changed));
    } else {
      storage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Private browsing can refuse storage; the settings still apply until reload.
  }
}

// The components read config when they render or act, so writing the settings
// into it is enough for them to take effect.
export function applySettings(settings, target = config) {
  target.input.mode = settings.inputMode;
  target.tts.mode = settings.readAloud ? 'ENABLED' : 'DISABLED';
  target.tts.voice = settings.voice;
  target.tts.readingSpeed = settings.readingSpeed;
  target.handsFree.speech.finalizeDelay = settings.answerPause;
  // "Never" keeps the question's first reading and no replays after it
  target.handsFree.speech.replay.minimumQuietPeriod = settings.repeatAfter || BUILD_REPLAY.minimumQuietPeriod;
  target.handsFree.speech.replay.maxAttempts = settings.repeatAfter ? BUILD_REPLAY.maxAttempts : 1;
  target.core.apiUrl = settings.serverUrl;
}

// Whether a StepWrite server answers at this address
export async function checkServer(serverUrl, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${serverUrl}${config.core.endpoints.health}`, { signal: controller.signal });
    const body = response.ok ? await response.json() : null;
    return body?.app === 'StepWrite';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
