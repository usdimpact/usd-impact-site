// Read-only editorial diagnostic. It never authorizes publication or verifies that
// operator-supplied source URLs actually contain the claimed result.
import { canonicalUrl, sourceClassification } from '../../api/daily-news-source.js';

const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isTimestamp = (value) => typeof value === 'string' && UTC_TIMESTAMP.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().startsWith(value.slice(0, 19));
const officialUrl = (value) => {
  try {
    return typeof value === 'string'
      && sourceClassification(value)?.sourceType === 'primary'
      && new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};
const bad = (message) => { throw new Error(`Invalid release-review evidence: ${message}`); };

export function assessDailyMajorReleaseCoverage({ edition, calendar, asOfUtc }) {
  if (!edition || !calendar || typeof edition !== 'object' || typeof calendar !== 'object') bad('missing edition or calendar');
  if (!ISO_DATE.test(edition.date) || !isTimestamp(asOfUtc)) bad('edition date or as-of timestamp');
  if (calendar.schemaVersion !== 1 || calendar.editionDate !== edition.date
      || !Array.isArray(calendar.events) || calendar.events.length > 16) {
    bad('calendar version, date or event list');
  }
  const events = calendar.events;
  if (!events.length) {
    return { editionDate: edition.date, asOfUtc, releaseAuthorized: false, humanEditorialApprovalRequired: true,
      decision: 'HOLD_CALENDAR_COVERAGE_UNVERIFIED', events: [] };
  }
  const generatedAt = isTimestamp(edition.generatedAt) ? Date.parse(edition.generatedAt) : null;
  const asOf = Date.parse(asOfUtc);
  const ids = new Set();
  const ledger = Array.isArray(edition.sources) ? edition.sources : [];
  const highlights = Array.isArray(edition.highlights) ? edition.highlights : [];
  const outcomes = [];
  for (const event of events) {
    if (!event || typeof event.id !== 'string' || !/^[A-Z0-9][A-Z0-9_-]{2,79}$/.test(event.id)
        || ids.has(event.id)) bad('event id missing or duplicated');
    ids.add(event.id);
    if (!isTimestamp(event.releaseAtUtc) || !officialUrl(event.calendarUrl)
        || typeof event.name !== 'string' || !event.name.trim()
        || event.releaseAtUtc.slice(0, 10) !== edition.date) {
      bad(`event ${event.id} has invalid schedule identity or source`);
    }
    if (event.outcomeUrl != null && !officialUrl(event.outcomeUrl)) {
      bad(`event ${event.id} has invalid primary outcome URL`);
    }
    const releaseAt = Date.parse(event.releaseAtUtc);
    const expectedOutcome = event.outcomeUrl ? canonicalUrl(event.outcomeUrl) : null;
    const matched = expectedOutcome ? ledger.find((s) => {
      try {
        return s?.publishedAt === edition.date && s?.sourceType === 'primary'
          && sourceClassification(s.url)?.sourceType === 'primary'
          && canonicalUrl(s.url) === expectedOutcome;
      } catch {
        return false;
      }
    }) : null;
    const used = matched && highlights.some((h) => Array.isArray(h?.sourceIds) && h.sourceIds.includes(matched.id));
    let decision;
    if (asOf < releaseAt) decision = 'HOLD_RELEASE_NOT_YET_DUE';
    else if (!expectedOutcome) decision = 'HOLD_OUTCOME_DOCUMENT_NOT_VERIFIED';
    else if (!matched || !used) decision = 'HOLD_OFFICIAL_OUTCOME_NOT_IN_HIGHLIGHTS';
    else if (generatedAt == null || generatedAt > asOf) decision = 'HOLD_CUTOFF_UNTRUSTED';
    else if (generatedAt < releaseAt) decision = 'HOLD_POST_RELEASE_EDITORIAL_RECEIPT_REQUIRED';
    else decision = 'READY_FOR_HUMAN_EDITORIAL_REVIEW';
    outcomes.push({ id: event.id, name: event.name, releaseAtUtc: event.releaseAtUtc,
      calendarUrl: event.calendarUrl, outcomeUrl: event.outcomeUrl ?? null,
      sourceId: matched?.id ?? null, decision });
  }
  const fullyCited = outcomes.every((x) => x.decision === 'READY_FOR_HUMAN_EDITORIAL_REVIEW');
  return { editionDate: edition.date, asOfUtc, generatedAt: edition.generatedAt ?? null,
    releaseAuthorized: false, humanEditorialApprovalRequired: true,
    decision: fullyCited ? 'READY_FOR_HUMAN_EDITORIAL_REVIEW' : 'HOLD_RELEASE_REVIEW_REQUIRED',
    events: outcomes };
}
