const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const SOURCE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

export const SOURCE_DATE_SCHEMA_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';
export const SOURCE_ID_SCHEMA_PATTERN = '^[a-z0-9][a-z0-9-]{1,63}$';
export const SOURCE_DATE_RULES = [
  'Source publishedAt values must use exactly YYYY-MM-DD.',
  'If a provider returns a full ISO timestamp, convert it to the leading YYYY-MM-DD date.',
  'Never use month-only text, human-readable dates, relative dates, or access dates.',
  'If an otherwise useful page has no verifiable publication date, omit that source and any unsupported claim instead of inventing a date.',
].join(' ');
export const SOURCE_ID_RULES = [
  'Every source id must be lowercase and hyphenated.',
  'Source ids must start with a letter or number, contain only lowercase letters, numbers, and hyphens, and be 2-64 characters long.',
  'Never place a URL in a source id field.',
  'Use the same normalized source id in every highlight and catalyst reference.',
].join(' ');

function isRealDate(value) {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function sourceIdBase(value, source, index) {
  const candidates = [value, source?.title, source?.url, `source-${index + 1}`];
  for (const candidate of candidates) {
    const normalized = String(candidate ?? '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')
      .slice(0, 64)
      .replace(/-+$/g, '');
    if (SOURCE_ID_PATTERN.test(normalized)) return normalized;
    if (/^[a-z0-9]$/.test(normalized)) return `${normalized}-source`;
  }
  return `source-${index + 1}`;
}

function uniqueSourceId(base, used) {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const suffixText = `-${suffix}`;
    const candidate = `${base.slice(0, 64 - suffixText.length).replace(/-+$/g, '')}${suffixText}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  throw new Error('Could not create a unique source id');
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

  const usedIds = new Set();
  const idMap = new Map();
  const sources = draft.sources.map((source, index) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return source;
    const originalId = String(source.id ?? '').trim();
    const id = uniqueSourceId(sourceIdBase(originalId, source, index), usedIds);
    if (originalId && !idMap.has(originalId)) idMap.set(originalId, id);
    try {
      return {
        ...source,
        id,
        publishedAt: normalizePublishedAt(source.publishedAt, id),
      };
    } catch {
      return { ...source, id };
    }
  });

  const rewriteSourceIds = (items) => {
    if (!Array.isArray(items)) return items;
    return items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !Array.isArray(item.sourceIds)) return item;
      return {
        ...item,
        sourceIds: item.sourceIds.map((id) => idMap.get(String(id ?? '').trim()) ?? String(id ?? '').trim()),
      };
    });
  };

  const highlights = rewriteSourceIds(draft.highlights);
  const catalystInput = draft.catalysts == null ? [] : draft.catalysts;
  const catalysts = rewriteSourceIds(catalystInput);
  const highlightItems = Array.isArray(highlights) ? highlights : [];
  const catalystItems = Array.isArray(catalysts) ? catalysts : [];
  const referencedSourceIds = new Set(
    [...highlightItems, ...catalystItems]
      .flatMap((item) => (Array.isArray(item?.sourceIds) ? item.sourceIds : [])),
  );
  const referencedSources = referencedSourceIds.size > 0
    ? sources.filter((source) => referencedSourceIds.has(source?.id))
    : sources;

  return {
    ...draft,
    sources: referencedSources,
    highlights,
    catalysts,
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
  if (/invalid source id|source id field|lowercase and hyphenated/i.test(text)) {
    return {
      code: 'invalid-source-id',
      reason: 'One or more source IDs are malformed. Use unique lowercase hyphenated IDs and reference them consistently.',
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
  if (/invalid JSON|structured output|must be an object|missing required field|must be an array|invalid collection/i.test(text)) {
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
