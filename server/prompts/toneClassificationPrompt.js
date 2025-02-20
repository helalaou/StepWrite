import config from '../config.js';

export const toneClassificationPrompt = (qaFormat, originalText = '') => {
  const toneCategories = Object.entries(config.openai.toneClassification.categories)
    .map(([key, description]) => `   - ${key}: ${description}`)
    .join('\n');

  return `
=== TASK ===
Analyze the conversation and determine the most appropriate tone for the response.

${originalText ? `=== ORIGINAL TEXT ===
${originalText}

` : ''}=== CONVERSATION Q&A ===
${qaFormat}

=== TONE ANALYSIS GUIDELINES ===
1. Consider these factors:
   - The nature of the relationship (professional, personal, etc.)
   - The context and purpose of the communication
   - The level of formality in the user's responses
   - The emotional undertones in the conversation
   - The intended audience
   - The type of message (request, information, apology, etc.)

2. Classify into one of these categories:
${toneCategories}

3. Consider these aspects:
   - Word choice and vocabulary level
   - Sentence structure complexity
   - Use of contractions and idioms
   - Level of directness
   - Emotional expression
   - Cultural context

=== OUTPUT FORMAT ===
Return ONLY a JSON object with:
{
  "tone": "TONE_CATEGORY",
  "confidence": 0.1-1.0,
  "reasoning": "Brief explanation of classification"
}
`;
}; 