import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COMPLIANCE = 'Educational and informational only. This report summarizes published USD Impact editions and the systematic weekly score. It is not investment, financial, trading, legal, or tax advice and is not a recommendation to buy or sell any asset.';

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
  return match[1];
}

function scalar(block, key) {
  const match = block.match(new RegExp(`^${key}:\\s*["']([^"']*)["']\\s*$`, 'm'))
    ?? block.match(new RegExp(`^${key}:\\s*([^\\r\\n]+)\\s*$`, 'm'));
  return match?.[1]?.trim();
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
    return { date, summary, title };
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
    const source = fs.readFileSync(path.join(newsRoot, `${edition.date}.md`), 'utf8');
    const block = frontmatter(source).match(/^catalysts:\s*$([\s\S]*?)^sources:\s*$/m)?.[1] ?? '';
    const records = [...block.matchAll(/^\s+- date:\s*["']?(\d{4}-\d{2}-\d{2})["']?\s*$[\s\S]*?^\s+event:\s*["']?([^\r\n"']+)["']?\s*$/gm)];
    for (const match of records) {
      if (match[1] > week && !latestCatalysts.some((item) => item.date === match[1] && item.event === match[2])) {
        latestCatalysts.push({ date: match[1], event: match[2].trim(), sourceEditionDate: edition.date });
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
    'catalysts:',
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
    `The completed-Friday score was ${signed(score.score)}, a weekly change of ${signed(score.week_over_week_change)} and a four-week change of ${signed(score.four_week_change)}. The regime remained ${score.regime}. The three largest absolute component contributions were ${top}. Across all eight inputs, ${softer.join(', ')} contributed toward a softer-dollar reading, while ${firmer.join(', ')} contributed toward a firmer-dollar reading. The nearest regime boundary was ${score.nearest_regime_boundary.toFixed(2)}.`,
    '',
    '## What to watch next',
    '',
    catalysts.length > 0
      ? `The confirmed forward calendar carried by the published Daily editions includes ${catalysts.map((item) => `${item.event} on ${item.date}`).join('; ')}. These are scheduled observation points, not forecasts or trading signals.`
      : 'No forward catalyst after the completed Friday was carried consistently in the five published Daily editions. The next report should remain anchored to newly published, source-led evidence.',
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
  const args = parseArgs(process.argv.slice(2));
  if (!args.week || !args.score || !args.output) throw new Error('usage: --week YYYY-MM-DD --score FILE --output FILE [--news-root DIR]');
  const newsRoot = path.resolve(args['news-root'] ?? 'src/content/news');
  const score = JSON.parse(fs.readFileSync(path.resolve(args.score), 'utf8'));
  const output = path.resolve(args.output);
  if (fs.existsSync(output)) throw new Error(`refusing to overwrite existing report ${output}`);
  const report = generateWeeklyReport({ week: args.week, score, newsRoot });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, report, 'utf8');
  console.log(`generated ${output}`);
}
