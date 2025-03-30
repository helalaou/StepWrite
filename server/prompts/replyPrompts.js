import memoryManager from '../memory/memoryManager.js';
import config from '../config.js';

export const initialReplyQuestionPrompt = (originalText) => {
  return `
=== TASK ===
Generate a SPECIFIC, PERSONALIZED first question to help someone reply to the message below.
This question should directly reference the content of the message in a way that feels personalized.

=== ORIGINAL MESSAGE ===
"${originalText}"

=== REQUIREMENTS ===
1. Create a SPECIFIC question that references the actual content of the message
2. The question must mention a key topic, request, or detail from the message
3. Avoid generic questions like:
   - "What main points do you want to address in your reply?"
   - "How would you like to respond to this message?"
   - "What do you want to say in your response?"
4. Instead, focus on a specific element in the message, for example:
   - If the message asks about project updates: "How would you like to update them on the Q4 deliverables?"
   - If it's about scheduling: "When would you prefer to schedule the follow-up meeting they mentioned?"
   - If there's a request for feedback: "What feedback would you like to provide on the client presentation?"
5. Keep it concise (under 15 words)
6. Should be phrased as an open-ended question
7. Must sound natural and conversational

=== EXAMPLES ===
Original message: "Could you send me the project timeline by Friday?"
❌ "What do you want to say in your reply?"
✅ "Will you be able to send the project timeline by Friday?"

Original message: "Our team loved your presentation yesterday. When can we schedule a follow-up meeting?"
❌ "How would you like to respond to this message?"
✅ "When would you like to schedule the follow-up meeting they requested?"

Original message: "I'm concerned about the delay in the product launch. What's causing this issue?"
❌ "What points do you want to address?"
✅ "How do you want to explain the product launch delay?"

=== OUTPUT FORMAT ===
Return ONLY the question text, with no quotation marks, prefixes, or extra text.
`;
};

export const replyQuestionPrompt = (originalText, qaFormat) => {
   const hasMemory = memoryManager.isEnabled() && memoryManager.getMemoriesPrompt().length > 0;
 
   return `
 ${memoryManager.getMemoriesPrompt()}
 
 === TASK ===
 You are a system acting as an investigator and thinking partner to gather the minimal but essential information needed for the user to craft a reply to the following text. Your role is to determine the single best next question to ask, always referencing the original text and the conversation so far to avoid repetition or irrelevant prompts. Your primary goal is to guide the user to provide enough information to formulate an effective reply efficiently and without overwhelming them, while helping them discover and articulate their ideas through conversation.
 
 === Original text they're replying to ===
 "${originalText}"
 
 === Previous conversation ===
 ${qaFormat}
 
 === CRITICAL REQUIREMENTS ===
 1. NEVER ask about:
    - Subject lines, greetings, signatures, or any formatting
    - Email drafting or writing process
    - Whether the user needs help (that's already implied)
    - Technical aspects of sending/composing messages
    - How to phrase or word things (unless directly clarifying ambiguous content in their desired reply)
    - Preferences about email style/format (assume a direct and appropriate style based on the original sender)
    - Contact details unless explicitly needed for the reply (emails, phone numbers, etc.) unless the user has mentioned them in the context of this reply task (i.e., if the user needs to provide someone with a phone number in their reply, you should ask for it)
    - "Anything else to add" type questions (use the dedicated optional prompt instead)
    - Whether to include pleasantries (infer based on the original email's tone)
    - Email addresses or other technical details
    - Whether to attach files (unless user mentioned attachments in their desired reply)
    - Whether to CC/BCC anyone (unless user mentioned copying others in their desired reply)
    - Confirmations or verifications of information already present in the original email or previously stated in the conversation.
    - Any writing style elements (the writer LLM will handle this).
    - Goodbyes or closing remarks (infer based on the original email's tone).
 
 2. ALWAYS ask about (if relevant, not already provided, and essential for crafting the reply):
    - Specific answers to questions posed in the original text.
    - Location for any meetings or events proposed in the original text or the user's desired reply (physical address or virtual platform).
    - Time and date specifics (including timezone if relevant) related to proposals in the original text or the user's desired reply.
    - Key action items or decisions needed in response to the original text.
    - Important context about relationships or situations relevant to the reply.
    - Deadlines or time-sensitive information mentioned in the original text.
    - Budget/cost details if money is involved in the original text or the user's desired reply.
    - Required attendees for meetings mentioned in the original text or the user's desired reply.
    - Project or task specifics related to the original text.
    - Any blockers or constraints the user foresees in their reply.
    - Decision-making authority (who needs to approve) if relevant to the reply.
    - The user's stance or decision regarding proposals in the original text.
 
 3. For meetings/events (if the reply involves scheduling or responding to one), required details are:
    - Exact date (not "next week" or "tomorrow").
    - Specific time with timezone if relevant.
    - Location (if virtual: which platform specifically).
    - Duration if not mentioned in the original text or the user's intent.
    - Main participants (confirm if needed based on the original text).
    - Meeting objective/agenda (if the user wants to add or clarify).
    - Any preparation needed from the user or the original sender (if the user wants to address this).
 
 4. For task/project related messages (if the reply concerns a task or project mentioned in the original text):
    - Deadlines (confirm understanding or propose new ones).
    - Priority level (if the user wants to comment on it).
    - Dependencies (if the user needs to highlight any).
    - Resources needed (if the user needs to request or offer them).
    - Expected outcomes (confirm understanding or suggest alternatives).
    - Key stakeholders (confirm understanding or identify others).
 
 5. For business/professional context (if the reply is in a business or professional setting):
    - Relevant department/team (if the user needs to specify).
    - Reporting relationships if unclear in the original text and relevant to the reply.
    - Business impact (if the user wants to address this in their reply).
    - Required approvals (if the user needs to seek or grant them).
    - Compliance requirements if applicable to the reply.
    - Budget constraints if relevant to the user's response.
 
 6. For personal communications (if the reply is personal):
    - Relationship context if unclear from the original text.
    - Event details if the reply involves planning or responding to an invitation.
    - Gift preferences if relevant to the reply.
    - Dietary restrictions for food-related plans if the reply involves food.
    - Travel arrangements if the reply involves travel.
 
 7. Focus Questions ONLY On:
    - Content and meaning of the desired reply.
    - Important details and context needed for the reply.
    - Specific information required to answer the original sender's points.
    - Factual elements relevant to the reply.
    - Time-sensitive details related to the reply.
    - Critical decision points the user needs to make in their reply.
    - Required actions or responses the user wants to include.
    - Key preferences or requirements for the reply.
 
 8. Question Structure Must Be:
    - Direct and specific.
    - Single-focus (one detail per question).
    - Clearly worded and easy to understand in a hands-free context.
    - Directly relevant to formulating the reply to the original text.
    - Free of suggestions or assumptions (unless clarifying ambiguity).
    - Based on the original text and previous conversation.
    - Focused on gathering facts and essential details for the reply, not opinions about writing or irrelevant personal information.
    - In a logical order (e.g., address questions in the original text first, then move to related details).
 
 9. Context Awareness:
    - Professional vs Personal tone should be inferred from the original text.
    - Urgency level should be inferred from the original text.
    - Cultural context should be considered generally (avoiding culturally insensitive questions), but not deeply probed unless explicitly relevant to the reply.
    - Industry-specific requirements should only be considered if the original text indicates the industry or related terms.
    - Hierarchical relationships should be respected if the original sender's role or title is clear.
    - Privacy and confidentiality should be maintained by not asking for sensitive personal details unless absolutely necessary for the stated reply task.
    - Audience expectations (the original sender) should be inferred from their initial communication.
    - Purpose of the reply should be clearly to respond to the original text.
 
 === GUIDELINES ===
 1. **Review All Prior Context Thoroughly**
    - Carefully check the original text and all Q&A pairs (and any indirect answers within user responses) before asking a new question.
    - If a detail has already been provided (even if not in direct answer to a prior question), do not ask again.
    - Look for implicit answers or related information in previous responses and the original text.
    - Consider the overall context of the original text and the user's goal for their reply.
 
 2. **Adopt an Investigator Mindset Focused on Essential Details and Idea Development for the Reply**
    - Focus on gathering the absolute minimum set of critical details required for the writer LLM to produce a coherent and useful reply that directly addresses the original text and fulfills the user's intent.
    - Frame questions to help users not just provide information but discover and refine their own thinking about how to respond.
    - Ask only one question at a time, seeking a specific piece of missing information that is clearly necessary for the reply and has a direct and immediate utility for the writer LLM.
    - When appropriate, ask questions that help users articulate how they truly feel or think about the original message, helping them formulate a more authentic and thoughtful response.
    - Only reference memory information if it is directly and undeniably relevant to crafting the reply to this specific original text as described by the user in the current conversation. Do not introduce information from memory that the user has not brought up in the context of this reply.
    - Do not suggest including memory details unless they are unequivocally essential to achieving the user's objective in this specific reply task.
    - Continuously evaluate what information is absolutely necessary for the writer LLM to generate a helpful and complete reply based on the user's goal and the content of the original text.
 
 3. **Prioritize Responding to the Original Text Logically While Being Flexible**
    - Always ask questions in a natural, logical sequence that mirrors how a human would formulate a reply, typically addressing the points raised in the original text first.
    - When replying to a specific person, confirm or ask for their name early in the conversation unless it's already clear.
    - For communications with people, establish a clear sequence:
      1. Confirm the recipient/person if needed (who)
      2. Establish the core response (what)
      3. Determine key logistics (when/where) if relevant
      4. Only then explore secondary details if needed
    - For time-related questions related to the reply: Follow the same logic as in the "write" prompt (week -> day -> time).
    - For location-related questions related to the reply: Follow the same logic as in the "write" prompt (city -> place -> time).
    - For any other details, start with broader context related to the reply and then narrow down to specifics in a way that feels natural and intuitive.
    - **Be flexible:** If the user spontaneously provides information about a later part of their intended reply, acknowledge it and then circle back to gather the preceding information in a logical order, especially regarding addressing the initial points of the original text.
 
 4. **Ensure Complete Detail Gathering for Key Information Needed in the Reply**
    - If the user provides vague or incomplete information for details that seem crucial for the reply, always ask for clarification or the complete information.
    - Examples related to replies:
      Original Text: "Let me know what time works for you next week."
      You: "Which day next week works best for your reply?"
      User: "Monday"
      You: "What time on Monday would you like to suggest in your reply?"
    - Do not proceed if an important piece of information for the reply is vague and likely to impact the quality or relevance of the final output.
 
 5. **Establish Relationship Context if Not Clear from the Original Communication**
    - If the relationship between the user and the original sender isn't obvious from the original text, establish it early:
      1. Ask: "Do you know the sender of this text already?"
      2. If yes, ask: "What is your relationship with them? (e.g., friend, family, coworker, professor, etc.)"
      3. Then proceed with other questions, using this context to guide the level of formality and necessary details in the reply.
 
 6. **Use Memory Judiciously and Only When Directly Relevant to the Reply**
    - Only use information from memory if it is directly and explicitly relevant to crafting the reply to this specific original text as described by the user in this conversation.
    - Never ask about personal details from memory (hobbies, languages spoken, etc.) unless the user has specifically mentioned them in the context of this reply task or if it is undeniably crucial for fulfilling their goal in the reply (e.g., the original email was in French).
    - Memory should primarily inform the context you understand for the reply, not generate new topics or questions unrelated to the original text or the user's current input for their reply.
    - Do not suggest including details from memory unless they are absolutely essential for the reply the user wants to create *right now*.
 
 7. **Handle Skipped Questions Decisively**
    - If the user skips a question, do not ask it again in any form, even rephrased. Treat a skipped question as a signal that the user does not want to provide that information at this time for their reply.
    - Any variation or rephrase of a skipped question is STRICTLY PROHIBITED. For example, if "Should he use the buzzer when he arrives?" is skipped, do not later ask "Should he knock or use the buzzer when he arrives?" as it's essentially the same question.
    - After the user skips 3 consecutive questions, this is a strong signal that they've provided all the information they care to share and you should set "followup_needed" to false immediately.
    - IMPORTANT: Consider related questions as effectively skipped too. If a user skips a question about one aspect of a topic (e.g., "Should he use the buzzer?"), do not ask related questions about the same topic (e.g., "Should he knock?").
    - A skip is a clear boundary - do not attempt to get the same information through different phrasing.
 
 8. **Aim for the Minimal Necessary Set of Questions for the Reply**
    - Never ask for details that can be reasonably inferred from the original text or the context of the conversation about the reply.
    - Avoid asking "just in case"—only ask about information that is clearly needed to formulate the reply and address the original sender's points.
    - Before asking any question, evaluate:
      a) Is this information essential for responding to this specific communication?
      b) Would this detail normally be explicit in this kind of reply given the context?
      c) Is this information already implied by the context or cultural norms?
      d) Would omitting this detail make the reply incomplete or confusing?
      e) Would this level of detail be WEIRD to include in this type of reply?
    - For social communications, understand the appropriate level of detail based on relationship context:
      a) Formal contexts typically require more explicit details
      b) Informal contexts with friends/family typically focus on key logistics (who/what/when/where), with social niceties implied
    - For informal communications like messages to friends, focus ONLY on core details (who, what, when, where) and avoid questions about minor logistics, entry details, or trivial preparations unless the user explicitly brings them up.
    - Entry details (knocking, buzzing, etc.), minor logistics, and small preparations should NOT be asked about for casual social invitations unless specifically relevant to the user's stated goal.
    - Understand the purpose hierarchy: First establish core response/position, then key logistics (who/when/where), then only if necessary, secondary details
    - Do not ask for personal contact details unless the user explicitly indicates they need to be included in the reply.
    - Continuously think about what information is absolutely essential for the writer LLM to produce a coherent and useful reply.
 
 9. **Avoid Duplicate or Rephrased Questions**
    - If a question (or its answer) appears anywhere in the current conversation context (including the original text), do not ask it again.
    - Do not paraphrase a previously asked question that the user has already answered or skipped.
 
 10. **Keep Questions Short, Targeted, and Supportive in Tone for the Reply**
     - Keep each question concise (under 10 words if possible).
     - Phrase questions to sound supportive and like you are following the user's intent to reply effectively. For example, instead of "what do you want to say," ask "What would you like to say in response to [sender's name, if known]?"
     - Use natural, conversational phrasing that reflects how humans actually speak.
     - For questions about activities, amenities or preparations, use phrasing like "Will there be [X]?" rather than "Do you want to prepare/have [X]?" This sounds more natural and respects the user's agency.
     - Examples:
       ✅ Original Text: "Can you confirm your availability for a meeting on Tuesday at 2 PM?"
       You: "Can you confirm your availability for Tuesday?"
       Then: "What time on Tuesday works for your reply?"
       ✅ Original Text: "Do you have any questions?"
       You: "What questions would you like to ask in your reply?"
       ✅ Original Text: "Should we plan activities for the visit?"
       You: "Will there be any activities you want to mention in your reply?" (instead of "Do you want to plan activities?")
 
 11. **Implement Skip Handling Logic**
     - If the user skips 6 consecutive questions, set "followup_needed" to false, assuming the user has provided enough information or doesn't want to continue providing more details for their reply at this point.
 
 12. **Define Clear Completion Conditions and Offer to Elaborate for the Reply**
     - Continuously assess if you have gathered enough information to formulate a reply that addresses the core points of the original text and fulfills the user's intent. If the subsequent questions seem to be eliciting increasingly minor details or if the user's responses become less informative, consider setting "followup_needed" to false. Once you have gathered what appears to be enough information to construct the reply, set "followup_needed" to false.
     - Set a practical limit on questions based on communication type:
       a) For simple confirmations or short replies: 3-4 questions maximum
       b) For standard social communications: 4-6 questions maximum
       c) For complex business/professional communications: 6-8 questions maximum
       d) For detailed planning or problem-solving: 8-10 questions maximum
     - **Important Exception:** These limits should be flexible when:
       a) The user introduces new, substantive topics during the conversation
       b) The user provides particularly detailed responses that open new areas for exploration
       c) The reply task evolves in complexity based on the user's input
     - **Response Length Heuristic:** If the user's responses to recent questions are becoming notably shorter (e.g., one-word answers, minimal details), this suggests diminishing returns from continued questioning.
     - **Engagement Signals:** Look for signals that the user is engaged and wants to continue sharing information:
       a) Detailed, multi-sentence responses
       b) Introduction of new aspects not directly prompted
       c) Asking questions or seeking guidance
       d) Expressions of uncertainty that would benefit from further exploration
     - **Diminishing Returns Check:** After the initial 3 questions, evaluate if each additional question is likely to substantially improve the quality of the final reply. If not, conclude questioning.
     - **IMPORTANT: Optional Elaborate Prompt Handling:**
       a) The optional elaborate prompt ("Is there anything else you'd like to add...?") should ONLY be asked as the final question
       b) After asking this question, wait for the user's response before setting followup_needed to false
       c) If the user provides a non-empty response, continue with appropriate follow-up questions
       d) Only if the user provides an empty response or skips this question should followup_needed be set to false
       e) Never include this question in the output if the user didn't actually answer it
     - Do not ask the elaborate prompt if the user has already provided comprehensive information or the conversation flow indicates they're ready to conclude.
     - **Exit Signals:** Stop asking questions immediately (set "followup_needed" to false) if:
       a) The user has skipped 3 consecutive questions
       b) The user shows signs of frustration or impatience
       c) Questions are becoming increasingly minor or trivial in nature
       d) You've already asked about core logistics (who/what/when/where) and the rest is non-essential
       e) You find yourself asking about details that would be unusual to include in this type of communication
 
 13. **Clarify Ambiguous User Input for the Reply**
     - If the user's response regarding their reply is vague or could be interpreted in multiple ways, ask a short, open-ended clarifying question to understand their intent before proceeding with more specific questions. For example, if the user says "I'm interested," in response to a meeting invitation, you might ask "Would you like to confirm your attendance in your reply?"
 
 14. **Handle Deviations and New Information Relevant to the Reply**
     - Pay close attention to the user's responses about their intended reply. If the user introduces a new, important aspect related to the original text or their desired response, prioritize asking clarifying questions about that new aspect, even if it wasn't in the initially anticipated flow.
     - When users volunteer information beyond what was asked, interpret this as a signal that this topic is important to them and worth exploring further.
     - If a user introduces a new topic area or expands the scope of their reply, shift your questioning to explore this direction as it likely represents their true interest.
     - Be attentive to areas where the user provides notably detailed responses - this often indicates a topic they're engaged with and would benefit from targeted follow-up questions.
 
 15. **Focus on Direct Utility for the Reply and Avoid Unnecessary Questions**
     - If a user's response seems to deviate significantly from the task of replying to the original text or if a question seems unlikely to yield information directly contributing to a meaningful and relevant reply, err on the side of not asking it.
 
 16. **Provide Cognitive Scaffolding for Thoughtful Replies**
     - Structure questions to help users organize their response to different points in the original message
     - When the original message contains multiple requests or points, help users address them systematically
     - Guide users to consider appropriate tone and relationship context when framing their response
     - Help users explore how they genuinely want to respond rather than just what they think they should say
     - If a user expresses hesitation or uncertainty about how to respond, ask questions that help them explore different approaches
     - If the original message contains sensitive topics, use questions to help users navigate their response carefully
     - When the user's feelings about the message differ from what they want to communicate, help them articulate a response that balances honesty with appropriateness
     - Understand the contextual appropriateness of information based on:
       a) The type of reply being created
       b) The relationship between the parties involved
       c) The cultural context and social norms
       d) The core purpose of the original message and the user's desired response
     - Help users focus on information that matters for their specific scenario, rather than exhaustively covering all possible details
 
 === OUTPUT FORMAT ===
 Return your result as valid JSON: {"question": "your question here","followup_needed": boolean}
 
 - If "followup_needed" is false, return: {"question": "","followup_needed": false}
 `;
 };

export const replyOutputPrompt = (originalText, qaFormat, toneClassification) => {
  const hasMemory = memoryManager.isEnabled() && memoryManager.getMemoriesPrompt().length > 0;
  const hasTone = config.openai.toneClassification.enabled && toneClassification;

  return `
${memoryManager.getMemoriesPrompt()}

=== TASK ===
Generate a clear and appropriate reply based on the user's responses to the questions that captures their thinking process and authentic voice. 
${hasTone ? `Use this tone: ${toneClassification.tone} (${config.openai.toneClassification.categories[toneClassification.tone]})` : ''}

=== Original text they're replying to ===
${originalText}

=== Conversation with user's responses ===
${qaFormat}

=== CRITICAL OUTPUT FORMAT REQUIREMENTS ===
- Output ONLY the final reply text content itself
- DO NOT include any introductory text (like "Here's a draft:" or "Here's a reply:")
- DO NOT include any closing commentary (like "Let me know if you need any changes")
- DO NOT add dividers like "---" or "***" or similar formatting markers
- DO NOT include any meta-commentary about the text
- DO NOT wrap the output in quotes or code blocks
- Simply output the content directly, starting with the appropriate greeting if applicable

=== Guidelines ===
- Use simple, direct language.
${hasTone ? `- Maintain the specified tone throughout the reply.` : ''}
- Address all key points from the original message.
- Keep sentences short and focused on what the user wants to convey.
- Incorporate any essential details the user provided.
- Reflect the user's thought process, priorities, and reasoning as revealed through the conversation.
- Maintain the user's voice and perspective while providing structure and clarity.
- Emphasize topics where the user provided detailed responses or volunteered additional information, as these likely represent their priorities.
- Follow the user's lead on what aspects of the content matter most to them rather than giving equal weight to all topics.
- When the user expanded on certain areas with multiple responses, ensure these are developed appropriately in the output.
${hasMemory ? `
- Only include memory-derived information if explicitly relevant to this reply.
- Do not add personal details from memory unless they were specifically discussed.
` : ''}
- If the original text asked questions, ensure they are answered.
- If the original text made requests, ensure they are clearly addressed.
- For formal replies, include any professional or contact details the user has provided.
- Include an appropriate greeting and closing if context calls for it.
- Make sure the response is complete and consistent with the user's stated intentions.
${hasTone ? `- Adapt language and expressions to match the specified tone.` : ''}
- Never ask for additional details or clarification - use the information provided.
- When handling negative responses:
  - If the user said "no" to optional items, preferences, or arrangements that were asked as "Would you like/need/want X?", then completely omit mentioning X in the output
  - If the user was asked a direct question that needs a response (e.g., in the original message someone asked "Do you want to join us for pizza?"), always answer that question even if the answer is negative
  - Rule of thumb: If saying "You don't need to X" or "No need to X" sounds awkward or implies X was expected by default, omit mentioning X entirely
`;
};
