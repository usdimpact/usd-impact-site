const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export const SOURCE_DATE_SCHEMA_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';
export const SOURCE_DATE_RULES = [
  'Source publishedAt values must use exactly YYYY-MM-DD.',
  'If a provider returns a full ISO timestamp, convert it to the leading YYYY-MM-DD date.',
  'Never use month-only text, human-readable dates, relative dates, or access dates.',
  'If an otherwise useful page has no verifiable publication date, omit that source and any unsupported claim instead of inventing a date.',
].join(' ');

function isRealDate(value) {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function normalizePublishedAt(value, sourceId = 'unknown') {
  const text = String(value ?? '').trim();
  const datePart = text.slice(0, 10);

  if (DATE_ONLY_PATTERN.test(text)) {
    if (!isRealDate(text)) throw new Error(`Source ${sourceId} has an invalid publishedAt date`);
    return text;
  }

  if (!ISO_TIMESTAMP_PATTERN.test(text) || !isRealDate(datePart) || !Number.isFinite(Date.parse(text))) {
    throw new Error(`Source ${sourceId} has an invalid publishedAt value`);
  }

  return datePart;
}

export function normalizeBundleDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return draft;
  if (!Array.isArray(draft.sources)) return draft;

  return {
    ...draft,
    sources: draft.sources.map((source) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) return source;
      try {
        return {
          ...source,
          publishedAt: normalizePublishedAt(source.publishedAt, String(source.id ?? 'unknown')),
        };
      } catch {
        return source;
      }
    }),
  };
}

export function safeValidationDiagnostic(message) {
  const text = String(message ?? '');

  if (/invalid publishedAt|publication date|source date/i.test(text)) {
    return {
      code: 'invalid-source-date',
      reason: 'One or more source publication dates are invalid. Use a verified YYYY-MM-DD value or omit the undated source.',
    };
  }
  if (/not returned by OpenAI web search|grounded URL|grounded source/i.test(text)) {
    return {
      code: 'ungrounded-source',
      reason: 'One or more cited URLs were not present in the grounded web-search results.',
    };
  }
  if (/approved domain|trusted domain/i.test(text)) {
    return {
      code: 'unapproved-source-domain',
      reason: 'One or more sources are outside the approved publisher list.',
    };
  }
  if (/requires one primary source or two independent reporting domains/i.test(text)) {
    return {
      code: 'insufficient-source-verification',
      reason: 'A highlight did not meet the required primary-source or independent-reporting verification threshold.',
    };
  }
  if (/fewer than two grounded|2-24 sources|at least two sources/i.test(text)) {
    return {
      code: 'insufficient-sources',
      reason: 'The generated bundle did not contain enough verified sources.',
    };
  }
  if (/invalid JSON|structured output|must be an object|missing required field/i.test(text)) {
    return {
      code: 'invalid-structured-output',
      reason: 'The generated bundle did not match the required structured-output format.',
    };
  }
  if (/did not complete|incomplete|cancelled|failed|timeout|aborted/i.test(text)) {
    return {
      code: 'provider-incomplete',
      reason: 'The provider response did not complete successfully.',
    };
  }

  return {
    code: 'generation-validation-failed',
    reason: 'The generated bundle did not satisfy the USD Impact validation requirements.',
  };
}
