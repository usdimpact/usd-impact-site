// One-shot, read-only operator check. No network requests, writes, dispatches or merges.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { load, FAILSAFE_SCHEMA } from 'js-yaml';
import { assessDailyMajorReleaseCoverage } from '../src/lib/daily-major-release-readiness.js';

async function main(args) {
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!['--date', '--calendar', '--at'].includes(flag) || !args[i + 1] || values[flag]) {
      throw new Error('Usage: node scripts/check-daily-major-release-coverage.mjs --date YYYY-MM-DD --calendar path/to/reviewed.json [--at UTC-ISO-time]');
    }
    values[flag] = args[i + 1];
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values['--date'] ?? '') || !values['--calendar']) {
    throw new Error('A dated edition and reviewed calendar JSON are required');
  }
  const date = values['--date'];
  const contentPath = path.resolve('src/content/news', `${date}.md`);
  const calendarPath = path.resolve(values['--calendar']);
  const [raw, calendarRaw] = await Promise.all([readFile(contentPath, 'utf8'), readFile(calendarPath, 'utf8')]);
  if (raw.length > 200_000 || calendarRaw.length > 64_000) throw new Error('Evidence input exceeds the bounded read limit');
  const parts = raw.split(/^---\s*$/m);
  if (parts.length < 3) throw new Error('Edition is missing frontmatter');
  const edition = load(parts[1], { schema: FAILSAFE_SCHEMA });
  if (edition?.date !== date) throw new Error('Edition content date does not match requested date');
  const calendar = JSON.parse(calendarRaw);
  const asOfUtc = values['--at'] ?? new Date().toISOString();
  const receipt = assessDailyMajorReleaseCoverage({ edition, calendar, asOfUtc });
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  // A syntactically valid check never grants release. HOLD is nonzero for operator safety.
  if (receipt.decision !== 'READY_FOR_HUMAN_EDITORIAL_REVIEW') process.exitCode = 1;
}
main(process.argv.slice(2)).catch((error) => {
  console.error(`Daily major-release review unavailable: ${error.message}`);
  process.exitCode = 2;
});
