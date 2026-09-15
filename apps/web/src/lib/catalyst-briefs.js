import { explicitCpiIdentity } from './publication-calendar-pipeline.js';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isDateOnly(value) {
  const text = String(value ?? '');
  if (!DATE_PATTERN.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

function eventSlug(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function catalystEventFamily(value) {
  const slug = eventSlug(value);
  if (/(^|-)fomc(-|$)/.test(slug) || slug.includes('federal-open-market-committee')) return 'fomc';
  return null;
}

function parseExistingCatalystSlug(value) {
  const match = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})-(.+)-(preview|outcome)$/);
  if (!match || !isDateOnly(match[1])) return null;
  return {
    eventDate: match[1],
    event: match[2],
    phase: match[3],
  };
}

function dateDistanceDays(left, right) {
  const leftTime = new Date(`${left}T00:00:00.000Z`).getTime();
  const rightTime = new Date(`${right}T00:00:00.000Z`).getTime();
  return Math.abs(leftTime - rightTime) / DAY_MS;
}

function isEquivalentExistingCatalyst(candidate, existingSlug) {
  const existing = parseExistingCatalystSlug(existingSlug);
  if (!existing || existing.phase !== candidate.phase) return false;

  const family = catalystEventFamily(candidate.event);
  if (!family || catalystEventFamily(existing.event) !== family) return false;

  // FOMC meetings span two days, while different Daily editions may key the same
  // meeting to either its start date or its decision/press-conference date.
  return dateDistanceDays(candidate.eventDate, existing.eventDate) <= 1;
}

export function catalystEventKey(date, event) {
  if (!isDateOnly(date)) throw new Error('Catalyst date must use YYYY-MM-DD');
  const normalizedEvent = eventSlug(event)
    .slice(0, 72)
    .replace(/-+$/g, '');
  if (!normalizedEvent) throw new Error('Catalyst event requires a stable name');
  return `${date}-${normalizedEvent}`;
}

export function catalystBriefSlug(date, event, phase) {
  if (!['preview', 'outcome'].includes(phase)) throw new Error('Catalyst brief phase must be preview or outcome');
  return `${catalystEventKey(date, event)}-${phase}`;
}

function addDays(date, days) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function selectImportantCatalyst(latestPayload, {
  phase,
  asOf,
  existingSlugs = [],
  existingIdentities = [],
} = {}) {
  if (!['preview', 'outcome'].includes(phase)) throw new Error('phase must be preview or outcome');
  if (!isDateOnly(asOf)) throw new Error('asOf must use YYYY-MM-DD');

  const edition = latestPayload?.edition;
  if (!edition || !isDateOnly(edition.date) || !Array.isArray(edition.catalysts)) return null;

  const priorSlugs = Array.isArray(existingSlugs) ? existingSlugs : [];
  const existing = new Set(priorSlugs);
  const knownIdentities = new Set(existingIdentities);
  const lowerBound = phase === 'preview' ? asOf : addDays(asOf, -1);
  const upperBound = phase === 'preview' ? addDays(asOf, 2) : asOf;

  const candidates = edition.catalysts
    .filter((catalyst) => (
      catalyst?.importance === 'high'
      && Number(catalyst?.impactScore) >= 4
      && catalyst?.extraBrief === true
      && isDateOnly(catalyst?.date)
      && catalyst.date >= lowerBound
      && catalyst.date <= upperBound
    ))
    .map((catalyst) => {
      const slug = catalystBriefSlug(catalyst.date, catalyst.event, phase);
      return {
        phase,
        asOf,
        sourceEditionDate: edition.date,
        eventDate: catalyst.date,
        event: catalyst.event,
        eventType: catalyst.eventType,
        calendar: catalyst.calendar ?? null,
        statusLabel: phase === 'preview' ? 'scheduled-confirmed' : 'released',
        assets: catalyst.assets ?? [],
        importance: catalyst.importance,
        impactScore: catalyst.impactScore,
        whyItMatters: catalyst.whyItMatters,
        eventKey: catalystEventKey(catalyst.date, catalyst.event),
        slug,
      };
    })
    .filter((candidate) => (
      !existing.has(candidate.slug)
      && !priorSlugs.some((slug) => isEquivalentExistingCatalyst(candidate, slug))
      && !knownIdentities.has(`${explicitCpiIdentity(candidate.event)}:${phase}`)
    ))
    .sort((a, b) => (
      b.impactScore - a.impactScore
      || a.eventDate.localeCompare(b.eventDate)
      || a.event.localeCompare(b.event)
    ));

  return candidates[0] ?? null;
}
