import fs from 'node:fs';
import path from 'node:path';
import { load, FAILSAFE_SCHEMA } from 'js-yaml';

export const SAFE_SCORE_SCHEMA_VERSION = 'score-public-v2-safe-1';
export const SAFE_WEEKLY_SCHEMA_VERSION = 'weekly-report-public-safe-v1';
export const SAFE_MONTHLY_INPUT_SCHEMA_VERSION = 'monthly-report-public-safe-input-v1';

const COMPLIANCE =
  'Educational and informational only. This report candidate summarizes published USD Impact editions and the aggregate USD Impact Score. It is not investment, financial, trading, legal, or tax advice and is not a recommendation to buy or sell any asset.';

const FORBIDDEN_SCORE_KEYS = new Set([
  'drivers',
  'source_provenance',
  'sourceProvenance',
  'provider',
  'provider_code',
  'providerCode',
  'series',
  'source_url',
  'sourceUrl',
  'weekly_level',
  'weeklyLevel',
  'z',
  'z_unclipped',
  'z_clipped',
  'contribution',
  'contributions',
  'normalization',
  'mean',
  'sample_std_ddof_1',
  'nearest_regime_boundary',
  'nearestRegimeBoundary',
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, field) {
  if (!isObject(value)) throw new Error(`${field} must be an object`);
  return value;
}

function requireString(value, field) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function requireFinite(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be finite`);
  }
  return value;
}

function requireDate(value, field) {
  const normalized = requireString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`${field} must use YYYY-MM-DD`);
  }
  const date = new Date(`${normalized}T12:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`${field} is not a valid calendar date`);
  }
  return normalized;
}

function friday(value, field) {
  const normalized = requireDate(value, field);
  if (new Date(`${normalized}T12:00:00Z`).getUTCDay() !== 5) {
    throw new Error(`${field} must be a Friday`);
  }
  return normalized;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function mondayFor(fridayValue) {
  const date = new Date(`${fridayValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 4);
  return isoDate(date);
}

function weekdays(start) {
  const date = new Date(`${start}T12:00:00Z`);
  return Array.from({ length: 5 }, (_, index) => {
    const value = new Date(date);
    value.setUTCDate(value.getUTCDate() + index);
    return isoDate(value);
  });
}

function frontmatter(source) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!match) throw new Error('missing YAML frontmatter');
  const data = load(match[1], { schema: FAILSAFE_SCHEMA });
  if (!isObject(data)) throw new Error('YAML frontmatter must be a mapping');
  return data;
}

function scalar(data, key) {
  return typeof data[key] === 'string' ? data[key].trim() : undefined;
}

function walkForbiddenKeys(value, location = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForbiddenKeys(item, `${location}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_SCORE_KEYS.has(key)) {
      throw new Error(`forbidden Score field at ${location}.${key}`);
    }
    walkForbiddenKeys(child, `${location}.${key}`);
  }
}

export function validatePublicSafeScore(input) {
  const score = requireObject(input, 'score');
  walkForbiddenKeys(score);

  if (score.schema_version !== SAFE_SCORE_SCHEMA_VERSION) {
    throw new Error(`score.schema_version must be ${SAFE_SCORE_SCHEMA_VERSION}`);
  }

  const latest = requireObject(score.latest, 'score.latest');
  const weekEnding = friday(latest.week_ending, 'score.latest.week_ending');
  const aggregateHistorySha256 = requireString(
    requireObject(score.release_evidence, 'score.release_evidence').aggregate_history_sha256,
    'score.release_evidence.aggregate_history_sha256',
  );
  if (!/^[0-9a-f]{64}$/.test(aggregateHistorySha256)) {
    throw new Error('score.release_evidence.aggregate_history_sha256 must be SHA-256 hex');
  }

  if (!Array.isArray(score.history) || score.history.length === 0) {
    throw new Error('score.history must be a non-empty array');
  }
  const finalHistory = requireObject(score.history.at(-1), 'score.history[last]');
  if (
    finalHistory.date !== weekEnding
    || finalHistory.score !== latest.score
    || finalHistory.regime !== latest.regime
  ) {
    throw new Error('score.latest must agree with final aggregate history row');
  }

  return Object.freeze({
    schemaVersion: SAFE_SCORE_SCHEMA_VERSION,
    weekEnding,
    score: requireFinite(latest.score, 'score.latest.score'),
    regime: requireString(latest.regime, 'score.latest.regime'),
    weekOverWeekChange: requireFinite(
      latest.week_over_week_change,
      'score.latest.week_over_week_change',
    ),
    fourWeekChange: requireFinite(latest.four_week_change, 'score.latest.four_week_change'),
    aggregateHistorySha256,
  });
}

function loadDailyEditions(newsRoot, dates) {
  return dates.map((date) => {
    const file = path.join(newsRoot, `${date}.md`);
    if (!fs.existsSync(file)) throw new Error(`missing Daily edition ${date}`);
    const data = frontmatter(fs.readFileSync(file, 'utf8'));
    if (scalar(data, 'status') !== 'published') throw new Error(`Daily edition ${date} is not published`);
    if (scalar(data, 'date') !== date) throw new Error(`Daily edition ${date} has a mismatched date`);
    const summary = scalar(data, 'summary');
    const title = scalar(data, 'title');
    if (!summary || !title) throw new Error(`Daily edition ${date} is missing title or summary`);

    const catalysts = data.catalysts ?? [];
    if (!Array.isArray(catalysts)) throw new Error(`Daily edition ${date} catalysts must be an array`);
    const normalizedCatalysts = catalysts.map((candidate) => {
      if (!isObject(candidate)) throw new Error(`Daily edition ${date} has an invalid catalyst`);
      return {
        date: requireDate(candidate.date, `Daily ${date} catalyst.date`),
        event: requireString(candidate.event, `Daily ${date} catalyst.event`),
        sourceEditionDate: date,
      };
    });

    return Object.freeze({
      date,
      title,
      summary,
      url: `/news/${date}`,
      catalysts: normalizedCatalysts,
    });
  });
}

function uniqueFutureCatalysts(editions, week) {
  const seen = new Set();
  const values = [];
  for (const edition of editions) {
    for (const item of edition.catalysts) {
      if (item.date <= week) continue;
      const key = `${item.date}\u0000${item.event}`;
      if (seen.has(key)) continue;
      seen.add(key);
      values.push(item);
    }
  }
  return values.sort((left, right) => left.date.localeCompare(right.date)).slice(0, 4);
}

export function buildPublicSafeWeeklyReport({
  week,
  score,
  newsRoot,
  generatedAt = new Date().toISOString(),
} = {}) {
  const normalizedWeek = friday(week, 'week');
  const safeScore = validatePublicSafeScore(score);
  if (safeScore.weekEnding !== normalizedWeek) {
    throw new Error('public-safe Score week does not match requested report week');
  }

  const periodStart = mondayFor(normalizedWeek);
  const editions = loadDailyEditions(newsRoot, weekdays(periodStart));
  const groups = [editions.slice(0, 2), editions.slice(2, 4), editions.slice(4)];
  const themes = groups.map((entries, index) => Object.freeze({
    title: [
      'Opening-week verified evidence',
      'Midweek verified evidence',
      'Completed-Friday evidence and forward calendar',
    ][index],
    summary: entries.map((entry) => entry.summary).join(' '),
    editionDates: entries.map((entry) => entry.date),
  }));

  const report = {
    schemaVersion: SAFE_WEEKLY_SCHEMA_VERSION,
    periodStart,
    periodEnd: normalizedWeek,
    generatedAt: requireString(generatedAt, 'generatedAt'),
    title: `Weekly USD Impact Brief — ${normalizedWeek}`,
    summary: `${editions.map((entry) => entry.summary).join(' ')} The completed-Friday aggregate USD Impact Score was ${safeScore.score.toFixed(2)}, in ${safeScore.regime}.`,
    score: {
      value: safeScore.score,
      regime: safeScore.regime,
      weekOverWeekChange: safeScore.weekOverWeekChange,
      fourWeekChange: safeScore.fourWeekChange,
      aggregateHistorySha256: safeScore.aggregateHistorySha256,
    },
    themes,
    sourceEditions: editions.map(({ date, title, url }) => ({ date, title, url })),
    catalysts: uniqueFutureCatalysts(editions, normalizedWeek),
    complianceNote: COMPLIANCE,
    methodologyNote:
      'This candidate uses five checked-in published Daily editions plus the aggregate-only Score contract. It publishes no Score component levels, component z-scores, component contributions, provider provenance, normalization moments, or component-derived source URL.',
    rightsSafety: {
      scoreSchemaVersion: SAFE_SCORE_SCHEMA_VERSION,
      componentValuesPublished: false,
      componentZScoresPublished: false,
      componentContributionsPublished: false,
      providerProvenancePublished: false,
      componentSourceUrlPublished: false,
    },
  };

  assertPublicSafeWeeklyReport(report);
  return Object.freeze(report);
}

export function assertPublicSafeWeeklyReport(report) {
  requireObject(report, 'weekly report');
  if (report.schemaVersion !== SAFE_WEEKLY_SCHEMA_VERSION) {
    throw new Error('unexpected weekly report schema');
  }
  friday(report.periodEnd, 'weekly report periodEnd');
  requireDate(report.periodStart, 'weekly report periodStart');

  const score = requireObject(report.score, 'weekly report score');
  const allowedScoreKeys = new Set([
    'value',
    'regime',
    'weekOverWeekChange',
    'fourWeekChange',
    'aggregateHistorySha256',
  ]);
  for (const key of Object.keys(score)) {
    if (!allowedScoreKeys.has(key)) throw new Error(`weekly report score has unexpected field ${key}`);
  }

  requireFinite(score.value, 'weekly report score.value');
  requireString(score.regime, 'weekly report score.regime');
  requireFinite(score.weekOverWeekChange, 'weekly report score.weekOverWeekChange');
  requireFinite(score.fourWeekChange, 'weekly report score.fourWeekChange');
  if (!/^[0-9a-f]{64}$/.test(requireString(score.aggregateHistorySha256, 'weekly report aggregate hash'))) {
    throw new Error('weekly report aggregate hash must be SHA-256 hex');
  }

  const rights = requireObject(report.rightsSafety, 'weekly report rightsSafety');
  for (const key of [
    'componentValuesPublished',
    'componentZScoresPublished',
    'componentContributionsPublished',
    'providerProvenancePublished',
    'componentSourceUrlPublished',
  ]) {
    if (rights[key] !== false) throw new Error(`weekly report ${key} must remain false`);
  }

  const forbiddenSerializedKeys = [
    '"drivers"',
    '"source_provenance"',
    '"sourceProvenance"',
    '"weekly_level"',
    '"weeklyLevel"',
    '"z_clipped"',
    '"contribution"',
    '"contributions"',
    '"nearestRegimeBoundary"',
    '"sourceUrl"',
  ];
  const serialized = JSON.stringify(report);
  for (const token of forbiddenSerializedKeys) {
    if (serialized.includes(token)) throw new Error(`weekly report contains forbidden token ${token}`);
  }
  if (/weekly_input\.json|score_repro_bundle|finance\.yahoo|Yahoo Finance|DX-Y\.NYB|CL=F|\^GSPC|\^VIX|GC=F|BTC-USD/.test(serialized)) {
    throw new Error('weekly report contains provider/component evidence marker');
  }

  return true;
}

function consecutiveFriday(left, right) {
  return new Date(`${right}T12:00:00Z`) - new Date(`${left}T12:00:00Z`)
    === 7 * 24 * 60 * 60 * 1000;
}

export function buildPublicSafeMonthlyInput({ weeklyReports, generatedAt = new Date().toISOString() } = {}) {
  if (!Array.isArray(weeklyReports) || weeklyReports.length !== 4) {
    throw new Error('monthly input requires exactly four weekly reports');
  }

  const normalized = weeklyReports.map((report, index) => {
    assertPublicSafeWeeklyReport(report);
    return {
      index,
      periodStart: requireDate(report.periodStart, `weeklyReports[${index}].periodStart`),
      periodEnd: friday(report.periodEnd, `weeklyReports[${index}].periodEnd`),
      score: report.score,
      title: requireString(report.title, `weeklyReports[${index}].title`),
      themes: report.themes,
    };
  }).sort((left, right) => left.periodEnd.localeCompare(right.periodEnd));

  for (let index = 1; index < normalized.length; index += 1) {
    if (!consecutiveFriday(normalized[index - 1].periodEnd, normalized[index].periodEnd)) {
      throw new Error('monthly input weekly reports must be four consecutive Fridays');
    }
  }

  const monthly = {
    schemaVersion: SAFE_MONTHLY_INPUT_SCHEMA_VERSION,
    generatedAt: requireString(generatedAt, 'generatedAt'),
    periodStart: normalized[0].periodStart,
    periodEnd: normalized.at(-1).periodEnd,
    scorePath: normalized.map((entry) => ({
      periodEnd: entry.periodEnd,
      value: entry.score.value,
      regime: entry.score.regime,
      aggregateHistorySha256: entry.score.aggregateHistorySha256,
    })),
    sourceWeeklyReports: normalized.map((entry) => ({
      periodEnd: entry.periodEnd,
      title: entry.title,
      contractSchemaVersion: SAFE_WEEKLY_SCHEMA_VERSION,
    })),
    themeEvidence: normalized.flatMap((entry) => entry.themes.map((theme) => ({
      weeklyReportPeriodEnd: entry.periodEnd,
      title: theme.title,
      summary: theme.summary,
      editionDates: [...theme.editionDates],
    }))),
    editorialRule:
      'This is a source-bounded monthly input artifact, not publishable prose. Any Monthly Report synthesis must cite only these aggregate-safe weekly inputs and must not reintroduce component-derived Score values.',
    rightsSafety: {
      componentValuesPublished: false,
      componentZScoresPublished: false,
      componentContributionsPublished: false,
      providerProvenancePublished: false,
      componentSourceUrlPublished: false,
    },
  };

  assertPublicSafeMonthlyInput(monthly);
  return Object.freeze(monthly);
}

export function assertPublicSafeMonthlyInput(monthly) {
  requireObject(monthly, 'monthly input');
  if (monthly.schemaVersion !== SAFE_MONTHLY_INPUT_SCHEMA_VERSION) {
    throw new Error('unexpected monthly input schema');
  }
  if (!Array.isArray(monthly.scorePath) || monthly.scorePath.length !== 4) {
    throw new Error('monthly scorePath must have four points');
  }
  if (!Array.isArray(monthly.sourceWeeklyReports) || monthly.sourceWeeklyReports.length !== 4) {
    throw new Error('monthly sourceWeeklyReports must have four items');
  }

  const serialized = JSON.stringify(monthly);
  for (const token of [
    '"drivers"',
    '"source_provenance"',
    '"sourceProvenance"',
    '"weekly_level"',
    '"z_clipped"',
    '"contribution"',
    '"contributions"',
    '"nearestRegimeBoundary"',
    '"sourceUrl"',
  ]) {
    if (serialized.includes(token)) throw new Error(`monthly input contains forbidden token ${token}`);
  }
  if (/weekly_input\.json|score_repro_bundle|finance\.yahoo|Yahoo Finance|DX-Y\.NYB|CL=F|\^GSPC|\^VIX|GC=F|BTC-USD/.test(serialized)) {
    throw new Error('monthly input contains provider/component evidence marker');
  }
  return true;
}
