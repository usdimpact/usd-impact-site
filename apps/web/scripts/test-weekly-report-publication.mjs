import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

  // Parse the literal/inline run steps in this workflow's fixed YAML layout.
  // Bash syntax checks do not execute the publication, network or Git commands.
  const shellSteps = workflow.split(/^      - /m).slice(1).flatMap((step) => {
    const run = step.match(/^        run: ([^\n]*)\n([\s\S]*)$/m);
    if (!run) return [];
    const name = step.split('\n')[0];
    if (run[1] !== '|') {
      assert.equal(run[2].trim(), '', `unsupported inline run layout: ${name}`);
      return [{ name, script: run[1] }];
    }
    const lines = run[2].split('\n');
    assert.ok(lines.every((line) => !line || line.startsWith('          ')),
      `unsupported literal run indentation: ${name}`);
    return [{ name, script: lines.map((line) => line.slice(10)).join('\n') }];
  });
  assert.equal(shellSteps.length, 8, 'check every existing weekly workflow run step');
  const shell = (script, syntaxOnly = false) => {
    const result = spawnSync('bash', ['--noprofile', '--norc', ...(syntaxOnly ? ['-n'] : []), '-s'], {
      input: script, cwd: root, encoding: 'utf8', timeout: 5000,
      // Do not pass credentials or shell startup hooks to the fixture process.
      env: { PATH: process.env.PATH || '/usr/bin:/bin', HOME: root,
        LANG: 'C', LC_ALL: 'C', TZ: 'UTC', WEEK: '2026-09-04' },
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null, 'fixture shell must complete within its bound');
    return result;
  };
  for (const { name, script } of shellSteps) {
    const result = shell(script, true);
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
  }
  const prerequisites = shellSteps.filter(({ name }) => name === 'name: Require five published Daily editions');
  assert.equal(prerequisites.length, 1, 'execute only the existing read-only prerequisite');
  const prerequisite = prerequisites[0].script;
  assert.doesNotMatch(prerequisite, /\b(?:curl|wget|gh|git|node|npm)\b/);
  const fixtureDates = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];
  const fixtureNews = path.join(root, 'src/content/news');
  fs.mkdirSync(fixtureNews, { recursive: true });
  const writeStatus = (date, status) => fs.writeFileSync(path.join(fixtureNews, `${date}.md`),
    `---\ndate: "${date}"\nstatus: ${status}\n---\n`, 'utf8');
  const assertPrerequisite = (expected, label) => {
    const result = shell(prerequisite);
    assert.equal(result.status, expected, `${label}: ${result.stderr}`);
  };
  let prerequisiteCases = 0;
  const publishedForms = ['published', '"published"', "'published'"];
  for (const status of publishedForms) {
    for (const date of fixtureDates) writeStatus(date, status);
    assertPrerequisite(0, `published form ${status}`);
    prerequisiteCases += 1;
  }
  for (const [index, date] of fixtureDates.entries()) writeStatus(date, publishedForms[index % publishedForms.length]);
  assertPrerequisite(0, 'mixed valid quoting across the month boundary');
  prerequisiteCases += 1;
  for (const date of fixtureDates) {
    fs.unlinkSync(path.join(fixtureNews, `${date}.md`));
    assertPrerequisite(1, `missing edition ${date}`);
    prerequisiteCases += 1;
    writeStatus(date, '"published"');
  }
  const rejectedForms = ['draft', '"draft"', "'draft'", 'unpublished', 'published-extra', '',
    '"published', 'published"', "'published", "published'", "\"published'", "'published\""];
  for (const date of fixtureDates) {
    for (const status of rejectedForms) {
      writeStatus(date, status);
      assertPrerequisite(1, `unpublished or malformed ${date}: ${status}`);
      prerequisiteCases += 1;
    }
    writeStatus(date, '"published"');
  }
  console.log(`Weekly shell regression passed: ${shellSteps.length} syntax checks; ${prerequisiteCases} prerequisite cases.`);

  const generatorSource = fs.readFileSync(path.resolve(scriptRoot, 'generate-weekly-report.mjs'), 'utf8');
  assert.match(generatorSource, /fs\.openSync\(output, 'wx', 0o600\)/);
  assert.doesNotMatch(generatorSource, /existsSync\(output\)/);

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
  const mondayFile = path.join(newsRoot, dates[0] + '.md');
  const originalMonday = fs.readFileSync(mondayFile, 'utf8');
  for (const [source, error] of [
    [originalMonday.replace('status: "published"', 'status: "draft"') + 'status: "published"\n', /not published/],
    [originalMonday.replace('date: "2026-08-24"', 'date: "2026-08-25"'), /mismatched date/],
    [originalMonday.replace(/^title:.*\n/m, ''), /missing title or summary/],
    [originalMonday.replace(/^summary:.*\n/m, ''), /missing title or summary/],
  ]) {
    fs.writeFileSync(mondayFile, source, 'utf8');
    assert.throws(() => generateWeeklyReport({ week: '2026-08-28', score, newsRoot }), error);
  }
  fs.writeFileSync(mondayFile, originalMonday, 'utf8');
  fs.unlinkSync(path.join(newsRoot, '2026-08-27.md'));
  assert.throws(() => generateWeeklyReport({ week: '2026-08-28', score, newsRoot }), /missing Daily edition/);
  console.log('weekly report publication generator tests pass');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
