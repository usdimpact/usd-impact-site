import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

writeWorkflow('on: [push, workflow_dispatch]\npermissions:\n  contents: read');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.PASS);
assert.deepEqual(result.evidence[0].trigger_parse_issues, []);

writeWorkflow('on: [\n  push,\n  pull_request_target\n]\npermissions:\n  contents: read');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.ok(result.evidence[0].trigger_parse_issues.some((issue) => /multiline YAML flow sequence/.test(issue)));

writeWorkflow('on: {\n  push: null,\n  pull_request_target: null\n}\npermissions:\n  contents: read');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.ok(result.evidence[0].trigger_parse_issues.some((issue) => /multiline YAML flow mapping/.test(issue)));

writeWorkflow('on: >-\n  pull_request_target\npermissions:\n  contents: read');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.ok(result.evidence[0].trigger_parse_issues.some((issue) => /YAML block scalar/.test(issue)));

writeWorkflow('on: |-\n  pull_request_target\npermissions:\n  contents: read');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.ok(result.evidence[0].trigger_parse_issues.some((issue) => /YAML block scalar/.test(issue)));

writeBaseline({ '.github/workflows/quality.yml': ['contents', 'issues'] });
writeWorkflow('permissions:\n  contents: write');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.deepEqual(result.evidence[0].missing_expected_write_permissions, ['.github/workflows/quality.yml :: issues']);

fs.rmSync(path.join(controlDir, 'GITHUB_PERMISSION_BASELINE.json'));
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.match(result.evidence[0].permission_baseline_error, /missing/);

// Exercise the installed OIDC workflows as data only; never run their jobs.
// Reconcile exact file/scope pairs without granting OIDC to other workflows.
fs.rmSync(workflowPath);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installedBaseline = JSON.parse(fs.readFileSync(path.join(
  repositoryRoot, 'docs/operations/integrity-watchdog/GITHUB_PERMISSION_BASELINE.json',
), 'utf8'));
const oidcFiles = [
  '.github/workflows/publication-oidc-endpoint-diagnostic-558.yml',
  '.github/workflows/publication-oidc-rehearsal-558.yml',
  '.github/workflows/publication-oidc-rehearsal-runner-558.yml',
];
const oidcExpected = {};
const oidcSources = {};
for (const file of oidcFiles) {
  assert.deepEqual(installedBaseline.expected_write_permissions[file], ['id-token']);
  oidcExpected[file] = installedBaseline.expected_write_permissions[file];
  oidcSources[file] = fs.readFileSync(path.join(repositoryRoot, file), 'utf8');
  fs.writeFileSync(path.join(workspace, file), oidcSources[file]);
}
writeBaseline(oidcExpected);
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.PASS);
assert.deepEqual(result.evidence[0].workflow_write_permissions, oidcExpected);

for (const file of oidcFiles) {
  const omitted = { ...oidcExpected };
  delete omitted[file];
  writeBaseline(omitted);
  result = repositoryContracts({ workspace })[0];
  assert.equal(result.outcome, OUTCOME.FAIL);
  assert.deepEqual(result.evidence[0].unexpected_write_permissions, [`${file} :: id-token`]);
  writeBaseline(oidcExpected);

  const source = oidcSources[file];
  assert.equal((source.match(/id-token: write/g) || []).length, 1);
  fs.writeFileSync(path.join(workspace, file), source.replace(
    'id-token: write', 'id-token: write\n      issues: write',
  ));
  result = repositoryContracts({ workspace })[0];
  assert.equal(result.outcome, OUTCOME.FAIL);
  assert.deepEqual(result.evidence[0].unexpected_write_permissions, [`${file} :: issues`]);

  fs.writeFileSync(path.join(workspace, file), source.replace('id-token: write', 'id-token: read'));
  result = repositoryContracts({ workspace })[0];
  assert.equal(result.outcome, OUTCOME.FAIL);
  assert.deepEqual(result.evidence[0].missing_expected_write_permissions, [`${file} :: id-token`]);
  fs.writeFileSync(path.join(workspace, file), source);
}

writeWorkflow('on: workflow_dispatch\npermissions:\n  id-token: write');
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.deepEqual(result.evidence[0].unexpected_write_permissions, ['.github/workflows/quality.yml :: id-token']);
fs.rmSync(workflowPath);

const originalFile = oidcFiles[0];
const relocatedFile = '.github/workflows/renamed-oidc-diagnostic.yml';
fs.renameSync(path.join(workspace, originalFile), path.join(workspace, relocatedFile));
result = repositoryContracts({ workspace })[0];
assert.equal(result.outcome, OUTCOME.FAIL);
assert.deepEqual(result.evidence[0].unexpected_write_permissions, [`${relocatedFile} :: id-token`]);
assert.deepEqual(result.evidence[0].missing_expected_write_permissions, [`${originalFile} :: id-token`]);

fs.rmSync(workspace, { recursive: true, force: true });
console.log('USD Impact watchdog workflow permission-baseline tests passed.');
