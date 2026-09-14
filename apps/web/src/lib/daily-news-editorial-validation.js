const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_DAILY_HIGHLIGHT_SOURCE_AGE_DAYS = 14;

const SCHEDULE_FOCUSED_PATTERN = /\b(?:auction|calendar|scheduled|schedule|upcoming|watchlist)\b|\bnext (?:catalyst|decision|event|major|release|scheduled|test)\b/i;
const UNSUPPORTED_ABSENCE_PATTERN = /\bno (?:new|current|official|primary(?:-source)?|material|relevant)[^.]{0,100}\b(?:available|found|identified|published|released)\b|\b(?:did not|does not) (?:find|identify|show)\b/i;
const TREASURY_REFUNDING_PATTERN = /\bquarterly refunding\b|\brefunding auctions?\b|\b(?:3|10|30)[ -]?year (?:Treasury )?(?:(?:notes?|bonds?) )?(?:auctions?|auction windows?)\b|\bauctions? of (?:the )?(?:3|10|30)[ -]?year (?:Treasury )?(?:notes?|bonds?)\b/i;
const TREASURY_BUYBACK_PATTERN = /\b(?:liquidity[- ]support\s+)?buybacks?\b/i;
const BUYBACK_SUPPLY_REDUCTION_PATTERN = /\b(?:reduce(?:s|d|ing)?|offset(?:s|ting)?|lower(?:s|ed|ing)?|shrink(?:s|ing)?|cut(?:s|ting)?)\b[^.!?\n]{0,120}\b(?:net\s+)?(?:long[- ]end\s+)?(?:Treasury\s+)?supply\b/i;
const BUYBACK_NEGATION_PATTERN = /\b(?:not|does\s+not|do\s+not|did\s+not|should\s+not|cannot|can't|without)\b/i;
const SOURCE_DATE_PLACEHOLDER_PATTERN = /\b(?:\d{4}-(?:\d{2}|\?\?)-(?:\d{2}|\?\?)|YYYY-MM-DD)\b/i;
const DUPLICATE_SOURCE_LEDGER_PATTERN = /(?:^|\n)\s{0,3}(?:#{1,6}\s*)?Sources\s*\(ledger\)\s*:?[ \t]*(?:\n|$)/i;
const OPERATIONAL_DATE_CUE_PATTERN = /\b(?:effective|beginning|starting)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*(\d{4}))?/i;
const UNICODE_DASH_PATTERN = /[\u2010-\u2015\u2212]/g;
const CONVERSATIONAL_RESIDUE_PATTERN = /(?:^|\n)\s*(?:#+\s*)?if you want\b|\bI can (?:add|check|expand|help|provide|re-?run)\b/i;

const MONTH_NUMBER = new Map([
  ['january', 1], ['february', 2], ['march', 3], ['april', 4],
  ['may', 5], ['june', 6], ['july', 7], ['august', 8],
  ['september', 9], ['october', 10], ['november', 11], ['december', 12],
]);

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

function hasTreasuryRefundingLanguage(value) {
  const normalized = String(value ?? '')
    .replace(UNICODE_DASH_PATTERN, '-')
    .replace(/\u00a0/g, ' ');
  return TREASURY_REFUNDING_PATTERN.test(normalized);
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

function isTreasuryBuybackSource(source) {
  return isTreasurySource(source) && TREASURY_BUYBACK_PATTERN.test(String(source?.title ?? ''));
}

function hasRecentSource(referenced, editionDate, predicate = () => true) {
  return referenced.some((source) => {
    if (!predicate(source)) return false;
    const sourceDate = dateOnly(source.publishedAt, `Source ${source.id}`);
    const age = daysBefore(editionDate, sourceDate);
    return age >= 0 && age <= MAX_DAILY_HIGHLIGHT_SOURCE_AGE_DAYS;
  });
}

function sourceDateCopiesOperationalCue(source, publishedAt) {
  const match = String(source?.title ?? '').match(OPERATIONAL_DATE_CUE_PATTERN);
  if (!match) return false;
  const [, monthName, dayText, explicitYear] = match;
  const [publishedYear, publishedMonth, publishedDay] = publishedAt.split('-').map(Number);
  const cueMonth = MONTH_NUMBER.get(monthName.toLowerCase());
  const cueDay = Number(dayText);
  const cueYear = explicitYear ? Number(explicitYear) : publishedYear;
  return cueYear === publishedYear && cueMonth === publishedMonth && cueDay === publishedDay;
}

function hasUnsupportedBuybackSupplyClaim(value) {
  const text = String(value ?? '').replace(UNICODE_DASH_PATTERN, '-');
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .some((sentence) => TREASURY_BUYBACK_PATTERN.test(sentence)
      && BUYBACK_SUPPLY_REDUCTION_PATTERN.test(sentence)
      && !BUYBACK_NEGATION_PATTERN.test(sentence));
}

function hasDatePlaceholder(value) {
  return SOURCE_DATE_PLACEHOLDER_PATTERN.test(String(value ?? ''));
}

function upcomingSystemicCoverageIssues({ summary, highlights, catalysts }) {
  const forwardLookingText = [summary, ...highlights.map(itemText)]
    .filter((text) => typeof text === 'string' && SCHEDULE_FOCUSED_PATTERN.test(text));
  const issues = [];

  for (const rule of SYSTEMIC_CATALYST_RULES) {
    if (!forwardLookingText.some((text) => rule.pattern.test(text))) continue;
    if (!catalysts.some((catalyst) => rule.pattern.test(itemText(catalyst)))) {
      issues.push(`Upcoming systemic catalyst mentioned but missing from catalysts: ${rule.eventType}`);
    }
  }
  return issues;
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

export function validateEditorialBundle({ editionDate, sources, highlights, catalysts, summary, body = '' }) {
  const edition = dateOnly(editionDate, 'Edition');
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const issues = [];
  const referencedSourceIds = new Set(
    [...highlights, ...catalysts].flatMap((item) => item?.sourceIds ?? []),
  );

  for (const source of sources) {
    const published = dateOnly(source.publishedAt, `Source ${source.id}`);
    if (published.time > edition.time) {
      issues.push(`Source ${source.id} is dated after the edition`);
    }
    if (sourceDateCopiesOperationalCue(source, published.text)) {
      issues.push(`Source ${source.id} publishedAt appears to copy an effective/beginning operational date from its title; verify the page publication date`);
    }
    if (!referencedSourceIds.has(source.id)) {
      issues.push(`Source ${source.id} is not referenced by any highlight or catalyst`);
    }
  }

  highlights.forEach((highlight, index) => {
    const context = `Highlight ${index + 1}`;
    const text = itemText(highlight);
    const referenced = referencedSources(highlight, sourceById, context);

    if (hasDatePlaceholder(text)) {
      issues.push(`${context} contains an unresolved date placeholder`);
    }
    if (UNSUPPORTED_ABSENCE_PATTERN.test(text)) {
      issues.push(`${context} makes an unsupported absence claim`);
    }
    if (referenced.some(isTreasuryBuybackSource) && hasUnsupportedBuybackSupplyClaim(text)) {
      issues.push(`${context} incorrectly characterizes Treasury buybacks as mechanically reducing or offsetting Treasury supply`);
    }
    if (hasTreasuryRefundingLanguage(text)
      && !hasRecentSource(referenced, edition, isTreasurySource)) {
      issues.push(`${context} requires a current Treasury refunding or auction source`);
    }

    if (!SCHEDULE_FOCUSED_PATTERN.test(text) && !hasRecentSource(referenced, edition)) {
      issues.push(`${context} references only stale daily-development sources`);
    }
  });

  catalysts.forEach((catalyst, index) => {
    const context = `Catalyst ${index + 1}`;
    const text = itemText(catalyst);
    const referenced = referencedSources(catalyst, sourceById, context);
    if (hasDatePlaceholder(text)) {
      issues.push(`${context} contains an unresolved date placeholder`);
    }
    if (referenced.some(isTreasuryBuybackSource) && hasUnsupportedBuybackSupplyClaim(text)) {
      issues.push(`${context} incorrectly characterizes Treasury buybacks as mechanically reducing or offsetting Treasury supply`);
    }
    if (!hasTreasuryRefundingLanguage(text)) return;
    if (!hasRecentSource(referenced, edition, isTreasurySource)) {
      issues.push(`${context} requires a current Treasury refunding or auction source`);
    }
  });

  const hasTreasuryBuybackEvidence = sources.some(isTreasuryBuybackSource);
  for (const [context, text] of [['Summary', summary], ['Body', body]]) {
    if (hasDatePlaceholder(text)) {
      issues.push(`${context} contains an unresolved date placeholder`);
    }
    if (UNSUPPORTED_ABSENCE_PATTERN.test(text)) {
      issues.push(`${context} makes an unsupported absence claim`);
    }
    if (CONVERSATIONAL_RESIDUE_PATTERN.test(text)) {
      issues.push(`${context} contains conversational assistant residue`);
    }
    if (hasTreasuryBuybackEvidence && hasUnsupportedBuybackSupplyClaim(text)) {
      issues.push(`${context} incorrectly characterizes Treasury buybacks as mechanically reducing or offsetting Treasury supply`);
    }
    if (context === 'Body' && DUPLICATE_SOURCE_LEDGER_PATTERN.test(String(text ?? ''))) {
      issues.push('Body duplicates the structured source ledger');
    }
    if (hasTreasuryRefundingLanguage(text)
      && !hasRecentSource(sources, edition, isTreasurySource)) {
      issues.push(`${context} requires a current Treasury refunding or auction source`);
    }
  }

  issues.push(...upcomingSystemicCoverageIssues({ summary, highlights, catalysts }));
  if (issues.length > 0) throw new Error(issues.join('; '));
}

export { MAX_DAILY_HIGHLIGHT_SOURCE_AGE_DAYS };
