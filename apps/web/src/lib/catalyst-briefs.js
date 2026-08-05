const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value) {
  const text = String(value ?? '');
  if (!DATE_PATTERN.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

export function catalystEventKey(date, event) {
  if (!isDateOnly(date)) throw new Error('Catalyst date must use YYYY-MM-DD');
  const eventSlug = String(event ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 72)
    .replace(/-+$/g, '');
  if (!eventSlug) throw new Error('Catalyst event requires a stable name');
  return `${date}-${eventSlug}`;
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
} = {}) {
  if (!['preview', 'outcome'].includes(phase)) throw new Error('phase must be preview or outcome');
  if (!isDateOnly(asOf)) throw new Error('asOf must use YYYY-MM-DD');

  const edition = latestPayload?.edition;
  if (!edition || !isDateOnly(edition.date) || !Array.isArray(edition.catalysts)) return null;

  const existing = new Set(existingSlugs);
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
        assets: catalyst.assets ?? [],
        importance: catalyst.importance,
        impactScore: catalyst.impactScore,
        whyItMatters: catalyst.whyItMatters,
        eventKey: catalystEventKey(catalyst.date, catalyst.event),
        slug,
      };
    })
    .filter((candidate) => !existing.has(candidate.slug))
    .sort((a, b) => (
      b.impactScore - a.impactScore
      || a.eventDate.localeCompare(b.eventDate)
      || a.event.localeCompare(b.event)
    ));

  return candidates[0] ?? null;
}
