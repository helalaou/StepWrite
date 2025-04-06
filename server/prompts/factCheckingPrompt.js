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
3. Be highly attentive to casual or brief mentions by the user that should be included in the output.

4. Verify that the user's responses appear accurately in the output, with these allowances:
   - Common spelling corrections are acceptable (e.g., "zoolm" → "zoom", "tommorrow" → "tomorrow")
   - Reasonable expansions of brief responses are fine (e.g., "ok" can be expanded into a proper response)
   - Standard formatting and professional conventions can be added
   - Grammar fixes and proper capitalization are allowed
   - Brand names can be properly capitalized/formatted (e.g., "facebook" → "Facebook")
   - Common conversational elements and closings are acceptable (e.g., "Best regards", "Cheers", "Catch you later", "Take care")
   - Standard email/written communication elements can be added (e.g., greetings, sign-offs, well-wishes)
   - Technical terms can be properly formatted (e.g., "react" → "React", "javascript" → "JavaScript")
   - Partial or incomplete responses can be expanded with standard professional elements
   - Flexibility preferences (like "I'm flexible" or "any time works") can be appropriately reflected
   - Brief mentions can be contextually developed in a way consistent with the user's intent 
   - Standard conversational inferences are allowed (e.g., if user mentioned bringing something, output mentioning they'll bring it)
   ${hasMemory ? '   - Memory-derived details like names, titles, and contact info are valid' : ''}

5. Only flag issues if:
   - The output fundamentally changes or contradicts the user's intended meaning
   - The output adds major new claims or facts not implied by the context${hasMemory ? ' or memory' : ''}
   - The output completely ignores or omits the user's main point
   - The output misrepresents important details (beyond simple spelling/formatting fixes)
   - The output changes the core message or intent of the user's response
   - The output adds specific details that weren't mentioned and significantly alter meaning (e.g., adding "I have 5 years of experience" when not mentioned)
   - The output changes technical specifications or requirements (e.g., changing "React" to "Vue" or "5 years" to "3 years")
   - The output includes information about topics the user explicitly declined or skipped questions about
   - The output fails to capture the user's reasoning or thinking process as revealed in their responses
   - The output omits important details that the user mentioned, even if briefly or casually

6. Do NOT flag issues for:
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
   - Minor stylistic improvements that don't change meaning
   - Reasonable contextual development of ideas mentioned briefly by the user
   - Appropriate handling of flexible preferences (e.g., "I'm flexible with time" → "I'm available whenever works best for you")
   ${hasMemory ? '   - Inclusion of verified memory details (names, titles, contact info, etc.)' : ''}

7. Examples of Acceptable vs Unacceptable Changes:
   ACCEPTABLE:
   - "thx" → "Thank you for your time"
   - "react" → "React"
   - Adding "Best regards" at the end
   - "i work at google" → "I work at Google"
   - "i'm flexible on timing" → "I'm available whenever works best for you"
   - "i'll bring a certificate" → "I'll bring the death certificate as documentation"
   - User mentions allergies briefly → Output includes appropriate mention of allergies
   
   UNACCEPTABLE:
   - "I use React" → "I use Vue"
   - "3 years experience" → "5 years experience"
   - Adding specific project details not mentioned
   - Changing technical requirements or specifications
   - User mentioned "I have a certificate" → Output completely omits this detail
   - User skipped questions about budget → Output includes budget details
   - "I'll send the report Monday" → "I'll send the report Wednesday"

8. Special Intelligence Requirements:
   - Pay special attention to brief or casual mentions by the user that should be included in the output
   - Check if the output maintains flexibility when the user expressed flexibility
   - Verify that topics the user skipped questions about are not included in the output
   - Ensure important contextual details, even if mentioned only once, appear appropriately in the output
   - Look for contradictions between what users said and what the output contains
   - Verify that the output captures the user's unique perspective and voice on important topics
   - Check that brief mentions in long responses weren't missed in the output

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

=== CRITICAL INTELLIGENCE REQUIREMENTS ===
- Make MINIMAL changes to fix ONLY the issues flagged
- DO NOT "over-correct" by changing things that weren't identified as issues
- IMPORTANT: Preserve brief mentions by the user - if the issue is that a brief mention was omitted, ensure it's included
- If a user expressed flexibility on a topic, maintain that flexibility in your correction
- Never add information about topics the user explicitly skipped questions about
- Pay close attention to specific facts, dates, times, and details mentioned by the user
- Maintain the exact meaning and intent of the user's responses
- For missing information, add it to the appropriate context in the output where it makes the most sense
- For inaccurate information, change only what's necessary to fix the inaccuracy
- For unsupported claims, remove only the specific unsupported content
- ALWAYS prioritize what the user actually said over what sounds better or more complete

=== TASK ===
1. Review the original Q&A and the current output.
2. Address ONLY the issues flagged:
   - If a key fact or detail is missing (including brief mentions), insert it appropriately
   - If a fact is contradicted or misstated, correct it to match the user's Q&A
   - If the output introduces a major new claim that conflicts with the Q&A, remove or adjust it
   - If information appears about topics the user skipped, remove that information
3. Correction Strategy:
   - Make surgical, precise changes to fix only the specific issues
   - Preserve as much of the original output as possible
   - Only rewrite sections that directly contain issues
   - When adding missing information, place it in the most contextually appropriate location
   - When removing contradictory information, ensure the flow remains natural
   - For brief mentions that were missed, incorporate them naturally into the appropriate context
4. Ensure the corrected version:
   - Stays concise
   - Preserves ALL of the user's key details, including those mentioned briefly
   - Maintains the user's unique voice and perspective
   - Captures their thinking process and reasoning
   ${hasTone ? `   - Maintains the specified tone throughout` : ''}
   - Does not remove benign expansions like greetings unless they cause a conflict
   - Maintains the same structure and organization unless the issues require changes
   - Does NOT include information about topics the user skipped questions about
- Never ask for additional details or clarification - use the information provided.
- When handling negative responses:
  - If the user said "no" to optional items, preferences, or arrangements that were asked as "Would you like/need/want X?", then completely omit mentioning X in the output
  - If the user was asked a direct question that needs a response, always answer that question even if the answer is negative
  - Rule of thumb: If saying "You don't need to X" or "No need to X" sounds awkward or implies X was expected by default, omit mentioning X entirely

=== EXAMPLES ===
ISSUE: User mentioned "I have a certificate" but this is missing from the output
GOOD CORRECTION: Add mention of the certificate in a contextually appropriate place
BAD CORRECTION: Completely rewrite the entire paragraph or change other unrelated details

ISSUE: Output says Wednesday but user said Monday
GOOD CORRECTION: Change just the day from Wednesday to Monday
BAD CORRECTION: Rewrite the entire sentence or paragraph

ISSUE: Output includes budget information but user skipped all budget questions
GOOD CORRECTION: Remove only the budget information while preserving the rest of the content
BAD CORRECTION: Remove an entire paragraph or section that contains other valid information

=== OUTPUT FORMAT ===
Return only the corrected text, with no additional commentary, markup, or backticks.
`;
};

