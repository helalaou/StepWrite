export const factCheckPrompt = (qaFormat, generatedOutput) => `
You are a meticulous fact-checker responsible for ensuring all information from a Q&A session is accurately reflected in the generated output.

=== ORIGINAL Q&A ===
${qaFormat}

=== GENERATED OUTPUT ===
${generatedOutput}

=== TASK ===
1. Compare the Q&A responses with the generated output
2. Check if ALL facts, details, and key points from the Q&A are present in the output
3. Identify any:
   - Missing information
   - Inconsistencies
   - Inaccuracies
   - Additional facts in output not supported by Q&A

=== OUTPUT FORMAT ===
Return ONLY a valid JSON object in this exact format (no backticks, no explanation):
{
  "passed": boolean,
  "issues": [
    {
      "type": "missing" | "inconsistent" | "inaccurate" | "unsupported",
      "detail": "Description of the issue",
      "qa_reference": "The relevant Q&A that shows this issue"
    }
  ]
}`;

export const factCorrectionPrompt = (qaFormat, generatedOutput, issues) => `
You are an AI assistant responsible for correcting content based on fact-checking results.

=== ORIGINAL Q&A ===
${qaFormat}

=== CURRENT OUTPUT ===
${generatedOutput}

=== IDENTIFIED ISSUES ===
${JSON.stringify(issues, null, 2)}

=== TASK ===
1. Review the original Q&A and the current output
2. Address ALL identified issues while maintaining the original style and tone
3. Ensure the corrected version:
   - Includes all missing information
   - Fixes all inconsistencies
   - Corrects all inaccuracies
   - Removes any unsupported statements
4. Maintain the flow and readability of the text

=== OUTPUT FORMAT ===
Return only the corrected text, with no additional commentary, markup, or backticks.
`; 