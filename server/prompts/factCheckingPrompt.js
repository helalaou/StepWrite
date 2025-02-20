import memoryManager from '../memory/memoryManager.js';
import config from '../config.js';

export const factCheckPrompt = (qaFormat, generatedOutput) => {
  const hasMemory = memoryManager.isEnabled() && memoryManager.getMemoriesPrompt().length > 0;

  return `
${memoryManager.getMemoriesPrompt()}
${hasMemory ? memoryManager.getMemoryFactCheckPrompt() : ''}

You are a meticulous fact-checker responsible for ensuring the final output
faithfully represents the user's responses, exactly as they provided them.

=== ORIGINAL Q&A ===
${qaFormat}

=== GENERATED OUTPUT ===
${generatedOutput}

=== TASK ===
1. Compare the user's responses in the Q&A with how they are represented in the generated output.
2. Your job is ONLY to verify that the output accurately reflects what the user said - NOT to judge if their answers were correct or appropriate for each question.
3. Verify that the user's responses appear accurately in the output, with these allowances:
   - Common spelling corrections are acceptable (e.g., "zoolm" → "zoom", "tommorrow" → "tomorrow")
   - Reasonable expansions of brief responses are fine (e.g., "ok" can be expanded into a proper response)
   - Standard formatting and professional conventions can be added
   - Grammar fixes and proper capitalization are allowed
   - Brand names can be properly capitalized/formatted (e.g., "facebook" → "Facebook")

4. Only flag issues if:
   - The output fundamentally changes or contradicts the user's intended meaning
   - The output adds major new claims or facts not implied by the context
   - The output completely ignores or omits the user's main point
   - The output misrepresents important details (beyond simple spelling/formatting fixes)

5. Do NOT flag issues for:
   - Whether the user's answer was appropriate for the question
   - Whether the user answered in the wrong section (ie: user answered "I want to travel" in the "What's your email subject?" question)
   - Whether the user's response makes logical sense
   - Spelling corrections that preserve the intended meaning
   - Expansion of terse responses into proper communication
   - Addition of standard professional elements
   - Grammar or formatting improvements
   - Brand name corrections

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

