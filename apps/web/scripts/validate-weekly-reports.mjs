import fs from 'node:fs';
import path from 'node:path';

const reportRoot = path.resolve('src/content/weekly-reports');
const newsRoot = path.resolve('src/content/news');
const failures = [];

function scalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^\\s*${key}:\\s*["']?([^"'\\r\\n]+)["']?\\s*$`, 'm'));
  return match?.[1]?.trim();
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

for (const file of fs.readdirSync(reportRoot).filter((name) => name.endsWith('.md'))) {
  const reportPath = path.join(reportRoot, file);
  const source = fs.readFileSync(reportPath, 'utf8');
  const parts = source.split(/^---\s*$/m);
  if (parts.length < 3) {
    failures.push(`${file}: missing YAML frontmatter`);
    continue;
  }

  const frontmatter = parts[1];
  const body = parts.slice(2).join('---');

  try {
    const periodStart = scalar(frontmatter, 'periodStart');
    const periodEnd = scalar(frontmatter, 'periodEnd');
    const generatedAt = scalar(frontmatter, 'generatedAt');
    const slug = scalar(frontmatter, 'slug');
    const status = scalar(frontmatter, 'status');
    const startDate = dateFrom(periodStart, 'periodStart');
    const endDate = dateFrom(periodEnd, 'periodEnd');

    if (startDate > endDate) throw new Error('periodStart is after periodEnd');
    if (endDate.getUTCDay() !== 5) throw new Error('periodEnd must be a completed Friday');
    if (endDate > latestCompletedFriday(generatedAt)) throw new Error('periodEnd is later than the completed Friday represented by generatedAt');
    if (slug !== `/reports/weekly/${periodEnd}`) throw new Error(`slug must equal /reports/weekly/${periodEnd}`);
    if (status === 'published' && !body.includes('## Methodology note')) throw new Error('published report is missing its methodology note');

    const scoreSource = scalar(frontmatter, 'sourceUrl');
    const expectedScoreSuffix = `/archive/${periodEnd}/weekly_input.json`;
    if (!scoreSource?.endsWith(expectedScoreSuffix)) throw new Error(`score sourceUrl must end with ${expectedScoreSuffix}`);

    const sourceBlock = frontmatter.match(/^sourceEditions:\s*$([\s\S]*?)^catalysts:\s*$/m)?.[1] ?? '';
    const editionDates = [...sourceBlock.matchAll(/^\s+- date:\s*["']?(\d{4}-\d{2}-\d{2})["']?\s*$/gm)].map((match) => match[1]);
    const editionUrls = [...sourceBlock.matchAll(/^\s+url:\s*["']?(\/news\/(\d{4}-\d{2}-\d{2}))["']?\s*$/gm)];
    if (editionDates.length === 0 || editionDates.length !== editionUrls.length) throw new Error('source editions must contain matching dates and internal news URLs');
    if (new Set(editionDates).size !== editionDates.length) throw new Error('source edition dates must be unique');

    for (const [index, editionDate] of editionDates.entries()) {
      if (editionDate < periodStart || editionDate > periodEnd) throw new Error(`source edition ${editionDate} falls outside the reporting period`);
      if (editionUrls[index][2] !== editionDate) throw new Error(`source edition ${editionDate} URL does not match its date`);
      const newsPath = path.join(newsRoot, `${editionDate}.md`);
      if (!fs.existsSync(newsPath)) throw new Error(`source edition is missing: ${editionDate}`);
      const news = fs.readFileSync(newsPath, 'utf8');
      if (!/^status:\s*["']?published["']?\s*$/m.test(news)) throw new Error(`source edition is not published: ${editionDate}`);
    }

    const themeBlock = frontmatter.match(/^themes:\s*$([\s\S]*?)^sourceEditions:\s*$/m)?.[1] ?? '';
    const themeCount = [...themeBlock.matchAll(/^\s+- title:/gm)].length;
    if (themeCount < 3 || themeCount > 5) throw new Error('weekly report must contain 3–5 themes');
  } catch (error) {
    failures.push(`${file}: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error(`Weekly report validation failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log('weekly report validation pass');
