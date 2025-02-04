export const memoryPrompt = (memories) => {
  if (!memories || Object.keys(memories).length === 0) {
    return '';
  }

  return `
=== USER CONTEXT ===
Consider the following information about the user when generating questions:
${Object.entries(memories)
  .map(([category, items]) => `${category}:\n${items.join('\n')}`)
  .join('\n\n')}

Additional Guidelines:
- Use this information to avoid asking questions about things we already know
- For texts that require a name signature, use the user's name
- Only reference this information when relevant to the current task
- Do not expose or directly mention that you have this stored information
- Use this context to make suggestions more personalized when appropriate
`;
}; 