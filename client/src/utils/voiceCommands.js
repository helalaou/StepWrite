/**
 * Matching spoken transcriptions against the command phrases in
 * config.handsFree.commands, using config.handsFree.commands.behavior.matching.
 */
import config from '../config';

const ARTICLES = /\b(a|an|the)\b/g;

/**
 * Lower-case, strip punctuation (including the question marks and curly
 * apostrophes Whisper adds) and collapse whitespace, optionally dropping
 * articles. Transcriptions and phrases go through the same normalization.
 */
const normalize = (text, ignoreArticles) => {
  let normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '');
  if (ignoreArticles) {
    normalized = normalized.replace(ARTICLES, '');
  }
  return normalized.replace(/\s+/g, ' ').trim();
};

const matchesPhrase = (transcription, phrase, { mode, minConfidence }) => {
  switch (mode) {
    case 'CONTAINS':
      return transcription.includes(phrase);

    case 'FUZZY': {
      // Share of the phrase's words that occur anywhere in the transcription
      const spokenWords = new Set(transcription.split(' '));
      const phraseWords = phrase.split(' ');
      const matches = phraseWords.filter(word => spokenWords.has(word)).length;
      return matches / phraseWords.length >= minConfidence;
    }

    case 'EXACT_MATCH':
    default:
      return transcription === phrase;
  }
};

/**
 * Whether the transcription matches any of the phrases under the configured
 * matching mode: EXACT_MATCH, CONTAINS or FUZZY (unknown modes match exactly).
 * @param {string} transcription - Raw transcription text
 * @param {string[]} phrases - Command phrases from the config
 * @returns {boolean}
 */
export const matchesAnyPhrase = (transcription, phrases) => {
  const matching = config.handsFree.commands.behavior.matching;
  const spoken = normalize(transcription, matching.ignoreArticles);
  if (!spoken) return false;

  return phrases.some(phrase => {
    const normalizedPhrase = normalize(phrase, matching.ignoreArticles);
    return normalizedPhrase !== '' && matchesPhrase(spoken, normalizedPhrase, matching);
  });
};
