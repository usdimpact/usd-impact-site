import { createHash } from 'node:crypto';
import { buildProgressEmailMeaningfulChanges, progressEmailMeaningfulChangeRegistryVersion } from './progress-email-meaningful-changes.js';
import { buildWeeklyNewsletterPayload } from './weekly-newsletter-contract.js';

export const PROGRESS_EMAIL_QA_SOURCE_SCHEMA_VERSION = 1;
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WEEKLY_CATEGORY = 'Weekly USD Impact Brief';

export class ProgressEmailQaSourceArtifactError extends Error {
  constructor(message, code = 'PROGRESS_EMAIL_QA_SOURCE_ARTIFACT_INVALID') {
    super(message);
    this.name = 'ProgressEmailQaSourceArtifactError';
    this.code = code;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function reportData(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  return entry.data && typeof entry.data === 'object' ? entry.data : entry;
}

function requireString(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new ProgressEmailQaSourceArtifactError(`${field} is required.`);
  return normalized;
}

function requireDate(value, field) {
  const normalized = requireString(value, field);
  const parsed = Date.parse(`${normalized}T12:00:00.000Z`);
  if (!DATE_PATTERN.test(normalized) || !Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== normalized) {
    throw new ProgressEmailQaSourceArtifactError(`${field} must be a valid YYYY-MM-DD date.`);
  }
  return normalized;
}

function requireTimestamp(value, field) {
  const parsed = Date.parse(String(value ?? ''));
  if (!Number.isFinite(parsed)) {
    throw new ProgressEmailQaSourceArtifactError(`${field} must be a valid timestamp.`);
  }
  return new Date(parsed).toISOString();
}

function normalizeCurrentWeeklyReport(entry) {
  const report = reportData(entry);
  if (!report) throw new ProgressEmailQaSourceArtifactError('Current Weekly Report is missing.');
  const validated = buildWeeklyNewsletterPayload({ weeklyReport: report });
  if (!Array.isArray(report.themes) || !Array.isArray(report.sourceEditions)) {
    throw new ProgressEmailQaSourceArtifactError('Current Weekly Report source arrays are missing.');
  }

  return {
    title: validated.title,
    slug: validated.source.weeklyReportPath,
    periodStart: requireDate(report.periodStart, 'currentWeeklyReport.periodStart'),
    periodEnd: validated.weekEnding,
    generatedAt: requireTimestamp(report.generatedAt, 'currentWeeklyReport.generatedAt'),
    status: 'published',
    category: WEEKLY_CATEGORY,
    summary: requireString(report.summary, 'currentWeeklyReport.summary'),
    score: {
      value: validated.score.value,
      regime: validated.score.regime,
      weekOverWeekChange: validated.score.weekOverWeekChange,
      fourWeekChange: validated.score.fourWeekChange,
      nearestRegimeBoundary: validated.score.nearestRegimeBoundary,
      sourceUrl: validated.score.sourceUrl,
    },
    themes: report.themes.map((theme, index) => ({
      title: requireString(theme?.title, `currentWeeklyReport.themes[${index}].title`),
      summary: requireString(theme?.summary, `currentWeeklyReport.themes[${index}].summary`),
      editionDates: Array.isArray(theme?.editionDates)
        ? theme.editionDates.map((date, dateIndex) => requireDate(
          date,
          `currentWeeklyReport.themes[${index}].editionDates[${dateIndex}]`,
        ))
        : [],
    })),
    sourceEditions: report.sourceEditions.map((source, index) => ({
      date: requireDate(source?.date, `currentWeeklyReport.sourceEditions[${index}].date`),
      title: requireString(source?.title, `currentWeeklyReport.sourceEditions[${index}].title`),
      url: requireString(source?.url, `currentWeeklyReport.sourceEditions[${index}].url`),
    })),
    complianceNote: validated.complianceNote,
  };
}

function normalizeSourceReport(entry, index) {
  const report = reportData(entry);
  if (!report) {
    throw new ProgressEmailQaSourceArtifactError(`sourceReports[${index}] is missing.`);
  }
  if (report.status !== 'published' || report.category !== WEEKLY_CATEGORY) {
    throw new ProgressEmailQaSourceArtifactError(
      `sourceReports[${index}] is not an approved published Weekly Report.`,
      'PROGRESS_EMAIL_QA_SOURCE_NOT_PUBLISHED',
    );
  }
  const periodEnd = requireDate(report.periodEnd, `sourceReports[${index}].periodEnd`);
  const slug = requireString(report.slug, `sourceReports[${index}].slug`).replace(/\/$/, '');
  if (slug !== `/reports/weekly/${periodEnd}`) {
    throw new ProgressEmailQaSourceArtifactError(
      `sourceReports[${index}] slug does not match its period.`,
      'PROGRESS_EMAIL_QA_SOURCE_SLUG_MISMATCH',
    );
  }
  return {
    title: requireString(report.title, `sourceReports[${index}].title`),
    slug,
    periodEnd,
    generatedAt: requireTimestamp(report.generatedAt, `sourceReports[${index}].generatedAt`),
    status: 'published',
    category: WEEKLY_CATEGORY,
  };
}

export function buildProgressEmailQaSourceSnapshot({ currentWeeklyReport, sourceReports } = {}) {
  if (!Array.isArray(sourceReports)) {
    throw new ProgressEmailQaSourceArtifactError('sourceReports must be an array.');
  }
  const current = normalizeCurrentWeeklyReport(currentWeeklyReport);
  const normalizedSources = sourceReports.map(normalizeSourceReport)
    .sort((left, right) => left.periodEnd.localeCompare(right.periodEnd));
  const seen = new Set();
  for (const source of normalizedSources) {
    if (seen.has(source.periodEnd)) {
      throw new ProgressEmailQaSourceArtifactError(
        `Duplicate source report ${source.periodEnd}.`,
        'DUPLICATE_PROGRESS_EMAIL_QA_SOURCE',
      );
    }
    seen.add(source.periodEnd);
  }

  buildProgressEmailMeaningfulChanges({ weeklyReports: normalizedSources });

  return deepFreeze({
    schemaVersion: PROGRESS_EMAIL_QA_SOURCE_SCHEMA_VERSION,
    registryVersion: progressEmailMeaningfulChangeRegistryVersion(),
    weekEnding: current.periodEnd,
    currentWeeklyReport: current,
    sourceReports: normalizedSources,
  });
}

export function checksumProgressEmailQaSourceSnapshot(snapshot) {
  const normalized = buildProgressEmailQaSourceSnapshot(snapshot);
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function buildProgressEmailQaSourceArtifact(input = {}) {
  const payload = buildProgressEmailQaSourceSnapshot(input);
  const checksum = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return deepFreeze({
    schemaVersion: PROGRESS_EMAIL_QA_SOURCE_SCHEMA_VERSION,
    checksum,
    payload,
  });
}

export function verifyProgressEmailQaSourceArtifact(artifact) {
  if (
    !artifact
    || typeof artifact !== 'object'
    || artifact.schemaVersion !== PROGRESS_EMAIL_QA_SOURCE_SCHEMA_VERSION
    || !CHECKSUM_PATTERN.test(String(artifact.checksum ?? ''))
  ) {
    throw new ProgressEmailQaSourceArtifactError('Progress QA source artifact is invalid.');
  }
  const payload = buildProgressEmailQaSourceSnapshot(artifact.payload);
  const expected = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  if (artifact.checksum !== expected) {
    throw new ProgressEmailQaSourceArtifactError(
      'Progress QA source artifact checksum does not match its payload.',
      'PROGRESS_EMAIL_QA_SOURCE_CHECKSUM_MISMATCH',
    );
  }
  return deepFreeze({
    schemaVersion: PROGRESS_EMAIL_QA_SOURCE_SCHEMA_VERSION,
    checksum: artifact.checksum,
    payload,
  });
}
