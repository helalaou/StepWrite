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
- If a memory detail conflicts with what the user explicitly says in the current conversation, always prioritize the user's current input
- Don't suggest memory details unless they're directly relevant to the current request
`;
};

export const memoryFactCheckPrompt = (memories) => {
  if (!memories || Object.keys(memories).length === 0) {
    return '';
  }

  return `
=== MEMORY-AWARE FACT CHECKING ===
The following information exists in the user's memory context and should NOT be flagged as inconsistencies or unsupported claims:
${Object.entries(memories)
  .map(([category, items]) => `${category}:\n${items.join('\n')}`)
  .join('\n\n')}

Important:
- Do not flag information as missing, inconsistent, or unsupported if it matches or is derived from these memory items
- Personal details, preferences, or context from these memories are considered valid even if not explicitly mentioned in the Q&A
- Names, locations, or other specific details from memories should be treated as verified facts
- Any reasonable expansion or natural use of this contextual information is acceptable
`;
}; 