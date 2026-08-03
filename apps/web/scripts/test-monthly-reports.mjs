import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('./validate-monthly-reports.mjs', import.meta.url));
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'usd-impact-monthly-report-'));
const weeklyRoot = path.join(temporaryRoot, 'weekly');
const monthlyRoot = path.join(temporaryRoot, 'monthly');

const weeks = [
  { periodStart: '2026-07-06', periodEnd: '2026-07-10', value: -0.1, regime: 'Balanced regime' },
  { periodStart: '2026-07-13', periodEnd: '2026-07-17', value: -0.2, regime: 'Balanced regime' },
  { periodStart: '2026-07-20', periodEnd: '2026-07-24', value: -0.4, regime: 'Soft dollar regime' },
  { periodStart: '2026-07-27', periodEnd: '2026-07-31', value: -0.5, regime: 'Soft dollar regime' },
];

function weeklyFixture(week) {
  return [
    '---',
    `title: "Weekly report ${week.periodEnd}"`,
    `slug: "/reports/weekly/${week.periodEnd}"`,
    `periodStart: "${week.periodStart}"`,
    `periodEnd: "${week.periodEnd}"`,
    'status: "published"',
    'score:',
    `  value: ${week.value}`,
    `  regime: "${week.regime}"`,
    '---',
    '',
  ].join('\n');
}

function monthlyFixture(scoreOverride = null) {
  const scoreValues = weeks.map((week) => scoreOverride?.periodEnd === week.periodEnd ? scoreOverride.value : week.value);
  return [
    '---',
    'title: "Monthly USD Impact Report — July 2026"',
    'metaTitle: "Monthly USD Impact Report — July 2026 | USD Impact"',
    'metaDescription: "A four-week source-backed USD Impact review."',
    'slug: "/reports/monthly/2026-07-31"',
    'periodStart: "2026-07-06"',
    'periodEnd: "2026-07-31"',
    'generatedAt: "2026-08-03T12:00:00Z"',
    'lastReviewed: "2026-08-03"',
    'status: "published"',
    'category: "Monthly USD Impact Report"',
    'summary: "A validated four-week synthesis."',
    'scorePath:',
    ...weeks.flatMap((week, index) => [
      `  - periodEnd: "${week.periodEnd}"`,
      `    value: ${scoreValues[index]}`,
      `    regime: "${week.regime}"`,
    ]),
    'themes:',
    '  - title: "Policy transmission"',
    '    summary: "A persistent theme."',
    '    weeklyReportDates:',
    '      - "2026-07-10"',
    '      - "2026-07-17"',
    '  - title: "Score path"',
    '    summary: "The score softened."',
    '    weeklyReportDates:',
    '      - "2026-07-24"',
    '      - "2026-07-31"',
    '  - title: "Cross-asset confirmation"',
    '    summary: "Signals persisted across the window."',
    '    weeklyReportDates:',
    '      - "2026-07-17"',
    '      - "2026-07-24"',
    'sourceWeeklyReports:',
    ...weeks.flatMap((week) => [
      `  - periodEnd: "${week.periodEnd}"`,
      `    title: "Weekly report ${week.periodEnd}"`,
      `    url: "/reports/weekly/${week.periodEnd}"`,
    ]),
    'complianceNote: "Educational and informational only."',
    '---',
    '',
    '## Monthly synthesis',
    '',
    'Source-backed analysis.',
    '',
    '## Methodology note',
    '',
    'Uses only the four listed weekly reports.',
    '',
  ].join('\n');
}

function validate() {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      WEEKLY_REPORT_ROOT: weeklyRoot,
      MONTHLY_REPORT_ROOT: monthlyRoot,
    },
  });
}

try {
  await mkdir(weeklyRoot);
  await mkdir(monthlyRoot);
  await Promise.all(weeks.map((week) => writeFile(
    path.join(weeklyRoot, `${week.periodEnd}.md`),
    weeklyFixture(week),
  )));

  const monthlyPath = path.join(monthlyRoot, '2026-07-31.md');
  await writeFile(monthlyPath, monthlyFixture());
  const valid = validate();
  assert.equal(valid.status, 0, valid.stderr);

  await writeFile(monthlyPath, monthlyFixture({ periodEnd: '2026-07-24', value: 9 }));
  const invalid = validate();
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /score path value does not match weekly report 2026-07-24/);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

console.log('monthly report validator tests pass');
