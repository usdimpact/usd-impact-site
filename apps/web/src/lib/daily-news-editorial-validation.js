const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_DAILY_HIGHLIGHT_SOURCE_AGE_DAYS = 14;

const SCHEDULE_FOCUSED_PATTERN = /\b(?:auction|calendar|next|scheduled|schedule|upcoming|watchlist)\b/i;
const UNSUPPORTED_ABSENCE_PATTERN = /\bno (?:new|current|official|primary(?:-source)?|material|relevant)[^.]{0,100}\b(?:available|found|identified|published|released)\b|\b(?:did not|does not) (?:find|identify|show)\b/i;
const TREASURY_REFUNDING_PATTERN = /\bquarterly refunding\b|\brefunding auctions?\b|\b(?:3|10|30)[ -]?year (?:notes?|bonds?)(?: auctions?)?\b/i;

const SYSTEMIC_CATALYST_RULES = [
  {
    eventType: 'central-bank',
    pattern: /\bFOMC\b|Federal Reserve policy decision|central[- ]bank (?:policy )?decision/i,
  },
  {
    eventType: 'inflation',
    pattern: /\bCPI\b|consumer price index|personal consumption expenditures|\bPCE\b/i,
  },
  {
    eventType: 'labor',
    pattern: /employment situation|nonfarm payrolls?|\bpayrolls?\b/i,
  },
];

function dateOnly(value, context) {
  const text = String(value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${context} has an invalid date`);
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error(`${context} has an invalid date`);
  }
  return { text, time: parsed.getTime() };
}

function daysBefore(editionDate, sourceDate) {
  return Math.floor((editionDate.time - sourceDate.time) / DAY_MS);
}

function itemText(item) {
  return [item?.headline, item?.development, item?.whyItMatters, item?.event]
    .filter((value) => typeof value === 'string')
    .join(' ');
}

function referencedSources(item, sourceById, context) {
  return (item?.sourceIds ?? []).map((id) => {
    const source = sourceById.get(id);
    if (!source) throw new Error(`${context} references unknown source: ${id}`);
    return source;
  });
}

function isTreasurySource(source) {
  try {
    const hostname = new URL(source.url).hostname.toLowerCase().replace(/^www\./, '');
    return hostname === 'treasury.gov' || hostname.endsWith('.treasury.gov');
  } catch {
    return false;
  }
}

function hasRecentSource(referenced, editionDate, predicate = () => true) {
  return referenced.some((source) => {
    if (!predicate(source)) return false;
    const sourceDate = dateOnly(source.publishedAt, `Source ${source.id}`);
    const age = daysBefore(editionDate, sourceDate);
    return age >= 0 && age <= MAX_DAILY_HIGHLIGHT_SOURCE_AGE_DAYS;
  });
}

function validateUpcomingSystemicCoverage({ summary, highlights, catalysts }) {
  const forwardLookingText = [summary, ...highlights.map(itemText)]
    .filter((text) => typeof text === 'string' && SCHEDULE_FOCUSED_PATTERN.test(text));

  for (const rule of SYSTEMIC_CATALYST_RULES) {
    if (!forwardLookingText.some((text) => rule.pattern.test(text))) continue;
    if (!catalysts.some((catalyst) => rule.pattern.test(itemText(catalyst)))) {
      throw new Error(`Upcoming systemic catalyst mentioned but missing from catalysts: ${rule.eventType}`);
    }
  }
}

export function buildMetaDescription(summary, maxLength = 300) {
  const normalized = String(summary ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;

  const candidate = normalized.slice(0, maxLength);
  const sentenceEnds = [...candidate.matchAll(/[.!?](?=\s|$)/g)];
  const lastSentenceEnd = sentenceEnds.at(-1)?.index;
  if (Number.isInteger(lastSentenceEnd) && lastSentenceEnd >= Math.min(100, Math.floor(maxLength / 2))) {
    return candidate.slice(0, lastSentenceEnd + 1).trim();
  }

  const wordBoundary = candidate.lastIndexOf(' ');
  const clean = candidate
    .slice(0, wordBoundary >= Math.floor(maxLength * 0.6) ? wordBoundary : maxLength - 1)
    .replace(/[,:;\s–—-]+$/u, '')
    .trim();
  return `${clean}…`;
}

export function validateEditorialBundle({ editionDate, sources, highlights, catalysts, summary }) {
  const edition = dateOnly(editionDate, 'Edition');
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  for (const source of sources) {
    const published = dateOnly(source.publishedAt, `Source ${source.id}`);
    if (published.time > edition.time) {
      throw new Error(`Source ${source.id} is dated after the edition`);
    }
  }

  highlights.forEach((highlight, index) => {
    const context = `Highlight ${index + 1}`;
    const text = itemText(highlight);
    const referenced = referencedSources(highlight, sourceById, context);

    if (UNSUPPORTED_ABSENCE_PATTERN.test(text)) {
      throw new Error(`${context} makes an unsupported absence claim`);
    }

    if (TREASURY_REFUNDING_PATTERN.test(text)
      && !hasRecentSource(referenced, edition, isTreasurySource)) {
      throw new Error(`${context} requires a current Treasury refunding or auction source`);
    }

    if (!SCHEDULE_FOCUSED_PATTERN.test(text) && !hasRecentSource(referenced, edition)) {
      throw new Error(`${context} references only stale daily-development sources`);
    }
  });

  catalysts.forEach((catalyst, index) => {
    const text = itemText(catalyst);
    if (!TREASURY_REFUNDING_PATTERN.test(text)) return;
    const context = `Catalyst ${index + 1}`;
    const referenced = referencedSources(catalyst, sourceById, context);
    if (!hasRecentSource(referenced, edition, isTreasurySource)) {
      throw new Error(`${context} requires a current Treasury refunding or auction source`);
    }
  });

  validateUpcomingSystemicCoverage({ summary, highlights, catalysts });
}

export { MAX_DAILY_HIGHLIGHT_SOURCE_AGE_DAYS };
