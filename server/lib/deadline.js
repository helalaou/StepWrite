import { AsyncLocalStorage } from 'node:async_hooks';

// A deadline for everything one request does, so the hosted site answers
// before its host stops the function. Code run on behalf of the request asks
// how much time is left; outside a deadline there is no limit.
const deadlines = new AsyncLocalStorage();

// Time kept back from each OpenAI call to send the response
const RESPONSE_MARGIN_MS = 1500;

export const withDeadline = (budgetMs, fn) => deadlines.run(Date.now() + budgetMs, fn);

export function timeLeft() {
  const end = deadlines.getStore();
  return end === undefined ? Infinity : end - Date.now();
}

// Request options for an OpenAI call: within a deadline, the call may use the
// time left and is not retried, since a retry would run past the deadline.
export function openaiCallOptions() {
  const left = timeLeft() - RESPONSE_MARGIN_MS;
  if (left === Infinity) return undefined;
  if (left <= 0) throw new Error('No time left in this request for another OpenAI call');
  return { timeout: left, maxRetries: 0 };
}
