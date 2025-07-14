import memoryManager from '../memory/memoryManager.js';

export const dependencyAnalysisPrompt = (originalAnswer, newAnswer, changedQuestionId, allQuestions) => {
  const hasMemory = memoryManager.isEnabled() && memoryManager.getMemoriesPrompt().length > 0;
  
  const questionsFormat = allQuestions
    .map(q => `Q${q.id}: ${q.question}\nA${q.id}: ${q.response || '[No response yet]'}`)
    .join('\n\n');

  return `
${memoryManager.getMemoriesPrompt()}

=== TASK ===
You are a dependency analysis system for a conversational writing assistant. A user has changed their answer to an earlier question, and you need to determine which subsequent questions are affected by this change and should be invalidated.

=== CONTEXT ===
The user changed their answer to Question ${changedQuestionId}:
- Original answer: "${originalAnswer}"
- New answer: "${newAnswer}"

=== ALL QUESTIONS AND CURRENT ANSWERS ===
${questionsFormat}

=== ANALYSIS CRITERIA ===
A question should be marked as AFFECTED if:
1. **Semantic Dependency**: The question's meaning, relevance, or appropriateness changes based on the new answer
2. **Logical Flow**: The question no longer makes logical sense in the conversation flow
3. **Context Dependency**: The question assumes information that is no longer valid
4. **Specificity Mismatch**: The question is too specific for a now-broader answer, or too broad for a now-specific answer

A question should be marked as UNAFFECTED if:
1. **Topic Independence**: The question addresses a completely different aspect that remains relevant
2. **Generic Applicability**: The question is general enough to apply regardless of the change
3. **Orthogonal Concerns**: The question deals with separate concerns (e.g., tone, audience, timing) that aren't impacted

=== EXAMPLES ===
Example 1:
- Q1: "What do you want to write?" Changed from "an email" → "a short story"
- Q2: "Who is the email recipient?" → AFFECTED (email-specific, irrelevant for story)
- Q3: "What's the main message?" → UNAFFECTED (applies to both emails and stories)

Example 2:
- Q1: "What do you want to write?" Unchanged: "an email"
- Q2: "Who is the email recipient?" Changed from "my boss" → "my friend"
- Q3: "What's the email about?" → UNAFFECTED (still about an email)
- Q4: "Should the tone be formal or casual?" → AFFECTED (boss vs friend changes appropriate tone)

Example 3:
- Q1: "What do you want to write?" Unchanged: "a proposal"
- Q2: "What's the proposal about?" Changed from "budget increase" → "new software"
- Q3: "Who will review this proposal?" → UNAFFECTED (someone will review either type)
- Q4: "What's your budget justification?" → AFFECTED (specific to budget proposals)

=== INSTRUCTIONS ===
1. Analyze each question that comes AFTER the changed question (Q${changedQuestionId})
2. For each subsequent question, determine if it's AFFECTED or UNAFFECTED
3. Provide clear reasoning for your decision
4. Focus on logical dependencies, not just keyword matching
5. Consider the conversation flow and context

=== OUTPUT FORMAT ===
Return a JSON object with this exact structure:
{
  "affectedQuestions": [
    {
      "questionId": number,
      "question": "exact question text",
      "status": "AFFECTED" | "UNAFFECTED",
      "reasoning": "clear explanation of why this question is/isn't affected"
    }
  ],
  "summary": "brief summary of the overall impact"
}

=== CRITICAL REQUIREMENTS ===
- Only analyze questions that come AFTER question ${changedQuestionId}
- Be precise in your analysis - don't over-invalidate questions
- Consider the user's intent and the logical flow of the conversation
- Return valid JSON only, no additional text
- Include ALL subsequent questions in your analysis
`;
}; 