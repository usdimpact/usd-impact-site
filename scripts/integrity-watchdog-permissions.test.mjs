import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OUTCOME } from './integrity-watchdog-policy.mjs';
import { repositoryContracts } from './integrity-watchdog-repository.mjs';

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'watchdog-permissions-'));
const workflowDir = path.join(workspace, '.github', 'workflows');
const controlDir = path.join(workspace, 'docs', 'operations', 'integrity-watchdog');
fs.mkdirSync(workflowDir, { recursive: true });
fs.mkdirSync(controlDir, { recursive: true });
fs.writeFileSync(path.join(controlDir, 'POLICY.json'), '{}\n');

const writeBaseline = (expected) => fs.writeFileSync(
  path.join(controlDir, 'GITHUB_PERMISSION_BASELINE.json'),
  `${JSON.stringify({ schema_version: 1, baseline_version: 'test', expected_write_permissions: expected }, null, 2)}\n`,
);
const workflowPath = path.join(workflowDir, 'quality.yml');
const pinnedAction = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';
const writeWorkflow = (body) => fs.writeFileSync(workflowPath, `${body}\njobs:\n  test:\n    steps:\n      - uses: ${pinnedAction}\n`);

writeBaseline({});
writeWorkflow('permissions:\n  contents: read');
let result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.PASS);
assert.equal(result.evidence[0].permission_baseline_enforced, true);
assert.deepEqual(result.evidence[0].workflow_write_permissions, {});
assert.deepEqual(result.evidence[0].permission_parse_issues, []);
assert.deepEqual(result.evidence[0].trigger_parse_issues, []);

writeWorkflow('permissions:\n  contents: write');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.deepEqual(result.evidence[0].unexpected_write_permissions, ['.github/workflows/quality.yml :: contents']);

writeBaseline({ '.github/workflows/quality.yml': ['contents'] });
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.PASS);
assert.deepEqual(result.evidence[0].unexpected_write_permissions, []);
assert.deepEqual(result.evidence[0].missing_expected_write_permissions, []);

writeWorkflow('permissions:\n  "contents": "write"');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.PASS);
assert.deepEqual(result.evidence[0].workflow_write_permissions, { '.github/workflows/quality.yml': ['contents'] });

writeBaseline({});
writeWorkflow('permissions: "write-all"');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.deepEqual(result.evidence[0].write_all_files, ['.github/workflows/quality.yml']);

writeBaseline({ '.github/workflows/quality.yml': ['contents'] });
writeWorkflow('permissions: &guarded\n  contents: write');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.match(result.evidence[0].permission_parse_issues[0], /anchor\/alias/);
assert.deepEqual(result.evidence[0].workflow_write_permissions, { '.github/workflows/quality.yml': ['contents'] });

writeBaseline({});
writeWorkflow('permissions: *guarded');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.match(result.evidence[0].permission_parse_issues[0], /anchor\/alias/);

writeWorkflow('on: [push, pull_request_target]\npermissions:\n  contents: read');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.deepEqual(result.evidence[0].pull_request_target_files, ['.github/workflows/quality.yml']);

writeWorkflow('on: "pull_request_target"\npermissions:\n  contents: read');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.deepEqual(result.evidence[0].pull_request_target_files, ['.github/workflows/quality.yml']);

writeWorkflow('on:\n  "pull_request_target":\npermissions:\n  contents: read');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.deepEqual(result.evidence[0].pull_request_target_files, ['.github/workflows/quality.yml']);

writeWorkflow('on: *events\npermissions:\n  contents: read');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.match(result.evidence[0].trigger_parse_issues[0], /anchor\/alias/);

writeWorkflow('on:\n  - push\n  - workflow_dispatch\npermissions:\n  contents: read');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.PASS);
assert.deepEqual(result.evidence[0].trigger_parse_issues, []);

writeWorkflow('on:\n  - &danger pull_request_target\n  - *danger\npermissions:\n  contents: read');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.deepEqual(result.evidence[0].pull_request_target_files, ['.github/workflows/quality.yml']);
assert.ok(result.evidence[0].trigger_parse_issues.some((issue) => /anchor\/alias/.test(issue)));

writeWorkflow('on: [&danger pull_request_target, *danger]\npermissions:\n  contents: read');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.deepEqual(result.evidence[0].pull_request_target_files, ['.github/workflows/quality.yml']);
assert.ok(result.evidence[0].trigger_parse_issues.some((issue) => /anchor\/alias/.test(issue)));

writeBaseline({ '.github/workflows/quality.yml': ['contents', 'issues'] });
writeWorkflow('permissions:\n  contents: write');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.deepEqual(result.evidence[0].missing_expected_write_permissions, ['.github/workflows/quality.yml :: issues']);

fs.rmSync(path.join(controlDir, 'GITHUB_PERMISSION_BASELINE.json'));
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.match(result.evidence[0].permission_baseline_error, /missing/);

fs.rmSync(workspace, { recursive: true, force: true });
console.log('USD Impact watchdog workflow permission-baseline tests passed.');
