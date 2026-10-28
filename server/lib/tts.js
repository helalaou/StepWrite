// Feedback clips are cached under a client-chosen name. Restrict it to a plain
// file name so a request cannot write outside the TTS directory.
const CACHE_NAME_PATTERN = /^[a-z0-9_-]{1,64}\.mp3$/i;

export function isSafeCacheName(name) {
  return typeof name === 'string' && CACHE_NAME_PATTERN.test(name);
}

// OpenAI's speech endpoint accepts at most this many characters per request.
export const MAX_TTS_INPUT_LENGTH = 4096;

// Split text into chunks the speech endpoint accepts, preferring sentence
// boundaries, then word boundaries, and only cutting words as a last resort.
export function splitForSpeech(text, maxLength = MAX_TTS_INPUT_LENGTH) {
  const chunks = [];
  let rest = text.trim();

  while (rest.length > maxLength) {
    const window = rest.slice(0, maxLength + 1);
    const sentenceEnd = Math.max(...['. ', '! ', '? ', '\n'].map(mark => window.lastIndexOf(mark)));
    const wordEnd = window.lastIndexOf(' ');
    const cut = sentenceEnd > 0 ? sentenceEnd + 1 : wordEnd > 0 ? wordEnd : maxLength;

    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) chunks.push(rest);
  return chunks;
}
