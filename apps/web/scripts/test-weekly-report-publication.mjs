import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateWeeklyReport } from './generate-weekly-report.mjs';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-report-'));
const newsRoot = path.join(root, 'news');
fs.mkdirSync(newsRoot);
const dates = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28'];
for (const date of dates) {
  fs.writeFileSync(path.join(newsRoot, `${date}.md`), `---\ntitle: "Daily USD Impact — ${date}"\ndate: "${date}"\nstatus: "published"\nsummary: "Verified summary for ${date}."\ncatalysts:\n  - date: "2026-09-04"\n    event: "Confirmed event"\nsources:\n  - id: "source"\n---\n`, 'utf8');
}
const score = {
  week_ending: '2026-08-28', score: -0.69, regime: 'Soft dollar regime',
  week_over_week_change: 0.02, four_week_change: -0.20, nearest_regime_boundary: -1,
  drivers: ['GOLD', 'SPX', 'BTC', 'WTI', 'VIX', 'UST_10Y', 'UST_2Y', 'DXY'].map((name, index) => ({ name, contribution: (index - 4) / 10 })),
  source_provenance: Object.fromEntries(['GOLD', 'SPX', 'BTC', 'WTI', 'VIX', 'UST_10Y', 'UST_2Y', 'DXY'].map((name) => [name, { status: 'fresh' }])),
};

try {
  const workflow = fs.readFileSync(path.resolve(scriptRoot, '../../../.github/workflows/weekly-report.yml'), 'utf8');
  assert.match(workflow, /cron: '17 8 \* \* 0'/);
  assert.match(workflow, /weekly-usd-impact-report/);
  assert.match(workflow, /status --porcelain --untracked-files=all/);
  assert.match(workflow, /all\(\. == "fresh"\)/);
  assert.match(workflow, /gh pr create --draft/);
  assert.match(workflow, /gh workflow run quality\.yml --ref/);
  assert.doesNotMatch(workflow, /gh pr merge|enable-auto-merge|--auto/);

  const report = generateWeeklyReport({ week: '2026-08-28', score, newsRoot, generatedAt: '2026-08-29T12:00:00Z' });
  assert.match(report, /status: "published"/);
  assert.match(report, /periodStart: "2026-08-24"/);
  assert.match(report, /periodEnd: "2026-08-28"/);
  assert.match(report, /archive\/2026-08-28\/weekly_input\.json/);
  assert.equal((report.match(/^  - title:/gm) ?? []).length, 3);
  assert.equal((report.match(/^  - date: "2026-08-2[4-8]"$/gm) ?? []).length, 5);
  assert.match(report, /adds no new external event claims/);
  assert.throws(() => generateWeeklyReport({ week: '2026-08-28', score: { ...score, week_ending: '2026-08-21' }, newsRoot }), /does not match/);
  const stale = structuredClone(score);
  stale.source_provenance.GOLD.status = 'stale';
  assert.throws(() => generateWeeklyReport({ week: '2026-08-28', score: stale, newsRoot }), /must be present and fresh/);
  fs.unlinkSync(path.join(newsRoot, '2026-08-27.md'));
  assert.throws(() => generateWeeklyReport({ week: '2026-08-28', score, newsRoot }), /missing Daily edition/);
  console.log('weekly report publication generator tests pass');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
