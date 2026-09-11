import {
  PROGRESS_EMAIL_CHANGE_REGISTRY_VERSION,
  progressEmailMeaningfulChangeRegistry,
} from '../data/progress-email-meaningful-changes.js';

const CANONICAL_ORIGIN = 'https://www.usd-impact.com';
const PRIORITIES = new Set(['P2', 'P3']);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CHANGE_ID_PATTERN = /^weekly-report:(\d{4}-\d{2}-\d{2})$/;

export class ProgressEmailMeaningfulChangeError extends Error {
  constructor(message, code = 'PROGRESS_EMAIL_MEANINGFUL_CHANGE_INVALID') {
    super(message);
    this.name = 'ProgressEmailMeaningfulChangeError';
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

function requireDateOnly(value, field) {
  const normalized = String(value ?? '').trim();
  if (!DATE_ONLY_PATTERN.test(normalized)) {
    throw new ProgressEmailMeaningfulChangeError(`${field} must use YYYY-MM-DD.`);
  }
  const parsed = Date.parse(`${normalized}T12:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== normalized) {
    throw new ProgressEmailMeaningfulChangeError(`${field} must be a valid calendar date.`);
  }
  return normalized;
}

function requireTimestamp(value, field) {
  const parsed = Date.parse(String(value ?? ''));
  if (!Number.isFinite(parsed)) {
    throw new ProgressEmailMeaningfulChangeError(`${field} must be a valid timestamp.`);
  }
  return new Date(parsed).toISOString();
}

function requireString(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new ProgressEmailMeaningfulChangeError(`${field} is required.`);
  return normalized;
}

function canonicalUrl(path, field) {
  const raw = requireString(path, field);
  let parsed;
  try {
    parsed = new URL(raw, CANONICAL_ORIGIN);
  } catch {
    throw new ProgressEmailMeaningfulChangeError(`${field} is invalid.`);
  }
  if (parsed.origin !== CANONICAL_ORIGIN || parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new ProgressEmailMeaningfulChangeError(`${field} must resolve to the canonical USD Impact origin.`);
  }
  parsed.hash = '';
  return parsed.toString();
}

function normalizeRegistryEntry(entry, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new ProgressEmailMeaningfulChangeError(`registry[${index}] must be an object.`);
  }
  if (entry.sourceType !== 'weekly_report') {
    throw new ProgressEmailMeaningfulChangeError(
      `registry[${index}].sourceType is not approved.`,
      'UNAPPROVED_PROGRESS_CHANGE_SOURCE',
    );
  }
  const sourceId = requireDateOnly(entry.sourceId, `registry[${index}].sourceId`);
  const changeId = requireString(entry.changeId, `registry[${index}].changeId`);
  const match = changeId.match(CHANGE_ID_PATTERN);
  if (!match || match[1] !== sourceId) {
    throw new ProgressEmailMeaningfulChangeError(
      `registry[${index}].changeId must match its Weekly Report source ID.`,
      'PROGRESS_CHANGE_ID_MISMATCH',
    );
  }
  const priority = requireString(entry.priority, `registry[${index}].priority`).toUpperCase();
  if (!PRIORITIES.has(priority)) {
    throw new ProgressEmailMeaningfulChangeError(
      `registry[${index}].priority must be P2 or P3.`,
      'UNAPPROVED_PROGRESS_CHANGE_PRIORITY',
    );
  }
  return {
    changeId,
    sourceType: 'weekly_report',
    sourceId,
    priority,
    occurredAt: requireTimestamp(entry.occurredAt, `registry[${index}].occurredAt`),
  };
}

function normalizeWeeklyReport(entry, sourceId) {
  const report = reportData(entry);
  if (!report) {
    throw new ProgressEmailMeaningfulChangeError(
      `Weekly Report ${sourceId} is missing.`,
      'PROGRESS_CHANGE_SOURCE_MISSING',
    );
  }
  if (report.status !== 'published' || report.category !== 'Weekly USD Impact Brief') {
    throw new ProgressEmailMeaningfulChangeError(
      `Weekly Report ${sourceId} is not an approved published source.`,
      'PROGRESS_CHANGE_SOURCE_NOT_PUBLISHED',
    );
  }
  const periodEnd = requireDateOnly(report.periodEnd, `weeklyReports[${sourceId}].periodEnd`);
  if (periodEnd !== sourceId) {
    throw new ProgressEmailMeaningfulChangeError(
      `Weekly Report ${sourceId} period does not match its registry source ID.`,
      'PROGRESS_CHANGE_SOURCE_ID_MISMATCH',
    );
  }
  const expectedSlug = `/reports/weekly/${sourceId}`;
  if (String(report.slug ?? '').replace(/\/$/, '') !== expectedSlug) {
    throw new ProgressEmailMeaningfulChangeError(
      `Weekly Report ${sourceId} slug does not match its period.`,
      'PROGRESS_CHANGE_SOURCE_SLUG_MISMATCH',
    );
  }
  return {
    title: requireString(report.title, `weeklyReports[${sourceId}].title`),
    generatedAt: requireTimestamp(report.generatedAt, `weeklyReports[${sourceId}].generatedAt`),
    url: canonicalUrl(expectedSlug, `weeklyReports[${sourceId}].slug`),
  };
}

export function buildProgressEmailMeaningfulChanges({
  registry = progressEmailMeaningfulChangeRegistry,
  weeklyReports = [],
} = {}) {
  if (!Array.isArray(registry) || !Array.isArray(weeklyReports)) {
    throw new ProgressEmailMeaningfulChangeError('Registry and Weekly Reports must be arrays.');
  }

  const reportsByPeriodEnd = new Map();
  for (const entry of weeklyReports) {
    const report = reportData(entry);
    if (!report || typeof report.periodEnd !== 'string') continue;
    if (reportsByPeriodEnd.has(report.periodEnd)) {
      throw new ProgressEmailMeaningfulChangeError(
        `Duplicate Weekly Report source ${report.periodEnd}.`,
        'DUPLICATE_PROGRESS_CHANGE_SOURCE',
      );
    }
    reportsByPeriodEnd.set(report.periodEnd, entry);
  }

  const seenChangeIds = new Set();
  const changes = registry.map((entry, index) => {
    const normalized = normalizeRegistryEntry(entry, index);
    if (seenChangeIds.has(normalized.changeId)) {
      throw new ProgressEmailMeaningfulChangeError(
        `Duplicate progress change ID ${normalized.changeId}.`,
        'DUPLICATE_PROGRESS_CHANGE_ID',
      );
    }
    seenChangeIds.add(normalized.changeId);

    const source = normalizeWeeklyReport(reportsByPeriodEnd.get(normalized.sourceId), normalized.sourceId);
    if (Date.parse(normalized.occurredAt) < Date.parse(source.generatedAt)) {
      throw new ProgressEmailMeaningfulChangeError(
        `Progress change ${normalized.changeId} cannot occur before its source was generated.`,
        'PROGRESS_CHANGE_PRECEDES_SOURCE',
      );
    }
    return {
      kind: 'weekly_report',
      priority: normalized.priority,
      title: source.title,
      occurredAt: normalized.occurredAt,
      url: source.url,
    };
  });

  changes.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  return deepFreeze(changes);
}

export function progressEmailMeaningfulChangeRegistryVersion() {
  return PROGRESS_EMAIL_CHANGE_REGISTRY_VERSION;
}
