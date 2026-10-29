import config from '../config';
import { matchesAnyPhrase } from './voiceCommands';

const matching = config.handsFree.commands.behavior.matching;
const originalMatching = { ...matching };

afterEach(() => {
  Object.assign(matching, originalMatching);
});

describe('matchesAnyPhrase', () => {
  test('ignores case, punctuation and curly apostrophes on both sides', () => {
    matching.mode = 'EXACT_MATCH';
    expect(matchesAnyPhrase('Next question?', ['next question'])).toBe(true);
    expect(matchesAnyPhrase('Let’s go back!', ["let's go back"])).toBe(true);
  });

  test('drops articles only when ignoreArticles is set', () => {
    matching.mode = 'EXACT_MATCH';
    matching.ignoreArticles = true;
    expect(matchesAnyPhrase('skip the question', ['skip question'])).toBe(true);
    matching.ignoreArticles = false;
    expect(matchesAnyPhrase('skip the question', ['skip question'])).toBe(false);
  });

  test('EXACT_MATCH requires the whole utterance to be the phrase', () => {
    matching.mode = 'EXACT_MATCH';
    expect(matchesAnyPhrase('please skip question', ['skip question'])).toBe(false);
  });

  test('CONTAINS accepts the phrase inside a longer utterance', () => {
    matching.mode = 'CONTAINS';
    expect(matchesAnyPhrase('ok please skip question now', ['skip question'])).toBe(true);
    expect(matchesAnyPhrase('question skip', ['skip question'])).toBe(false);
  });

  test('FUZZY compares the share of phrase words against minConfidence', () => {
    matching.mode = 'FUZZY';
    matching.minConfidence = 0.85;
    expect(matchesAnyPhrase('question skip please', ['skip question'])).toBe(true);
    expect(matchesAnyPhrase('skip it', ['skip question'])).toBe(false);
    matching.minConfidence = 0.5;
    expect(matchesAnyPhrase('skip it', ['skip question'])).toBe(true);
  });

  test('never matches empty speech or phrases that are only articles', () => {
    matching.mode = 'CONTAINS';
    expect(matchesAnyPhrase('  ...  ', ['skip question'])).toBe(false);
    expect(matchesAnyPhrase('the end', ['the'])).toBe(false);
  });
});
