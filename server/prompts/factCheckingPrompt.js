import memoryManager from '../memory/memoryManager.js';
import config from '../config.js';

export const factCheckPrompt = (qaFormat, generatedOutput) => {
  const hasMemory = memoryManager.isEnabled() && memoryManager.getMemoriesPrompt().length > 0;

  return `
${hasMemory ? `${memoryManager.getMemoryFactCheckPrompt()}` : ''}

=== TASK ===
You are a meticulous fact-checker responsible for ensuring the final output
faithfully represents the user's responses, exactly as they provided them.

=== ORIGINAL Q&A ===
${qaFormat}

=== GENERATED OUTPUT ===
${generatedOutput}

=== GUIDELINES ===
1. Compare the user's responses in the Q&A with how they are represented in the generated output.
2. Your job is ONLY to verify that the output accurately reflects what the user said - NOT to judge if their answers were correct or appropriate for each question.

3. Verify that the user's responses appear accurately in the output, with these allowances:
   - Common spelling corrections are acceptable (e.g., "zoolm" → "zoom", "tommorrow" → "tomorrow")
   - Reasonable expansions of brief responses are fine (e.g., "ok" can be expanded into a proper response)
   - Standard formatting and professional conventions can be added
   - Grammar fixes and proper capitalization are allowed
   - Brand names can be properly capitalized/formatted (e.g., "facebook" → "Facebook")
   - Common conversational elements and closings are acceptable (e.g., "Best regards", "Cheers", "Catch you later", "Take care")
   - Standard email/written communication elements can be added (e.g., greetings, sign-offs, well-wishes)
   - Technical terms can be properly formatted (e.g., "react" → "React", "javascript" → "JavaScript")
   - Partial or incomplete responses can be expanded with standard professional elements
   ${hasMemory ? '   - Memory-derived details like names, titles, and contact info are valid' : ''}

4. Only flag issues if:
   - The output fundamentally changes or contradicts the user's intended meaning
   - The output adds major new claims or facts not implied by the context${hasMemory ? ' or memory' : ''}
   - The output completely ignores or omits the user's main point
   - The output misrepresents important details (beyond simple spelling/formatting fixes)
   - The output changes the core message or intent of the user's response
   - The output adds specific details that weren't mentioned (e.g., adding "I have 5 years of experience" when not mentioned)
   - The output changes technical specifications or requirements (e.g., changing "React" to "Vue" or "5 years" to "3 years")
   - The output includes information about topics the user explicitly declined (e.g., if user said "no" when asked if they need anything, but output says "you don't need to bring anything")
   - The output fails to capture the user's reasoning or thinking process as revealed in their responses

5. Do NOT flag issues for:
   - Whether the user's answer was appropriate for the question
   - Whether the user answered in the wrong section (ie: user answered "I want to travel" in the "What's your email subject?" question)
   - Whether the user's response makes logical sense
   - Spelling corrections that preserve the intended meaning
   - Expansion of terse responses into proper communication
   - Addition of standard professional elements
   - Grammar or formatting improvements
   - Brand name corrections
   - Addition of standard conversational elements (greetings, closings, well-wishes)
   - Addition of standard email/written communication elements
   - Proper formatting of technical terms and jargon
   - Expansion of partial responses with standard elements
   - Addition of standard professional context or background
   - Omission of topics where the user responded with "no" to optional items or preferences
   - Restructuring content to enhance clarity while preserving the user's ideas and reasoning
   ${hasMemory ? '   - Inclusion of verified memory details (names, titles, contact info, etc.)' : ''}

6. Examples of Acceptable vs Unacceptable Changes:
   ACCEPTABLE:
   - "thx" → "Thank you for your time"
   - "react" → "React"
   - Adding "Best regards" at the end
   - "i work at google" → "I work at Google"
   
   UNACCEPTABLE:
   - "I use React" → "I use Vue"
   - "3 years experience" → "5 years experience"
   - Adding specific project details not mentioned
   - Changing technical requirements or specifications

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
}`;
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
Use this tone: ${toneClassification.tone} (${config.openai.toneClassification.categories[toneClassification.tone]})` : ''}

=== CRITICAL OUTPUT FORMAT REQUIREMENTS ===
- Output ONLY the final corrected text content itself
- DO NOT include any introductory text (like "Here's the corrected version:" or "Here's my correction:")
- DO NOT include any closing commentary (like "I've fixed the issues")
- DO NOT add dividers like "---" or "***" or similar formatting markers
- DO NOT include any meta-commentary about the corrections made
- DO NOT wrap the output in quotes or code blocks
- Simply output the corrected content directly

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
   - Maintains the user's unique voice and perspective
   - Captures their thinking process and reasoning
   ${hasTone ? `   - Maintains the specified tone throughout` : ''}
   - Does not remove benign expansions like greetings unless they cause a conflict
- Never ask for additional details or clarification - use the information provided.
- When handling negative responses:
  - If the user said "no" to optional items, preferences, or arrangements that were asked as "Would you like/need/want X?", then completely omit mentioning X in the output
  - If the user was asked a direct question that needs a response, always answer that question even if the answer is negative
  - Rule of thumb: If saying "You don't need to X" or "No need to X" sounds awkward or implies X was expected by default, omit mentioning X entirely

=== OUTPUT FORMAT ===
Return only the corrected text, with no additional commentary, markup, or backticks.
`;
};

