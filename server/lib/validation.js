// Returns an error message for a malformed conversation turn, or null if it is usable.
export function validateTurnRequest({ conversationPlanning, changedIndex, answer, previousAnswer }) {
  const questions = conversationPlanning?.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return 'conversationPlanning.questions must be a non-empty array';
  }

  const isValidQuestion = q => q
    && Number.isInteger(q.id)
    && typeof q.question === 'string'
    && (q.response === undefined || typeof q.response === 'string');
  if (!questions.every(isValidQuestion)) {
    return 'each question needs an integer id, a question string and an optional response string';
  }

  if (changedIndex !== undefined && changedIndex !== null) {
    if (!Number.isInteger(changedIndex) || changedIndex < 0 || changedIndex >= questions.length) {
      return 'changedIndex must be the index of an existing question';
    }
    if (answer !== undefined && typeof answer !== 'string') {
      return 'answer must be a string';
    }
    if (previousAnswer !== undefined && typeof previousAnswer !== 'string') {
      return 'previousAnswer must be a string';
    }
  }

  return null;
}
