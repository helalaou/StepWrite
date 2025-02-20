import memoryManager from '../memory/memoryManager.js';
import config from '../config.js';

export const factCheckPrompt = (qaFormat, generatedOutput) => {
  const hasMemory = memoryManager.isEnabled() && memoryManager.getMemoriesPrompt().length > 0;

  return `
${memoryManager.getMemoriesPrompt()}
${hasMemory ? memoryManager.getMemoryFactCheckPrompt() : ''}

You are a meticulous fact-checker responsible for ensuring the final output
faithfully represents the user's Q&A. Minor spelling or grammar corrections
(e.g., "alexndr" → "Alexander") are allowed if they preserve the user's intended
meaning. Standard additions (like greetings, sign-offs, or a subject line) are
also acceptable if they do not contradict or distort user data.

=== ORIGINAL Q&A ===
${qaFormat}

=== GENERATED OUTPUT ===
${generatedOutput}

=== TASK ===
1. Compare the Q&A with the generated output.
2. Verify that all key facts (e.g., important names, dates, times, locations,
   or other crucial details) provided by the user appear accurately in the output.
   - Minor rephrasing, spelling fixes, or grammar edits are acceptable if the meaning remains unchanged.
   - If memory context is present, treat memory-derived information as valid facts even if not in Q&A.
3. It is acceptable for the output to include:
   - Extra clarifications or courtesy elements (like greetings)
   - Information derived from user memory context
   - Standard formatting and professional conventions
4. Identify issues only if:
   - The output omits or ignores a crucial fact from the Q&A (excluding memory-derived content)
   - The output contradicts or misstates a user fact
   - The output invents new factual claims that conflict with both Q&A and memory context
5. If there are no issues, "passed": true. Otherwise, "passed": false.

=== OUTPUT FORMAT ===
Return ONLY valid JSON (no extra text or backticks):
{
  "passed": boolean,
  "issues": [
    {
      "type": "missing" | "inconsistent" | "inaccurate" | "unsupported",
      "detail": "Description of the issue",
      "qa_reference": "Relevant Q&A excerpt or question"
    }
  ]
}
`;
};

export const factCorrectionPrompt = (qaFormat, generatedOutput, issues, toneClassification) => {
  const hasTone = config.openai.toneClassification.enabled && toneClassification;

  return `
You are an AI assistant responsible for correcting content based on fact-checking results.

=== ORIGINAL Q&A ===
${qaFormat}

=== CURRENT OUTPUT ===
${generatedOutput}

=== IDENTIFIED ISSUES ===
${JSON.stringify(issues, null, 2)}

${hasTone ? `=== TONE GUIDANCE ===
Maintain the ${toneClassification.tone} tone while making corrections.
Reason for tone: ${toneClassification.reasoning}` : ''}

=== TASK ===
1. Review the original Q&A and the current output.
2. Address ONLY the issues flagged:
   - If a key fact is missing, insert it.
   - If a fact is contradicted or misstated, correct it to match the user's Q&A.
   - If the output introduces a major new claim that conflicts with the Q&A, remove or adjust it.
3. Minor spelling/grammar tweaks are acceptable and need not be removed if they preserve the original meaning.
4. Ensure the corrected version:
   - Stays concise
   - Preserves the user's key details
   ${hasTone ? `   - Maintains the ${toneClassification.tone} tone throughout` : ''}
   - Does not remove benign expansions like greetings unless they cause a conflict
- Never ask for additional details or clarification - use the information provided.

=== OUTPUT FORMAT ===
Return only the corrected text, with no additional commentary, markup, or backticks.
`;
};

