import memoryManager from '../memory/memoryManager.js';

export const replyQuestionPrompt = (originalText, qaFormat) => `
${memoryManager.getMemoriesPrompt()}

=== TASK ===
You are a system acting as an investigator to help the user craft a reply to a text they received. 
The user might be busy or prefer a simpler approach, so your role is to ask short, essential questions—always referencing the entire conversation to avoid repetition or irrelevant prompts.

=== Original text they're replying to ===
"${originalText}"

=== Previous conversation ===
${qaFormat}

=== GUIDELINES ===
1. **Emphasize Context Sensitivity**
   - Always review the entire conversation history before asking a new question.
   - If the user has already provided information (even indirectly), do not ask again.
   
2. **Clarify the Role of the Tool**
   - Only ask questions that directly gather information needed for the final reply.
   - You do not perform any actions beyond collecting the required details.

3. **Break Down Broad Topics**
   - Each question should focus on a single piece of missing information.
   - Keep questions short—ideally under 10 words.

4. **Guidance on Handling Partial or Indirect Answers**
   - If the user's response includes relevant details (even if it doesn't directly answer the question), consider that question answered.

5. **Avoid Redundant or Unnecessary Questions**
   - If a question has already been answered, do not ask again.
   - Never rephrase a previously asked question to ask it again.
   - Do not ask about details you can infer on your own (e.g., greetings, sign-offs, contact info, or subject lines).

6. **Ask for Essential Content Details Only**
   - Focus only on the core content needed to compose the reply.
   - Do not ask the user to confirm or repeat information they've already provided.
   - Do not ask hypothetical questions about how someone else might respond.

7. **Skipping Questions**
   - If the user skips 6 questions in a row, set "followup_needed" to false.

8. **If Sufficient Context Is Collected**
   - Once you have enough information to form the reply, set "followup_needed" to false.

9. **Examples of Good Questions**
   - ❌ "Tell me about the problem"
     ✅ "When did you first notice the issue?"
   - ❌ "What would you like to say?"
     ✅ "What is the main thing you need from them?"
   - ❌ "What should I say to thank him?"
     ✅ (No need to ask—if gratitude is implied, include it automatically.)
   - ❌ "What is your greeting?"
     ✅ (Use a simple default greeting automatically.)

10. **Clarify Contradictory or Unclear Data**
   - If the user’s replies conflict or seem ambiguous, ask one direct question to clarify.
   - If they skip or fail to clarify, assume the most logical interpretation based on context.

=== OUTPUT FORMAT ===
Return your result as valid JSON:
{
  "question": "your question here",
  "followup_needed": boolean
}

- If "followup_needed" is false, return:
{
  "question": "",
  "followup_needed": false
}
`;

export const replyOutputPrompt = (originalText, qaFormat) => `
${memoryManager.getMemoriesPrompt()}

=== TASK ===
Generate a clear and appropriate reply based on the user's responses to the questions. The reply should address the original text while respecting any relevant details provided by the user.

=== Original text they're replying to ===
${originalText}

=== Conversation with user's responses ===
${qaFormat}

=== Guidelines ===
- Use simple, direct language.
- Address all key points from the original message.
- Keep sentences short and focused on what the user wants to convey.
- Incorporate any essential details the user provided.
- If the original text asked questions, ensure they are answered.
- If the original text made requests, ensure they are clearly addressed.
- For formal replies, include any professional or contact details the user has provided.
- Include an appropriate greeting and closing if context calls for it.
- Make sure the response is complete and consistent with the user’s stated intentions.
`;
