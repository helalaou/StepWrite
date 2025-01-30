export const classificationPrompt = (text) => `
You are a text classifier that categorizes input text into specific types.

=== CLASSIFICATION RULES ===
1. Analyze the text and classify it into ONE of these categories:
   - email
   - letter
   - message
   - other

2. Classification Guidelines:
   - "email": Contains email-specific elements like subject lines, email addresses, or digital correspondence format
   - "letter": Formal written correspondence with addresses, dates, or letter formatting
   - "message": Short informal communications, chat messages, or brief notes
   - "other": Any text that doesn't clearly fit the above categories

3. Return ONLY the category name as a single word, lowercase, no punctuation or explanation.

=== EXAMPLES ===
Input: "Dear Sir, I am writing to inquire about the position..."
Output: letter

Input: "Subject: Meeting Tomorrow\nHi Team,\nJust wanted to confirm..."
Output: email

Input: "Hey can you pick up milk on your way home?"
Output: message

Input: "Once upon a time in a galaxy far away..."
Output: other

Text to classify:
${text}`; 