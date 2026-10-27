// Reasoning models (o-series, gpt-5) reject `temperature` and `max_tokens`.
// They take `max_completion_tokens`, which also counts hidden reasoning tokens.
const REASONING_MODEL_PATTERN = /^(o\d|gpt-5)/;

export function isReasoningModel(model) {
  return REASONING_MODEL_PATTERN.test(model);
}

// Build chat.completions.create params from a { model, temperature, maxTokens } config block.
export function buildCompletionParams({ model, temperature, maxTokens }, messages) {
  const params = { model, messages };

  if (isReasoningModel(model)) {
    if (maxTokens) params.max_completion_tokens = maxTokens;
    return params;
  }

  if (temperature !== undefined) params.temperature = temperature;
  if (maxTokens) params.max_tokens = maxTokens;
  return params;
}
