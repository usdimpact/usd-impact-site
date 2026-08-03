import fs from 'node:fs';
import path from 'node:path';

const monthlyRoot = path.resolve(process.env.MONTHLY_REPORT_ROOT ?? 'src/content/monthly-reports');
const weeklyRoot = path.resolve(process.env.WEEKLY_REPORT_ROOT ?? 'src/content/weekly-reports');
const failures = [];
const consumedWeeklyReports = new Map();

function documentParts(file) {
  const source = fs.readFileSync(file, 'utf8');
  const parts = source.split(/^---\s*$/m);
  if (parts.length < 3) throw new Error('missing YAML frontmatter');
  return { frontmatter: parts[1], body: parts.slice(2).join('---') };
}

function scalar(source, key) {
  const match = source.match(new RegExp(`^\\s*-?\\s*${key}:\\s*["']?([^"'\\r\\n]+)["']?\\s*$`, 'm'));
  return match?.[1]?.trim();
}

function section(frontmatter, key) {
  const lines = frontmatter.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^${key}:\\s*$`).test(line));
  if (start === -1) return '';
  const endOffset = lines.slice(start + 1).findIndex((line) => /^[A-Za-z][A-Za-z0-9]*:\s*/.test(line));
  const end = endOffset === -1 ? lines.length : start + 1 + endOffset;
  return lines.slice(start + 1, end).join('\n');
}

function itemBlocks(block) {
  const starts = [...block.matchAll(/^  - /gm)].map((match) => match.index);
  return starts.map((start, index) => block.slice(start, starts[index + 1] ?? block.length));
}

function dateFrom(value, label) {
  const date = new Date(`${value}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.valueOf())) {
    throw new Error(`${label} is not a valid YYYY-MM-DD date`);
  }
  return date;
}

function latestCompletedFriday(generatedAt) {
  const value = new Date(generatedAt);
  if (Number.isNaN(value.valueOf())) throw new Error('generatedAt is not valid ISO-8601');
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 12));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() - 5 + 7) % 7));
  return date;
}

function weeklyReport(periodEnd) {
  const file = path.join(weeklyRoot, `${periodEnd}.md`);
  if (!fs.existsSync(file)) throw new Error(`source weekly report is missing: ${periodEnd}`);
  const { frontmatter } = documentParts(file);
  return {
    periodStart: scalar(frontmatter, 'periodStart'),
    periodEnd: scalar(frontmatter, 'periodEnd'),
    slug: scalar(frontmatter, 'slug'),
    status: scalar(frontmatter, 'status'),
    scoreValue: Number(scalar(frontmatter, 'value')),
    scoreRegime: scalar(frontmatter, 'regime'),
  };
}

function sameNumber(left, right) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 1e-12;
}

if (!fs.existsSync(monthlyRoot)) {
  failures.push(`monthly report directory is missing: ${monthlyRoot}`);
} else if (!fs.existsSync(weeklyRoot)) {
  failures.push(`weekly report directory is missing: ${weeklyRoot}`);
} else {
  for (const file of fs.readdirSync(monthlyRoot).filter((name) => name.endsWith('.md'))) {
    try {
      const { frontmatter, body } = documentParts(path.join(monthlyRoot, file));
      const periodStart = scalar(frontmatter, 'periodStart');
      const periodEnd = scalar(frontmatter, 'periodEnd');
      const generatedAt = scalar(frontmatter, 'generatedAt');
      const slug = scalar(frontmatter, 'slug');
      const status = scalar(frontmatter, 'status');
      const startDate = dateFrom(periodStart, 'periodStart');
      const endDate = dateFrom(periodEnd, 'periodEnd');

      if (file !== `${periodEnd}.md`) throw new Error(`filename must equal ${periodEnd}.md`);
      if (startDate > endDate) throw new Error('periodStart is after periodEnd');
      if (endDate.getUTCDay() !== 5) throw new Error('periodEnd must be a completed Friday');
      if (endDate > latestCompletedFriday(generatedAt)) throw new Error('periodEnd is later than the completed Friday represented by generatedAt');
      if (slug !== `/reports/monthly/${periodEnd}`) throw new Error(`slug must equal /reports/monthly/${periodEnd}`);
      if (status === 'published' && !body.includes('## Methodology note')) throw new Error('published report is missing its methodology note');

      const sourceItems = itemBlocks(section(frontmatter, 'sourceWeeklyReports')).map((item) => ({
        periodEnd: scalar(item, 'periodEnd'),
        url: scalar(item, 'url'),
      }));
      if (sourceItems.length !== 4) throw new Error('monthly report must contain exactly four source weekly reports');

      const sourceDates = sourceItems.map((source) => source.periodEnd);
      if (new Set(sourceDates).size !== sourceDates.length) throw new Error('source weekly report dates must be unique');

      const sourceDateObjects = sourceDates.map((date, index) => dateFrom(date, `sourceWeeklyReports[${index}].periodEnd`));
      for (let index = 0; index < sourceDateObjects.length; index += 1) {
        if (sourceDateObjects[index].getUTCDay() !== 5) throw new Error(`source weekly report ${sourceDates[index]} is not a Friday`);
        if (index > 0 && sourceDateObjects[index] - sourceDateObjects[index - 1] !== 7 * 24 * 60 * 60 * 1000) {
          throw new Error('source weekly reports must be four consecutive Fridays in chronological order');
        }
      }

      if (periodEnd !== sourceDates.at(-1)) throw new Error('periodEnd must equal the fourth source weekly report date');

      const weekly = sourceItems.map((source) => {
        if (source.url !== `/reports/weekly/${source.periodEnd}`) {
          throw new Error(`source weekly report ${source.periodEnd} URL does not match its date`);
        }
        const report = weeklyReport(source.periodEnd);
        if (report.status !== 'published') throw new Error(`source weekly report is not published: ${source.periodEnd}`);
        if (report.periodEnd !== source.periodEnd) throw new Error(`source weekly report frontmatter does not match: ${source.periodEnd}`);
        if (report.slug !== source.url) throw new Error(`source weekly report slug does not match: ${source.periodEnd}`);
        return report;
      });

      if (periodStart !== weekly[0].periodStart) throw new Error('periodStart must equal the first source weekly report periodStart');

      const scoreItems = itemBlocks(section(frontmatter, 'scorePath')).map((item) => ({
        periodEnd: scalar(item, 'periodEnd'),
        value: Number(scalar(item, 'value')),
        regime: scalar(item, 'regime'),
      }));
      if (scoreItems.length !== 4) throw new Error('scorePath must contain exactly four weekly score points');

      scoreItems.forEach((point, index) => {
        if (point.periodEnd !== sourceDates[index]) throw new Error('scorePath dates must match source weekly reports in chronological order');
        if (!sameNumber(point.value, weekly[index].scoreValue)) {
          throw new Error(`score path value does not match weekly report ${point.periodEnd}`);
        }
        if (point.regime !== weekly[index].scoreRegime) {
          throw new Error(`score path regime does not match weekly report ${point.periodEnd}`);
        }
      });

      const themeItems = itemBlocks(section(frontmatter, 'themes'));
      if (themeItems.length < 3 || themeItems.length > 6) throw new Error('monthly report must contain 3–6 themes');
      for (const theme of themeItems) {
        const references = [...theme.matchAll(/^\s+-\s*["']?(\d{4}-\d{2}-\d{2})["']?\s*$/gm)].map((match) => match[1]);
        if (references.length === 0) throw new Error('each monthly theme must reference at least one source weekly report');
        for (const reference of references) {
          if (!sourceDates.includes(reference)) throw new Error(`monthly theme references a non-source weekly report: ${reference}`);
        }
      }

      if (status === 'published') {
        for (const date of sourceDates) {
          const previous = consumedWeeklyReports.get(date);
          if (previous) throw new Error(`weekly report ${date} is already used by published monthly report ${previous}`);
          consumedWeeklyReports.set(date, periodEnd);
        }
      }
    } catch (error) {
      failures.push(`${file}: ${error.message}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Monthly report validation failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log('monthly report validation pass');
