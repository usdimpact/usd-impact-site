// Opt-in, metadata-only OpenAI diagnostics for USD Impact Daily generation.
// This module performs no API calls, writes no files, and logs nothing by default.
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const STAGES = new Set(['research', 'repair']);
const OUTCOMES = new Set(['validated', 'invalid', 'provider_failed']);

function count(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

export function summarizeOpenAiUsage(usage) {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return null;
  return {
    inputTokens: count(usage.input_tokens),
    cachedInputTokens: count(usage.input_tokens_details?.cached_tokens),
    outputTokens: count(usage.output_tokens),
    reasoningTokens: count(usage.output_tokens_details?.reasoning_tokens),
    totalTokens: count(usage.total_tokens),
  };
}

// Never log raw provider/validator strings, URLs, identifiers, prompt text or
// source excerpts. The ordered rules translate observed failures into enums.
export function classifyGptValidationReason(reason) {
  const value = typeof reason === 'string' ? reason : '';
  if (/not returned by OpenAI web search|ungrounded|grounded.context/i.test(value)) return 'ungrounded_source';
  if (/3-24 sources|3-12 sources|fewer than three (grounded )?source|source count|source ledger must contain/i.test(value)) return 'source_count';
  if (/stale|prior 14 days|current Treasury (refunding|auction) source/i.test(value)) return 'stale_source';
  if (/missing from catalysts|catalyst.*missing|statusLabel is invalid/i.test(value)) return 'catalyst_mismatch';
  if (/publishedAt|publication date|source date|dated document|date attribution/i.test(value)) return 'source_date';
  if (/primary source|reporting domain|independent reporting/i.test(value)) return 'insufficient_evidence';
  if (/invalid JSON|not valid JSON|malformed JSON|unknown source|schema|invalid output/i.test(value)) return 'schema_invalid';
  return 'other';
}

export function emitGptUsageDiagnostic({
  response,
  stage,
  outcome,
  validationReason,
  repairAttempt = 0,
} = {}, options = {}) {
  const env = options.env ?? process.env;
  if (env?.USDIMPACT_GPT_METRICS_ENABLED !== 'true') return false;

  // Metrics are best-effort. A bad provider payload or logger must never
  // turn an otherwise valid Daily into an HTTP 502 or trigger paid retries.
  try {
    const model = typeof response?.model === 'string' && MODEL_ID.test(response.model)
      ? response.model
      : 'unknown';
    const record = {
      event: 'USDIMPACT_GPT_USAGE',
      schemaVersion: 1,
      component: 'daily-news',
      stage: STAGES.has(stage) ? stage : 'unknown',
      outcome: OUTCOMES.has(outcome) ? outcome : 'unknown',
      model,
      repairAttempt: Math.min(count(repairAttempt) ?? 0, 2),
      validationCode: outcome === 'validated' ? 'none' : classifyGptValidationReason(validationReason),
      usage: summarizeOpenAiUsage(response?.usage),
    };
    const logger = options.logger ?? console.info;
    logger(JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}
