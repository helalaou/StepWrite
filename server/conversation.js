import config, { logger } from './config.js';
import {
  generateWriteQuestion,
  generateEditQuestion,
  generateEditOutput,
  generateReplyQuestion,
  generateOutputWithFactCheck,
  generateBackgroundDraft,
  classifyTone,
  analyzeDependencies
} from './openaiModule.js';

// Response the client stores for a question the user skipped.
const SKIPPED_ANSWER = 'user has skipped this question';

const drafts = config.openai.continuousDrafts;

export function toQaFormat(questions) {
  return questions
    .map(q => `Q: ${q.question}\nA: ${q.response}`)
    .join('\n\n');
}

function setFollowup(conversationPlanning, followupNeeded) {
  return { ...conversationPlanning, followup_needed: followupNeeded };
}

export function forceFollowup(conversationPlanning, followupNeeded) {
  logger.info(`Manually forcing conversation ${followupNeeded ? 'continuation' : 'completion'}`);
  return setFollowup(conversationPlanning, followupNeeded);
}

async function classifyToneIfEnabled(conversationPlanning, context) {
  if (!config.openai.toneClassification.enabled) return null;
  return classifyTone(toQaFormat(conversationPlanning.questions), context || '');
}

// Store a changed answer and drop the later questions that depended on the old one.
// `previousAnswer` is the answer the server last saw; the submitted planning
// already contains the new answer, so it cannot be recovered from there.
async function applyAnswerChange(conversationPlanning, changedIndex, newAnswer, previousAnswer) {
  const questions = [...conversationPlanning.questions];
  const changedQuestion = questions[changedIndex];
  const originalAnswer = typeof previousAnswer === 'string'
    ? previousAnswer
    : (changedQuestion.response || '');

  questions[changedIndex] = { ...changedQuestion, response: newAnswer };

  const laterQuestionCount = questions.length - changedIndex - 1;
  if (laterQuestionCount === 0 || originalAnswer === newAnswer) {
    logger.info(`Skipping dependency analysis for question ${changedQuestion.id}: ${laterQuestionCount === 0 ? 'no later questions' : 'answer unchanged'}`);
    return { ...conversationPlanning, questions };
  }

  logger.section('DEPENDENCY ANALYSIS START', {
    changedQuestionId: changedQuestion.id,
    originalAnswer,
    newAnswer,
    totalQuestions: questions.length
  });

  // Question ids are not positions once earlier questions have been removed,
  // so the prompt and the filter below both work with ids.
  const dependencyAnalysis = await analyzeDependencies(
    originalAnswer,
    newAnswer,
    changedQuestion.id,
    questions
  );

  logger.section('DEPENDENCY ANALYSIS RESULTS', dependencyAnalysis);

  const affectedQuestionIds = new Set(
    (dependencyAnalysis.affectedQuestions || [])
      .filter(q => q.status === 'AFFECTED')
      .map(q => q.questionId)
  );

  if (affectedQuestionIds.size === 0) {
    logger.section('NO QUESTIONS REMOVED', { message: 'All subsequent questions remain valid' });
    return { ...conversationPlanning, questions };
  }

  const remaining = questions.filter((q, index) =>
    index <= changedIndex || !affectedQuestionIds.has(q.id)
  );

  logger.section('QUESTIONS REMOVED', {
    removedQuestionIds: [...affectedQuestionIds],
    remainingQuestions: remaining.length
  });

  return { ...conversationPlanning, questions: remaining };
}

// Attach a draft of the text so far, once enough questions have real answers.
async function attachBackgroundDraft(conversationPlanning, context) {
  const answeredQuestions = conversationPlanning.questions.filter(q =>
    q.response && q.response.trim() && q.response !== SKIPPED_ANSWER
  );

  if (answeredQuestions.length < drafts.minimumQuestionsForDraft) {
    logger.info(`Only ${answeredQuestions.length} questions answered, need at least ${drafts.minimumQuestionsForDraft} for background draft generation`);
    return conversationPlanning;
  }

  try {
    const toneClassification = await classifyToneIfEnabled(conversationPlanning, context);
    const draft = await generateBackgroundDraft(conversationPlanning, toneClassification, context);

    logger.section('BACKGROUND DRAFT STORED', {
      questionsCount: conversationPlanning.questions.length,
      answeredCount: answeredQuestions.length,
      draftLength: draft.length
    });

    return {
      ...conversationPlanning,
      backgroundDraft: {
        content: draft,
        generatedAt: new Date().toISOString(),
        questionsCount: conversationPlanning.questions.length,
        answeredCount: answeredQuestions.length
      }
    };
  } catch (error) {
    // A missing draft only means the editor shows the last one, so keep going.
    logger.error('Error generating background draft:', error);
    return conversationPlanning;
  }
}

// Write and reply differ only in the question prompt; reply passes the
// message being replied to as `context`.
export function writeFlow(context) {
  return {
    name: context ? 'reply' : 'write',
    draftContext: context,
    outputKey: 'output',
    nextQuestion: planning => (context
      ? generateReplyQuestion(context, planning)
      : generateWriteQuestion(planning)),
    finalOutput: async planning => {
      const toneClassification = await classifyToneIfEnabled(planning, context);
      return generateOutputWithFactCheck(planning, toneClassification, context);
    }
  };
}

export function editFlow(originalText) {
  return {
    name: 'edit',
    draftContext: originalText,
    outputKey: 'editedText',
    nextQuestion: planning => generateEditQuestion(originalText, planning),
    finalOutput: planning => generateEditOutput(originalText, planning)
  };
}

async function finish(flow, conversationPlanning) {
  logger.section(`FINAL OUTPUT GENERATION (${flow.name.toUpperCase()})`, {
    factCheckingEnabled: config.openai.factChecking.enabled
  });

  const output = await flow.finalOutput(conversationPlanning);

  logger.section(`GENERATION COMPLETE (${flow.name.toUpperCase()})`, {
    output,
    characters: output.length,
    words: output.split(/\s+/).length
  });

  return { [flow.outputKey]: output, followup_needed: false };
}

// One conversation turn: apply an edited answer if there is one, then either
// ask the next question or produce the final text.
export async function runConversationTurn(flow, { conversationPlanning, changedIndex, answer, previousAnswer, isFinishCommand }) {
  let planning = { ...conversationPlanning };

  if (typeof changedIndex === 'number') {
    planning = await applyAnswerChange(planning, changedIndex, answer || '', previousAnswer);

    if (!isFinishCommand) {
      planning = setFollowup(planning, true);
    }
    if (drafts.enabled && drafts.generateAfterModifications) {
      planning = await attachBackgroundDraft(planning, flow.draftContext);
    }
  }

  if (isFinishCommand || !planning.followup_needed) {
    return finish(flow, planning);
  }

  // An earlier answer changed but the question the user had not answered yet
  // survived dependency analysis: ask it again rather than adding another.
  const lastQuestion = planning.questions[planning.questions.length - 1];
  if (typeof changedIndex === 'number' && !lastQuestion.response) {
    return {
      question: lastQuestion.question,
      conversationPlanning: planning,
      followup_needed: true
    };
  }

  const { question, conversationPlanning: nextPlanning } = await flow.nextQuestion(planning);

  if (!nextPlanning.followup_needed) {
    return finish(flow, nextPlanning);
  }

  const planningWithDraft = drafts.enabled && drafts.generateAfterEachAnswer
    ? await attachBackgroundDraft(nextPlanning, flow.draftContext)
    : nextPlanning;

  return {
    question,
    conversationPlanning: planningWithDraft,
    followup_needed: true
  };
}
