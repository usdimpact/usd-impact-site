import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { evaluateGate, readGate } from './score-derived-publication-rights-gate.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const workflow = await readFile(path.join(repoRoot, '.github', 'workflows', 'weekly-report.yml'), 'utf8');
const gate = JSON.parse(
  await readFile(path.join(repoRoot, 'governance', 'score-derived-publication-rights-gate.json'), 'utf8'),
);

test('current weekly-report Score-derived publication gate is HOLD', () => {
  assert.equal(gate.state, 'hold');
  assert.equal(gate.version, 1);
  assert.match(gate.issue, /\/usdimpact\/usd-impact-pipeline\/issues\/155$/);
  const result = readGate();
  assert.deepEqual(result.hold, true);
  assert.equal(result.state, 'hold');
});

test('gate evaluator fails closed on missing, malformed or unknown policy', () => {
  for (const payload of [null, [], {}, { state: 'maybe' }]) {
    const result = evaluateGate(payload);
    assert.equal(result.hold, true);
    assert.equal(result.state, 'hold');
  }
});

test('ALLOW requires named approver and GitHub decision receipt', () => {
  assert.equal(evaluateGate({ state: 'allow' }).hold, true);
  assert.equal(
    evaluateGate({ state: 'allow', approved_by: 'owner', decision_receipt: 'not-a-url' }).hold,
    true,
  );

  const allowed = evaluateGate({
    state: 'allow',
    approved_by: 'owner',
    decision_receipt: 'https://github.com/usdimpact/usd-impact-pipeline/issues/155',
  });
  assert.equal(allowed.hold, false);
  assert.equal(allowed.state, 'allow');
});

test('weekly-report workflow stops before component archive fetch while HOLD is active', () => {
  assert.match(workflow, /^  rights-gate:/m);
  assert.match(workflow, /permissions:\n      contents: read/);
  assert.match(workflow, /Evaluate Score-derived publication rights gate/);
  assert.match(workflow, /node apps\/web\/scripts\/score-derived-publication-rights-gate\.mjs --github-output/);
  assert.match(workflow, /^  generate-and-open-review:\n    needs: rights-gate\n    if: needs\.rights-gate\.result == 'success' && needs\.rights-gate\.outputs\.hold == 'false'/m);
  assert.match(workflow, /cron: '17 8 \* \* 0'/);

  const gateIndex = workflow.indexOf('Evaluate Score-derived publication rights gate');
  const fetchIndex = workflow.indexOf('Fetch and validate immutable Score archive');
  assert.ok(gateIndex >= 0 && fetchIndex > gateIndex);
});

test('manual Score-derived report CLI refuses before any input read or output write during HOLD', () => {
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), 'score-report-cli-hold-'));
  const scoreInput = path.join(fixtureRoot, 'not-present-score.json');
  const outputPath = path.join(fixtureRoot, 'new-output-dir', 'weekly-report.md');
  const spoofedGate = path.join(fixtureRoot, 'pretend-allow.json');

  try {
    // An environment-supplied policy must not replace the canonical repo gate.
    writeFileSync(spoofedGate, JSON.stringify({
      version: 1, state: 'allow', approved_by: 'untrusted',
      decision_receipt: 'https://github.com/usdimpact/usd-impact-pipeline/issues/155',
    }), 'utf8');

    const invocations = [
      ['--week', '2099-01-02', '--score', scoreInput, '--output', outputPath],
      [],
    ];
    for (const argv of invocations) {
      const execution = spawnSync(process.execPath, [
        path.join(scriptDir, 'generate-weekly-report.mjs'),
        ...argv,
      ], {
        cwd: fixtureRoot,
        encoding: 'utf8',
        timeout: 5000,
        env: {
          PATH: process.env.PATH || '/usr/bin:/bin',
          HOME: fixtureRoot,
          SCORE_DERIVED_PUBLICATION_RIGHTS_GATE: spoofedGate,
        },
      });
      assert.ifError(execution.error);
      assert.equal(execution.signal, null, 'CLI must exit within timeout');
      assert.notEqual(execution.status, 0, 'direct manual CLI must refuse during HOLD');
      assert.match(execution.stderr, /rights HOLD.*Issue #155/);
      assert.doesNotMatch(execution.stderr, /ENOENT|not-present-score|usage: --week/);
      assert.equal(existsSync(outputPath), false, 'no report may be created');
      assert.equal(existsSync(path.dirname(outputPath)), false, 'no output directory may be created');
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
