import assert from 'node:assert/strict';
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
  assert.match(workflow, /^  generate-and-open-review:\n    needs: rights-gate\n    if: needs\.rights-gate\.outputs\.hold != 'true'/m);
  assert.match(workflow, /cron: '17 8 \* \* 0'/);

  const gateIndex = workflow.indexOf('Evaluate Score-derived publication rights gate');
  const fetchIndex = workflow.indexOf('Fetch and validate immutable Score archive');
  assert.ok(gateIndex >= 0 && fetchIndex > gateIndex);
});
