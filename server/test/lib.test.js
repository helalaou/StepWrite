import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeCacheName, splitForSpeech } from '../lib/tts.js';
import { isAllowedOrigin } from '../lib/origins.js';
import { buildCompletionParams } from '../lib/completionParams.js';
import { validateTurnRequest } from '../lib/validation.js';
import { spokenText } from '../lib/transcription.js';

test('isSafeCacheName accepts plain mp3 names only', () => {
  assert.equal(isSafeCacheName('feedback_draft_ready.mp3'), true);
  assert.equal(isSafeCacheName('../server.js'), false);
  assert.equal(isSafeCacheName('../../x.mp3'), false);
  assert.equal(isSafeCacheName('a/b.mp3'), false);
  assert.equal(isSafeCacheName(42), false);
});

test('splitForSpeech keeps chunks within the limit and loses no words', () => {
  const text = 'One short sentence. '.repeat(500);
  const chunks = splitForSpeech(text, 100);
  assert.ok(chunks.every(chunk => chunk.length <= 100));
  assert.equal(chunks.join(' ').split(/\s+/).length, text.trim().split(/\s+/).length);
  assert.ok(chunks.every(chunk => chunk.endsWith('.')), 'splits at sentence ends');
});

test('splitForSpeech falls back to word and hard cuts', () => {
  assert.deepEqual(splitForSpeech('aaaa bbbb cccc', 8), ['aaaa', 'bbbb', 'cccc']);
  assert.deepEqual(splitForSpeech('abcdefghij', 4), ['abcd', 'efgh', 'ij']);
  assert.deepEqual(splitForSpeech('  short  '), ['short']);
});

test('isAllowedOrigin allows the local client and ngrok tunnels only', () => {
  assert.equal(isAllowedOrigin('http://localhost:3000', 3000), true);
  assert.equal(isAllowedOrigin('https://stepwrite.ngrok.io', 3000), true);
  assert.equal(isAllowedOrigin('https://abc.ngrok-free.app', 3000), true);
  assert.equal(isAllowedOrigin('http://localhost:4000', 3000), false);
  assert.equal(isAllowedOrigin('https://ngrok.evil.com', 3000), false);
  assert.equal(isAllowedOrigin('https://evilngrok.io', 3000), false);
  assert.equal(isAllowedOrigin('not a url', 3000), false);
});

test('buildCompletionParams adapts to reasoning models', () => {
  const messages = [{ role: 'system', content: 'x' }];
  assert.deepEqual(
    buildCompletionParams({ model: 'o3-2025-04-16', temperature: 0.3, maxTokens: 800 }, messages),
    { model: 'o3-2025-04-16', messages, max_completion_tokens: 800 }
  );
  assert.deepEqual(
    buildCompletionParams({ model: 'gpt-4.1-mini', temperature: 0, maxTokens: 10 }, messages),
    { model: 'gpt-4.1-mini', messages, temperature: 0, max_tokens: 10 }
  );
});

test('validateTurnRequest rejects malformed turns', () => {
  const questions = [{ id: 1, question: 'What?', response: 'x' }];
  assert.equal(validateTurnRequest({ conversationPlanning: { questions } }), null);
  assert.equal(validateTurnRequest({ conversationPlanning: { questions }, changedIndex: 0, answer: 'y' }), null);
  assert.match(validateTurnRequest({}), /non-empty array/);
  assert.match(validateTurnRequest({ conversationPlanning: { questions }, changedIndex: 1 }), /changedIndex/);
  assert.match(validateTurnRequest({ conversationPlanning: { questions: [{ question: 'q' }] } }), /integer id/);
  assert.match(validateTurnRequest({ conversationPlanning: { questions }, changedIndex: 0, previousAnswer: 3 }), /previousAnswer/);
});

test('spokenText drops the text Whisper writes for noise', () => {
  // Scores Whisper gave test clips: room hiss, a rustle, and spoken answers
  const segment = (text, no_speech_prob) => ({ text, no_speech_prob });
  assert.equal(spokenText({ text: 'Thank you for watching.', segments: [segment(' Thank you for watching.', 0.89)] }, 0.5), '');
  assert.equal(spokenText({ text: 'You', segments: [segment(' You', 0.613)] }, 0.5), '');
  assert.equal(spokenText({ text: 'Skip.', segments: [segment(' Skip.', 0.183)] }, 0.5), 'Skip.');
  assert.equal(
    spokenText({ text: 'Yes. you', segments: [segment(' Yes.', 0.131), segment(' you', 0.9)] }, 0.5),
    'Yes.'
  );
  assert.equal(spokenText({ text: 'Next.', segments: [segment(' Next.', undefined)] }, 0.5), 'Next.');
  assert.equal(spokenText({ text: ' Next.\n' }, 0.5), 'Next.');
  assert.equal(spokenText({ text: '', segments: [] }, 0.5), '');
});
