/**
 * Helpers for reading the conversation planning the server returns:
 * { questions: [{ id, question, response }], followup_needed, backgroundDraft }.
 */
import config from '../config';

// Response recorded for a skipped question. The server checks for the same
// string, so the two must stay in sync.
export const SKIPPED_ANSWER = 'user has skipped this question';

const hasResponse = (question) => Boolean(question.response && question.response.trim());

/**
 * Status of every question that has a response, keyed by question index.
 * @returns {Object<number, {type: 'answered'|'skipped', answer: string}>}
 */
export const buildQuestionStatus = (questions) => {
  const status = {};
  questions.forEach((question, index) => {
    if (hasResponse(question)) {
      status[index] = {
        type: question.response === SKIPPED_ANSWER ? 'skipped' : 'answered',
        answer: question.response
      };
    }
  });
  return status;
};

/**
 * Whether the planning carries a background draft built from enough real
 * (not skipped) answers to be shown.
 */
export const hasDraftReady = (conversationPlanning) => {
  if (!conversationPlanning?.backgroundDraft?.content) return false;
  const answered = (conversationPlanning.questions || [])
    .filter(question => hasResponse(question) && question.response !== SKIPPED_ANSWER);
  return answered.length >= config.continuousDrafts.minimumQuestionsForDraft;
};
