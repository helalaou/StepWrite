export const memoryPrompt = (memories) => {
  if (!memories || Object.keys(memories).length === 0) {
    return '';
  }

  // Function to format nested objects
  const formatMemoryObject = (obj, indent = 0) => {
    const indentStr = ' '.repeat(indent);
    return Object.entries(obj)
      .map(([key, value]) => {
        if (typeof value === 'object' && !Array.isArray(value)) {
          return `${indentStr}${key}:\n${formatMemoryObject(value, indent + 2)}`;
        } else if (Array.isArray(value)) {
          return `${indentStr}${key}: ${value.join(', ')}`;
        } else {
          return `${indentStr}${key}: ${value}`;
        }
      })
      .join('\n');
  };

  return `
=== USER CONTEXT ===
Consider the following information about the user when generating content:
${Object.entries(memories)
  .map(([category, data]) => `${category}:\n${formatMemoryObject(data, 2)}`)
  .join('\n\n')}

Additional Guidelines:
- Use this information to avoid asking questions about things we already know
- For texts that require a name signature, use the user's full name (${memories.personalInfo?.fullName || ''})
- For emails, always start with "Hello [Recipient's Name]" (never with the user's name)
- For replies, use the user's information to personalize the response
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

  // Function to format nested objects for fact checking
  const formatMemoryObject = (obj, indent = 0) => {
    const indentStr = ' '.repeat(indent);
    return Object.entries(obj)
      .map(([key, value]) => {
        if (typeof value === 'object' && !Array.isArray(value)) {
          return `${indentStr}${key}:\n${formatMemoryObject(value, indent + 2)}`;
        } else if (Array.isArray(value)) {
          return `${indentStr}${key}: ${value.join(', ')}`;
        } else {
          return `${indentStr}${key}: ${value}`;
        }
      })
      .join('\n');
  };

  return `
=== MEMORY-AWARE FACT CHECKING ===
The following information exists in the user's memory context and should NOT be flagged as inconsistencies or unsupported claims:
${Object.entries(memories)
  .map(([category, data]) => `${category}:\n${formatMemoryObject(data, 2)}`)
  .join('\n\n')}

Important:
- Do not flag information as missing, inconsistent, or unsupported if it matches or is derived from these memory items
- Personal details, preferences, or context from these memories are considered valid even if not explicitly mentioned in the Q&A
- Names, locations, or other specific details from memories should be treated as verified facts
- Any reasonable expansion or natural use of this contextual information is acceptable
`;
}; 