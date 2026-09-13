const SITE_ORIGIN = 'https://www.usd-impact.com';
const WEEKLY_REPORT_CATEGORY = 'Weekly USD Impact Brief';
const EDUCATIONAL_SCORE_NOTE = 'The USD Impact Score is an educational market-regime framework reading. It is not a forecast or trading signal.';

export const WEEKLY_NEWSLETTER_MESSAGE_ID = 'weekly_newsletter';
export const WEEKLY_NEWSLETTER_CONSENT_PURPOSE = 'weekly_newsletter';
export const WEEKLY_NEWSLETTER_TEMPLATE_VERSION = 'weekly-newsletter-v1';

export class WeeklyNewsletterContractError extends Error {
  constructor(message, code = 'WEEKLY_NEWSLETTER_CONTRACT_INVALID') {
    super(message);
    this.name = 'WeeklyNewsletterContractError';
    this.code = code;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, field) {
  if (!isObject(value)) {
    throw new WeeklyNewsletterContractError(`${field} must be an object.`, 'INVALID_WEEKLY_REPORT');
  }
  return value;
}

function requireString(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new WeeklyNewsletterContractError(`${field} is required.`, 'INVALID_WEEKLY_REPORT');
  }
  return normalized;
}

function requireFiniteNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new WeeklyNewsletterContractError(`${field} must be a finite number.`, 'INVALID_WEEKLY_REPORT');
  }
  return number;
}

function requireDateOnly(value, field) {
  const normalized = requireString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new WeeklyNewsletterContractError(`${field} must use YYYY-MM-DD.`, 'INVALID_WEEKLY_REPORT');
  }
  const parsed = Date.parse(`${normalized}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) {
    throw new WeeklyNewsletterContractError(`${field} is not a valid date.`, 'INVALID_WEEKLY_REPORT');
  }
  return normalized;
}

function normalizeReportInput(entry) {
  const root = requireObject(entry, 'weeklyReport');
  return isObject(root.data) ? root.data : root;
}

function canonicalSiteUrl(value, field) {
  const raw = requireString(value, field);
  let parsed;
  try {
    parsed = new URL(raw, SITE_ORIGIN);
  } catch {
    throw new WeeklyNewsletterContractError(`${field} must be a valid URL.`, 'INVALID_WEEKLY_REPORT_URL');
  }
  if (
    parsed.origin !== SITE_ORIGIN
    || parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
  ) {
    throw new WeeklyNewsletterContractError(`${field} must resolve to the canonical USD Impact site.`, 'NON_CANONICAL_WEEKLY_REPORT_URL');
  }
  parsed.hash = '';
  return parsed.toString();
}

function requireExternalUrl(value, field) {
  const raw = requireString(value, field);
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('invalid');
    return parsed.toString();
  } catch {
    throw new WeeklyNewsletterContractError(`${field} must be a secure URL.`, 'INVALID_WEEKLY_SCORE_SOURCE_URL');
  }
}

function signed(value) {
  const rounded = Math.round(value * 100) / 100;
  if (Object.is(rounded, -0) || rounded === 0) return '0.00';
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(2)}`;
}

function normalizeTheme(theme, index) {
  const input = requireObject(theme, `themes[${index}]`);
  const editionDates = Array.isArray(input.editionDates)
    ? input.editionDates.map((date, dateIndex) => requireDateOnly(date, `themes[${index}].editionDates[${dateIndex}]`))
    : [];
  if (editionDates.length === 0) {
    throw new WeeklyNewsletterContractError(`themes[${index}] must reference at least one source edition.`, 'UNSOURCED_WEEKLY_HIGHLIGHT');
  }
  return {
    title: requireString(input.title, `themes[${index}].title`),
    summary: requireString(input.summary, `themes[${index}].summary`),
    editionDates,
  };
}

function normalizeSourceEdition(source, index) {
  const input = requireObject(source, `sourceEditions[${index}]`);
  return {
    date: requireDateOnly(input.date, `sourceEditions[${index}].date`),
    title: requireString(input.title, `sourceEditions[${index}].title`),
    url: canonicalSiteUrl(input.url, `sourceEditions[${index}].url`),
  };
}

function normalizeWeeklyReport(entry) {
  const report = normalizeReportInput(entry);
  if (report.status !== 'published') {
    throw new WeeklyNewsletterContractError('Weekly newsletter input must be published.', 'WEEKLY_REPORT_NOT_PUBLISHED');
  }
  if (report.category !== WEEKLY_REPORT_CATEGORY) {
    throw new WeeklyNewsletterContractError('Weekly newsletter input has the wrong category.', 'INVALID_WEEKLY_REPORT_CATEGORY');
  }

  const periodStart = requireDateOnly(report.periodStart, 'periodStart');
  const periodEnd = requireDateOnly(report.periodEnd, 'periodEnd');
  if (periodStart > periodEnd) {
    throw new WeeklyNewsletterContractError('Weekly report period is inverted.', 'INVALID_WEEKLY_REPORT_PERIOD');
  }

  const slug = requireString(report.slug, 'slug').replace(/\/$/, '');
  if (slug !== `/reports/weekly/${periodEnd}`) {
    throw new WeeklyNewsletterContractError('Weekly report slug does not match its completed period.', 'WEEKLY_REPORT_PERIOD_MISMATCH');
  }

  const score = requireObject(report.score, 'score');
  const normalizedScore = {
    value: requireFiniteNumber(score.value, 'score.value'),
    regime: requireString(score.regime, 'score.regime'),
    weekOverWeekChange: requireFiniteNumber(score.weekOverWeekChange, 'score.weekOverWeekChange'),
    fourWeekChange: requireFiniteNumber(score.fourWeekChange, 'score.fourWeekChange'),
    nearestRegimeBoundary: requireFiniteNumber(score.nearestRegimeBoundary, 'score.nearestRegimeBoundary'),
    sourceUrl: requireExternalUrl(score.sourceUrl, 'score.sourceUrl'),
  };

  if (!Array.isArray(report.themes) || report.themes.length < 3 || report.themes.length > 5) {
    throw new WeeklyNewsletterContractError('Weekly report must contain between three and five themes.', 'INVALID_WEEKLY_REPORT_THEMES');
  }
  const themes = report.themes.map(normalizeTheme);

  if (!Array.isArray(report.sourceEditions) || report.sourceEditions.length === 0) {
    throw new WeeklyNewsletterContractError('Weekly report must reference at least one source edition.', 'MISSING_WEEKLY_REPORT_SOURCES');
  }
  const sourceEditions = report.sourceEditions.map(normalizeSourceEdition);
  const sourceDates = new Set(sourceEditions.map((source) => source.date));
  for (const theme of themes) {
    for (const date of theme.editionDates) {
      if (!sourceDates.has(date)) {
        throw new WeeklyNewsletterContractError(
          `Weekly highlight references missing Daily edition ${date}.`,
          'WEEKLY_HIGHLIGHT_SOURCE_MISMATCH',
        );
      }
    }
  }

  return {
    title: requireString(report.title, 'title'),
    slug,
    periodStart,
    periodEnd,
    summary: requireString(report.summary, 'summary'),
    score: normalizedScore,
    themes,
    sourceEditions,
    complianceNote: requireString(report.complianceNote, 'complianceNote'),
  };
}

export function buildWeeklyNewsletterPayload({ weeklyReport, locale = 'en' } = {}) {
  if (locale !== 'en') {
    throw new WeeklyNewsletterContractError(
      'Only source-language English is enabled until translated copy has an approved validation path.',
      'UNAPPROVED_NEWSLETTER_LOCALE',
    );
  }

  const report = normalizeWeeklyReport(weeklyReport);
  const reportUrl = canonicalSiteUrl(report.slug, 'weeklyReport.slug');
  const latestDaily = [...report.sourceEditions].sort((left, right) => right.date.localeCompare(left.date))[0];

  const links = [
    { key: 'weekly_report', label: 'Read the Weekly Report', url: reportUrl },
    { key: 'score', label: 'Review the Score', url: canonicalSiteUrl('/score/', 'score link') },
    { key: 'score_methodology', label: 'Score methodology', url: canonicalSiteUrl('/score/methodology/', 'methodology link') },
    { key: 'latest_daily', label: 'Latest Daily context', url: latestDaily.url },
  ];

  const score = {
    value: report.score.value,
    displayValue: signed(report.score.value),
    regime: report.score.regime,
    weekOverWeekChange: report.score.weekOverWeekChange,
    displayWeekOverWeekChange: signed(report.score.weekOverWeekChange),
    fourWeekChange: report.score.fourWeekChange,
    displayFourWeekChange: signed(report.score.fourWeekChange),
    nearestRegimeBoundary: report.score.nearestRegimeBoundary,
    sourceUrl: report.score.sourceUrl,
    note: EDUCATIONAL_SCORE_NOTE,
  };

  return deepFreeze({
    messageId: WEEKLY_NEWSLETTER_MESSAGE_ID,
    consentPurpose: WEEKLY_NEWSLETTER_CONSENT_PURPOSE,
    templateVersion: WEEKLY_NEWSLETTER_TEMPLATE_VERSION,
    classification: 'marketing',
    locale,
    weekEnding: report.periodEnd,
    subject: `USD Impact Weekly — ${score.displayValue} | ${score.regime}`,
    preheader: `Week ending ${report.periodEnd}: the validated USD Impact Score, verified highlights, and source links.`,
    title: report.title,
    score,
    highlights: report.themes.slice(0, 3),
    links,
    primaryCta: links[0],
    complianceNote: report.complianceNote,
    unsubscribeRequired: true,
    source: {
      weeklyReportPath: report.slug,
      scoreSourceUrl: report.score.sourceUrl,
      sourceEditionDates: report.sourceEditions.map((source) => source.date),
    },
  });
}
