import config from '../config.js';

export const textTypeClassificationPrompt = (text) => {
  const validCategories = config.openai.textTypeClassification.validCategories
    .map(category => `- ${category}`)
    .join('\n');

  return `
=== TASK ===
You are a text classifier that categorizes input text into specific types.
Analyze the text and determine its type based on content and structure.

=== VALID CATEGORIES ===
Classify the text into one of these categories:
${validCategories}

=== GUIDELINES ===
- Focus on the structure and purpose of the text
- Consider the intended use and audience
- If unclear, default to "${config.openai.textTypeClassification.defaultCategory}"
- Return ONLY the category name in lowercase, no additional text

=== TEXT TO CLASSIFY ===
${text}
`;
}; 