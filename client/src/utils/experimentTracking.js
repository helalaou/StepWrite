/**
 * Experiment measurements: who the participant is, how often they skipped or
 * modified an answer, and how long they spent writing (answering questions)
 * versus revising (working in the editor).
 *
 * Everything lives in sessionStorage so it survives the question and editor
 * views mounting and unmounting. Each phase has a running clock
 * (`<phase>StartTime`, in ms) and an accumulated total (`<phase>TimeTotal`,
 * in whole seconds).
 */
import config from '../config';

const readInt = (key) => parseInt(sessionStorage.getItem(key) || '0', 10);

// Seconds the phase's clock has been running; 0 when it is stopped.
const runningSeconds = (phase) => {
  const startTime = readInt(`${phase}StartTime`);
  return startTime > 0 ? Math.floor((Date.now() - startTime) / 1000) : 0;
};

const startClock = (phase) => {
  if (!sessionStorage.getItem(`${phase}StartTime`)) {
    sessionStorage.setItem(`${phase}StartTime`, Date.now().toString());
  }
};

const stopClock = (phase) => {
  if (!sessionStorage.getItem(`${phase}StartTime`)) return;
  const total = readInt(`${phase}TimeTotal`) + runningSeconds(phase);
  sessionStorage.setItem(`${phase}TimeTotal`, total.toString());
  sessionStorage.removeItem(`${phase}StartTime`);
};

/**
 * Reset all measurements for a new participant and start the writing clock.
 * Clears any clock left running by a previous participant in the same tab.
 */
export const startExperiment = (participantId, mode) => {
  sessionStorage.setItem('participantId', participantId);
  sessionStorage.setItem('experimentMode', mode);
  sessionStorage.setItem('modifyCount', '0');
  sessionStorage.setItem('skipCount', '0');
  sessionStorage.setItem('writingTimeTotal', '0');
  sessionStorage.setItem('revisionTimeTotal', '0');
  sessionStorage.removeItem('revisionStartTime');
  sessionStorage.setItem('writingStartTime', Date.now().toString());
};

// Both transitions are idempotent, so every path into the editor or back to
// the questions may call them without counting any time twice.

/** The participant moved from the questions to the editor. */
export const enterRevision = () => {
  if (!config.experiment.enabled) return;
  stopClock('writing');
  startClock('revision');
};

/** The participant moved from the editor back to the questions. */
export const enterWriting = () => {
  if (!config.experiment.enabled) return;
  stopClock('revision');
  startClock('writing');
};

/** @param {'modifyCount'|'skipCount'} counter */
export const incrementCount = (counter) => {
  if (!config.experiment.enabled) return;
  sessionStorage.setItem(counter, (readInt(counter) + 1).toString());
};

/** Current measurements, including time on any clock that is still running. */
export const readExperimentData = () => ({
  participantId: sessionStorage.getItem('participantId'),
  mode: sessionStorage.getItem('experimentMode') || 'write',
  modifyCount: readInt('modifyCount'),
  skipCount: readInt('skipCount'),
  writingTime: readInt('writingTimeTotal') + runningSeconds('writing'),
  revisionTime: readInt('revisionTimeTotal') + runningSeconds('revision'),
});
