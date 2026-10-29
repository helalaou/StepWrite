import test from 'node:test';
import assert from 'node:assert/strict';

// The OpenAI client is constructed on import; these tests never call it.
process.env.OPENAI_API_KEY ||= 'test-key';
process.env.LOG_LEVEL ||= 'error';
const { default: config } = await import('../config.js');
const { runConversationTurn } = await import('../conversation.js');

const q = (id, response = '') => ({ id, question: `Question ${id}?`, response });

// A flow whose model calls are local stubs that record what was asked of them.
function fakeFlow({ followupAfterQuestion = true } = {}) {
  const calls = { nextQuestion: 0, finalOutput: 0, draft: 0 };
  return {
    calls,
    name: 'write',
    outputKey: 'output',
    nextQuestion: async (planning) => {
      calls.nextQuestion++;
      const id = Math.max(...planning.questions.map(x => x.id)) + 1;
      return {
        question: `Question ${id}?`,
        conversationPlanning: { ...planning, questions: [...planning.questions, q(id)], followup_needed: followupAfterQuestion }
      };
    },
    finalOutput: async () => { calls.finalOutput++; return 'final text'; },
    draft: async () => { calls.draft++; return 'draft text'; }
  };
}

test('a normal answer asks the next question', async () => {
  const flow = fakeFlow();
  const result = await runConversationTurn(flow, {
    conversationPlanning: { questions: [q(1, 'an email')], followup_needed: true }
  });
  assert.equal(result.followup_needed, true);
  assert.deepEqual(result.conversationPlanning.questions.map(x => x.id), [1, 2]);
  assert.equal(flow.calls.draft, 0, 'no draft before the minimum number of answers');
});

test('a draft is built once there are enough answers', async () => {
  const flow = fakeFlow();
  const answered = Array.from({ length: config.openai.continuousDrafts.minimumQuestionsForDraft }, (_, i) => q(i + 1, 'yes'));
  const result = await runConversationTurn(flow, {
    conversationPlanning: { questions: answered, followup_needed: true }
  });
  assert.equal(flow.calls.draft, 1);
  assert.equal(result.conversationPlanning.backgroundDraft.content, 'draft text');
});

test('the finish command produces the final text without asking more', async () => {
  const flow = fakeFlow();
  const result = await runConversationTurn(flow, {
    conversationPlanning: { questions: [q(1, 'x')], followup_needed: true },
    isFinishCommand: true
  });
  assert.deepEqual(result, { output: 'final text', followup_needed: false });
  assert.equal(flow.calls.nextQuestion, 0);
});

test('the model ending the conversation produces the final text', async () => {
  const flow = fakeFlow({ followupAfterQuestion: false });
  const result = await runConversationTurn(flow, {
    conversationPlanning: { questions: [q(1, 'x')], followup_needed: true }
  });
  assert.equal(result.output, 'final text');
  assert.equal(flow.calls.finalOutput, 1);
});

test('editing an earlier answer re-asks a pending question instead of adding one', async () => {
  const flow = fakeFlow();
  // Unchanged answer, so dependency analysis (a model call) is skipped.
  const result = await runConversationTurn(flow, {
    conversationPlanning: { questions: [q(1, 'a'), q(2, 'b'), q(3)], followup_needed: true },
    changedIndex: 0,
    answer: 'a',
    previousAnswer: 'a'
  });
  assert.equal(result.question, 'Question 3?');
  assert.deepEqual(result.conversationPlanning.questions.map(x => x.id), [1, 2, 3]);
  assert.equal(flow.calls.nextQuestion, 0);
});
