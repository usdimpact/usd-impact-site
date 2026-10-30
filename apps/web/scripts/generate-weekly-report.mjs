import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, FAILSAFE_SCHEMA } from 'js-yaml';
import { readGate } from './score-derived-publication-rights-gate.mjs';

const COMPLIANCE = 'Educational and informational only. This report summarizes published USD Impact editions and the systematic weekly score. It is not investment, financial, trading, legal, or tax advice and is not a recommendation to buy or sell any asset.';
const SCORE_BREADTH_WATCH = "Watch the breadth of the score's eight component contributions alongside these events to see whether the completed-week configuration persists, narrows, or moves toward the nearest regime boundary.";
const SCORE_BREADTH_WATCH_NO_EVENTS = "Watch the breadth of the score's eight component contributions alongside newly published evidence to see whether the completed-week configuration persists, narrows, or moves toward the nearest regime boundary.";

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function mondayFor(friday) {
  const date = new Date(`${friday}T12:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.getUTCDay() !== 5) throw new Error('week must be a valid Friday');
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
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('YAML frontmatter must be a mapping');
  return data;
}

function scalar(data, key) {
  return typeof data[key] === 'string' ? data[key].trim() : undefined;
}

function yamlQuote(value) {
  return JSON.stringify(String(value).replace(/\u2028|\u2029/g, ' '));
}

function signed(value, digits = 2) {
  const rounded = Number(value).toFixed(digits);
  return Number(value) >= 0 ? `+${rounded}` : rounded.replace('-', '−');
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })
    .format(new Date(`${value}T12:00:00Z`));
}

function validateScore(score, week) {
  if (score.week_ending !== week) throw new Error(`score archive week ${score.week_ending ?? 'missing'} does not match ${week}`);
  if (!Array.isArray(score.drivers) || score.drivers.length !== 8) throw new Error('score archive must contain exactly eight drivers');
  const provenance = Object.values(score.source_provenance ?? {});
  if (provenance.length !== 8 || provenance.some((entry) => entry.status !== 'fresh')) {
    throw new Error('all eight score inputs must be present and fresh');
  }
  for (const key of ['score', 'week_over_week_change', 'four_week_change', 'nearest_regime_boundary']) {
    if (!Number.isFinite(score[key])) throw new Error(`score archive ${key} must be finite`);
  }
  if (typeof score.regime !== 'string' || !score.regime) throw new Error('score archive regime is required');
}

function loadEditions(newsRoot, dates) {
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
    return { date, summary, title, catalysts };
  });
}

export function generateWeeklyReport({ week, score, newsRoot, generatedAt = new Date().toISOString() }) {
  validateScore(score, week);
  const periodStart = mondayFor(week);
  const editions = loadEditions(newsRoot, weekdays(periodStart));
  const groups = [editions.slice(0, 2), editions.slice(2, 4), editions.slice(4)];
  const drivers = [...score.drivers].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const softer = drivers.filter((driver) => driver.contribution < 0).map((driver) => driver.name);
  const firmer = drivers.filter((driver) => driver.contribution > 0).map((driver) => driver.name);
  const latestCatalysts = [];
  for (const edition of editions) {
    for (const catalyst of edition.catalysts) {
      const date = catalyst && scalar(catalyst, 'date');
      const event = catalyst && scalar(catalyst, 'event');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !event) throw new Error(`Daily edition ${edition.date} has an invalid catalyst`);
      if (date > week && !latestCatalysts.some((item) => item.date === date && item.event === event)) {
        latestCatalysts.push({ date, event, sourceEditionDate: edition.date });
      }
    }
  }
  latestCatalysts.sort((a, b) => a.date.localeCompare(b.date));
  const catalysts = latestCatalysts.slice(0, 4);
  const titleDate = formatDate(week);
  const summary = `${editions.map((entry) => entry.summary).join(' ')} The completed-Friday USD Impact Score was ${signed(score.score)}, remaining in a ${score.regime.toLowerCase()}.`;
  const themes = groups.map((entries, index) => ({
    title: ['Opening-week verified evidence', 'Midweek verified evidence', 'Completed-Friday evidence and forward calendar'][index],
    summary: entries.map((entry) => entry.summary).join(' '),
    editionDates: entries.map((entry) => entry.date),
  }));
  const sourceUrl = `https://score.usd-impact.com/archive/${week}/weekly_input.json`;
  const top = drivers.slice(0, 3).map((driver) => `${driver.name} ${signed(driver.contribution, 3)}`).join(', ');
  const softerNames = softer.length > 0 ? softer.join(', ') : 'no inputs';
  const firmerNames = firmer.length > 0 ? firmer.join(', ') : 'no inputs';

  const lines = [
    '---',
    `title: ${yamlQuote(`Weekly USD Impact Brief — ${titleDate}`)}`,
    `metaTitle: ${yamlQuote(`Weekly USD Impact Brief — ${titleDate} | USD Impact`)}`,
    `metaDescription: ${yamlQuote(`Verified Daily evidence and the completed-Friday USD Impact Score for the week ending ${titleDate}.`)}`,
    `slug: ${yamlQuote(`/reports/weekly/${week}`)}`,
    `periodStart: ${yamlQuote(periodStart)}`,
    `periodEnd: ${yamlQuote(week)}`,
    `generatedAt: ${yamlQuote(generatedAt)}`,
    `lastReviewed: ${yamlQuote(isoDate(new Date(generatedAt)))}`,
    'status: "published"',
    'category: "Weekly USD Impact Brief"',
    `summary: ${yamlQuote(summary)}`,
    'score:',
    `  value: ${score.score}`,
    `  regime: ${yamlQuote(score.regime)}`,
    `  weekOverWeekChange: ${score.week_over_week_change}`,
    `  fourWeekChange: ${score.four_week_change}`,
    `  nearestRegimeBoundary: ${score.nearest_regime_boundary}`,
    `  sourceUrl: ${yamlQuote(sourceUrl)}`,
    'themes:',
    ...themes.flatMap((theme) => [
      `  - title: ${yamlQuote(theme.title)}`,
      `    summary: ${yamlQuote(theme.summary)}`,
      '    editionDates:',
      ...theme.editionDates.map((date) => `      - ${yamlQuote(date)}`),
    ]),
    'sourceEditions:',
    ...editions.flatMap((edition) => [
      `  - date: ${yamlQuote(edition.date)}`,
      `    title: ${yamlQuote(edition.title)}`,
      `    url: ${yamlQuote(`/news/${edition.date}`)}`,
    ]),
    catalysts.length > 0 ? 'catalysts:' : 'catalysts: []',
    ...catalysts.flatMap((item) => [
      `  - date: ${yamlQuote(item.date)}`,
      `    event: ${yamlQuote(item.event)}`,
      `    sourceEditionDate: ${yamlQuote(item.sourceEditionDate)}`,
    ]),
    `complianceNote: ${yamlQuote(COMPLIANCE)}`,
    '---',
    '',
    '## Executive read-through',
    '',
    editions.map((entry) => entry.summary).join(' '),
    '',
    '## How the news and score fit together',
    '',
    `The completed-Friday score was ${signed(score.score)}, a weekly change of ${signed(score.week_over_week_change)} and a four-week change of ${signed(score.four_week_change)}. The regime remained ${score.regime}. The news brief tracks verified developments and conditional transmission channels; the score measures the completed week's configuration across eight standardized market inputs.`,
    '',
    `The three largest absolute component contributions were ${top}. The softer-dollar contributions came from ${softerNames}, while ${firmerNames} provided firmer-dollar offsets. The nearest regime boundary was ${score.nearest_regime_boundary.toFixed(2)}.`,
    '',
    '## What to watch next',
    '',
    catalysts.length > 0
      ? `The confirmed forward calendar carried by the published Daily editions includes ${catalysts.map((item) => `${item.event} on ${item.date}`).join('; ')}. These are scheduled observation points, not forecasts or trading signals. ${SCORE_BREADTH_WATCH}`
      : `No forward catalyst after the completed Friday was carried consistently in the five published Daily editions. The next report should remain anchored to newly published, source-led evidence. ${SCORE_BREADTH_WATCH_NO_EVENTS}`,
    '',
    '## Methodology note',
    '',
    `This brief adds no new external event claims. It deterministically summarizes the five published Daily USD Impact editions for ${periodStart}–${week} and the immutable USD Impact Score archive for the completed Friday. Daily summaries are reused as checked in; the Score values, contributions, provenance, and freshness gate come only from ${sourceUrl}.`,
    '',
  ];
  return lines.join('\n');
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) result[argv[index]?.replace(/^--/, '')] = argv[index + 1];
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  // The exported pure generator stays available to synthetic offline tests.
  // Real Score-derived CLI output must respect the canonical site HOLD first.
  const rights = readGate();
  if (rights.hold !== false) {
    throw new Error('Weekly Score-derived report CLI is on rights HOLD (pipeline Issue #155); no score input or output was touched.');
  }
  const args = parseArgs(process.argv.slice(2));
  if (!args.week || !args.score || !args.output) throw new Error('usage: --week YYYY-MM-DD --score FILE --output FILE [--news-root DIR]');
  const newsRoot = path.resolve(args['news-root'] ?? 'src/content/news');
  const score = JSON.parse(fs.readFileSync(path.resolve(args.score), 'utf8'));
  const output = path.resolve(args.output);
  const report = generateWeeklyReport({ week: args.week, score, newsRoot });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  let handle;
  try {
    handle = fs.openSync(output, 'wx', 0o600);
    fs.writeFileSync(handle, report, 'utf8');
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`refusing to overwrite existing report ${output}`, { cause: error });
    }
    throw error;
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
  }
  console.log(`generated ${output}`);
}
