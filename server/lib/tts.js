// Feedback clips are cached under a client-chosen name. Restrict it to a plain
// file name so a request cannot write outside the TTS directory.
const CACHE_NAME_PATTERN = /^[a-z0-9_-]{1,64}\.mp3$/i;

export function isSafeCacheName(name) {
  return typeof name === 'string' && CACHE_NAME_PATTERN.test(name);
}
