import {
  applySettings,
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeServerUrl,
  normalizeSettings,
  saveSettings,
} from './settings';

const memoryStorage = () => {
  const items = {};
  return {
    getItem: key => (key in items ? items[key] : null),
    setItem: (key, value) => { items[key] = value; },
    removeItem: key => { delete items[key]; },
    items,
  };
};

const configShape = () => ({
  core: { apiUrl: '' },
  input: { mode: '' },
  tts: { mode: '', voice: '', readingSpeed: 0 },
  handsFree: { speech: { finalizeDelay: 0, replay: { minimumQuietPeriod: 0, maxAttempts: 0 } } },
});

test('normalizeServerUrl keeps http(s) addresses only', () => {
  expect(normalizeServerUrl(' https://stepwrite.example.org/ ')).toBe('https://stepwrite.example.org');
  expect(normalizeServerUrl('http://192.168.1.20:3001')).toBe('http://192.168.1.20:3001');
  expect(normalizeServerUrl('ftp://example.org')).toBeNull();
  expect(normalizeServerUrl('not a url')).toBeNull();
  expect(normalizeServerUrl(42)).toBeNull();
});

test('normalizeSettings replaces missing and invalid values with defaults', () => {
  expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  const settings = normalizeSettings({ theme: 'dark', voice: 'robot', readingSpeed: 9, readAloud: 'yes' });
  expect(settings.theme).toBe('dark');
  expect(settings.voice).toBe(DEFAULT_SETTINGS.voice);
  expect(settings.readingSpeed).toBe(DEFAULT_SETTINGS.readingSpeed);
  expect(settings.readAloud).toBe(DEFAULT_SETTINGS.readAloud);
});

test('saveSettings stores only changes and loadSettings reads them back', () => {
  const storage = memoryStorage();
  saveSettings({ ...DEFAULT_SETTINGS, theme: 'light', answerPause: 2000 }, storage);
  expect(JSON.parse(storage.items['stepwrite-settings'])).toEqual({ theme: 'light', answerPause: 2000 });
  expect(loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS, theme: 'light', answerPause: 2000 });

  saveSettings(DEFAULT_SETTINGS, storage);
  expect(storage.items).toEqual({});
  storage.setItem('stepwrite-settings', '{broken');
  expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
});

test('applySettings writes the settings into the config', () => {
  const target = configShape();
  applySettings({
    ...DEFAULT_SETTINGS,
    inputMode: 'TEXT_ONLY',
    readAloud: false,
    voice: 'onyx',
    readingSpeed: 1.25,
    answerPause: 1500,
    repeatAfter: 20000,
    serverUrl: 'https://stepwrite.example.org',
  }, target);
  expect(target.input.mode).toBe('TEXT_ONLY');
  expect(target.tts).toEqual({ mode: 'DISABLED', voice: 'onyx', readingSpeed: 1.25 });
  expect(target.handsFree.speech.finalizeDelay).toBe(1500);
  expect(target.handsFree.speech.replay.minimumQuietPeriod).toBe(20000);
  expect(target.handsFree.speech.replay.maxAttempts).toBe(Infinity);
  expect(target.core.apiUrl).toBe('https://stepwrite.example.org');

  applySettings({ ...DEFAULT_SETTINGS, repeatAfter: 0 }, target);
  expect(target.handsFree.speech.replay.maxAttempts).toBe(1);
  expect(target.handsFree.speech.replay.minimumQuietPeriod).toBe(DEFAULT_SETTINGS.repeatAfter);
});
