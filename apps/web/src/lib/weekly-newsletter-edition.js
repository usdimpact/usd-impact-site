import { createHash } from 'node:crypto';

export const WEEKLY_NEWSLETTER_EDITION_SCHEMA_VERSION = 1;
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;

export class WeeklyNewsletterEditionError extends Error {
  constructor(message, code = 'WEEKLY_NEWSLETTER_EDITION_INVALID') {
    super(message);
    this.name = 'WeeklyNewsletterEditionError';
    this.code = code;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireString(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new WeeklyNewsletterEditionError(`${field} is required.`);
  return normalized;
}

function normalizeHighlight(highlight, index) {
  if (!highlight || typeof highlight !== 'object') {
    throw new WeeklyNewsletterEditionError(`highlights[${index}] is invalid.`);
  }
  if (!Array.isArray(highlight.editionDates) || highlight.editionDates.length === 0) {
    throw new WeeklyNewsletterEditionError(`highlights[${index}].editionDates is required.`);
  }
  return {
    title: requireString(highlight.title, `highlights[${index}].title`),
    summary: requireString(highlight.summary, `highlights[${index}].summary`),
    editionDates: highlight.editionDates.map((date, dateIndex) => {
      const normalized = requireString(date, `highlights[${index}].editionDates[${dateIndex}]`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        throw new WeeklyNewsletterEditionError(`highlights[${index}].editionDates[${dateIndex}] is invalid.`);
      }
      return normalized;
    }),
  };
}

function normalizeLink(link, index) {
  if (!link || typeof link !== 'object') {
    throw new WeeklyNewsletterEditionError(`links[${index}] is invalid.`);
  }
  const url = requireString(link.url, `links[${index}].url`);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new WeeklyNewsletterEditionError(`links[${index}].url is invalid.`);
  }
  if (parsed.origin !== 'https://www.usd-impact.com' || parsed.protocol !== 'https:') {
    throw new WeeklyNewsletterEditionError(`links[${index}].url is not canonical.`);
  }
  return {
    key: requireString(link.key, `links[${index}].key`),
    label: requireString(link.label, `links[${index}].label`),
    url: parsed.toString(),
  };
}

export function buildWeeklyNewsletterEditionSnapshot(payload) {
  if (
    !payload
    || typeof payload !== 'object'
    || payload.messageId !== 'weekly_newsletter'
    || payload.consentPurpose !== 'weekly_newsletter'
    || payload.classification !== 'marketing'
    || payload.locale !== 'en'
    || payload.unsubscribeRequired !== true
    || !/^\d{4}-\d{2}-\d{2}$/.test(String(payload.weekEnding ?? ''))
    || !Array.isArray(payload.highlights)
    || payload.highlights.length !== 3
    || !Array.isArray(payload.links)
    || payload.links.length < 4
  ) {
    throw new WeeklyNewsletterEditionError(
      'Weekly Newsletter payload is outside the edition snapshot contract.',
      'INVALID_WEEKLY_NEWSLETTER_PAYLOAD',
    );
  }

  const primaryCta = payload.primaryCta;
  if (!primaryCta || typeof primaryCta !== 'object') {
    throw new WeeklyNewsletterEditionError('primaryCta is required.');
  }
  const normalizedPrimary = normalizeLink(primaryCta, 0);

  const snapshot = {
    schemaVersion: WEEKLY_NEWSLETTER_EDITION_SCHEMA_VERSION,
    messageId: 'weekly_newsletter',
    consentPurpose: 'weekly_newsletter',
    templateVersion: requireString(payload.templateVersion, 'templateVersion'),
    classification: 'marketing',
    locale: 'en',
    weekEnding: payload.weekEnding,
    subject: requireString(payload.subject, 'subject'),
    preheader: requireString(payload.preheader, 'preheader'),
    title: requireString(payload.title, 'title'),
    score: {
      displayValue: requireString(payload.score?.displayValue, 'score.displayValue'),
      regime: requireString(payload.score?.regime, 'score.regime'),
      displayWeekOverWeekChange: requireString(
        payload.score?.displayWeekOverWeekChange,
        'score.displayWeekOverWeekChange',
      ),
      displayFourWeekChange: requireString(
        payload.score?.displayFourWeekChange,
        'score.displayFourWeekChange',
      ),
      note: requireString(payload.score?.note, 'score.note'),
    },
    highlights: payload.highlights.map(normalizeHighlight),
    links: payload.links.map(normalizeLink),
    primaryCta: normalizedPrimary,
    complianceNote: requireString(payload.complianceNote, 'complianceNote'),
    unsubscribeRequired: true,
    source: {
      weeklyReportPath: requireString(payload.source?.weeklyReportPath, 'source.weeklyReportPath'),
      scoreSourceUrl: requireString(payload.source?.scoreSourceUrl, 'source.scoreSourceUrl'),
      sourceEditionDates: Array.isArray(payload.source?.sourceEditionDates)
        ? payload.source.sourceEditionDates.map((date, index) => requireString(date, `source.sourceEditionDates[${index}]`))
        : [],
    },
  };

  if (snapshot.source.sourceEditionDates.length === 0) {
    throw new WeeklyNewsletterEditionError('source.sourceEditionDates must not be empty.');
  }
  return deepFreeze(snapshot);
}

export function checksumWeeklyNewsletterEdition(snapshot) {
  const normalized = buildWeeklyNewsletterEditionSnapshot(snapshot);
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function buildWeeklyNewsletterEditionArtifact(payload) {
  const snapshot = buildWeeklyNewsletterEditionSnapshot(payload);
  const checksum = checksumWeeklyNewsletterEdition(snapshot);
  return deepFreeze({
    schemaVersion: WEEKLY_NEWSLETTER_EDITION_SCHEMA_VERSION,
    checksum,
    payload: snapshot,
  });
}

export function verifyWeeklyNewsletterEditionArtifact(artifact) {
  if (
    !artifact
    || typeof artifact !== 'object'
    || artifact.schemaVersion !== WEEKLY_NEWSLETTER_EDITION_SCHEMA_VERSION
    || !CHECKSUM_PATTERN.test(String(artifact.checksum ?? ''))
  ) {
    throw new WeeklyNewsletterEditionError('Weekly Newsletter edition artifact is invalid.');
  }
  const snapshot = buildWeeklyNewsletterEditionSnapshot(artifact.payload);
  const expected = checksumWeeklyNewsletterEdition(snapshot);
  if (expected !== artifact.checksum) {
    throw new WeeklyNewsletterEditionError(
      'Weekly Newsletter edition checksum does not match its payload.',
      'WEEKLY_NEWSLETTER_EDITION_CHECKSUM_MISMATCH',
    );
  }
  return deepFreeze({
    schemaVersion: WEEKLY_NEWSLETTER_EDITION_SCHEMA_VERSION,
    checksum: artifact.checksum,
    payload: snapshot,
  });
}
