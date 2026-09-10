import assert from 'node:assert/strict';
import { open, readdir, readFile, mkdtemp, writeFile, rename, symlink, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

// Use the existing locked parser; no network, install or fallback in this gate.
const require = createRequire(import.meta.url);
assert.equal(require('js-yaml/package.json').version, '4.3.2', 'Review YAML parser version changes');
const { load, FAILSAFE_SCHEMA } = require('js-yaml');

const workflowsDirectory = new URL('../../../.github/workflows/', import.meta.url);
const workflowFiles = (await readdir(workflowsDirectory))
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();

assert.ok(workflowFiles.length > 0, 'Expected at least one GitHub Actions workflow');

const expectedActionRefs = new Map([
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1'],
  ['actions/setup-node', '820762786026740c76f36085b0efc47a31fe5020'],
  ['actions/upload-artifact', '043fb46d1a93c77aae656e7c1c64a875d1fc6a0a'],
  ['github/codeql-action', 'cdf488f595d80d6e07e03d4674febd5ab45fa938'],
  ['actions/dependency-review-action', 'a1d282b36b6f3519aa1f3fc636f609c47dddb294'],
]);

// PR #561: one reviewed reusable workflow, not an owner/repository-wide exception.
// Exact source hashes also bind permissions, triggers, checkout input and scripts.
// References are parsed below; this is not a complete workflow security audit.
const rehearsalCaller = 'publication-oidc-rehearsal-558.yml';
const rehearsalRunner = 'publication-oidc-rehearsal-runner-558.yml';
const rehearsalResource = `usdimpact/usd-impact-site/.github/workflows/${rehearsalRunner}`;
const rehearsalRef = '10ed538c1005ff268dfa82277b1d9db2f9a6a1e1';
const rehearsalSources = new Map([
  [`.github/workflows/${rehearsalCaller}`, '2f5691e8a4785406c19e9581a4da229f68a420ae3617827fc1d84da9c65b8e22'],
  [`.github/workflows/${rehearsalRunner}`, '9e9a4c8a859e1d7630455e37c5b06cc8c648f151ab8d4fdd78aa62ea15e1da0d'],
  ['scripts/publication-oidc-rehearsal-558/run.mjs', 'c46b4bf78f743e97d72a0abd1358258cea9df8f623d35fc716aba65a7d9a7033'],
  ['scripts/publication-oidc-rehearsal-558/verifier.mjs', 'e65f2f81f376473534cde41262108803515a2a5f5bf798909bd6425ee1163378'],
  ['scripts/publication-oidc-rehearsal-558/test-rehearsal.mjs', 'af89ef513d7dce6dca165626a64c580f971cb3d0fd3b0e1547a728d076907bd3'],
]);

function validateReference(workflowFile, resource, ref) {
  if (resource === rehearsalResource) {
    assert.equal(workflowFile, rehearsalCaller, 'Unreviewed reusable-workflow caller');
    assert.equal(ref, rehearsalRef, 'Unreviewed reusable-workflow revision');
    return 'reviewed-reusable-workflow';
  }
  const action = resource.split('/').slice(0, 2).join('/');
  assert.ok(expectedActionRefs.has(action), `${workflowFile} uses unapproved action ${action}`);
  assert.match(ref, /^[0-9a-f]{40}$/, `${workflowFile} must pin ${action} to an immutable 40-char SHA`);
  assert.equal(ref, expectedActionRefs.get(action), `${workflowFile} must use the reviewed ${action} SHA`);
  return action;
}

// Inspect the parsed jobs/steps, not lexical occurrences inside YAML or run scripts.
// FAILSAFE keeps keys such as "on" as strings and disables implicit merge/type tags.
function workflowReferences(source, filename) {
  assert.ok(typeof source === 'string' && Buffer.byteLength(source, 'utf8') <= 1048576,
    `${filename} exceeds the workflow source limit`);
  let document;
  try {
    document = load(source, { schema: FAILSAFE_SCHEMA, json: false, maxDepth: 50,
      onWarning: (warning) => { throw warning; } });
  } catch {
    assert.fail(`${filename} has invalid or unsupported workflow YAML`);
  }
  const mapping = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const seen = new Set();
  let nodes = 0;
  function check(value, depth = 0) {
    assert.ok(++nodes <= 10000 && depth <= 50, `${filename} exceeds the workflow structure limit`);
    if (value === null || typeof value !== 'object') return;
    assert.ok(!seen.has(value), `${filename} has cyclic or shared collection aliases`);
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!['<<', '__proto__', 'constructor', 'prototype'].includes(key),
        `${filename} has an unsupported merge or reserved key`);
      assert.ok(!['jobs', 'steps', 'uses', 'run'].includes(key.toLowerCase()) || key === key.toLowerCase(),
        `${filename} has a noncanonical structural key`);
      check(child, depth + 1);
    }
  }
  check(document);
  assert.ok(mapping(document) && mapping(document.jobs) && Object.keys(document.jobs).length > 0,
    `${filename} must have a jobs mapping`);
  const references = [];
  for (const [id, job] of Object.entries(document.jobs)) {
    assert.ok(mapping(job), `${filename} job ${id} must be a mapping`);
    assert.ok(Object.hasOwn(job, 'uses') || Object.hasOwn(job, 'steps'),
      `${filename} job ${id} must define a reusable call or steps`);
    if (Object.hasOwn(job, 'uses')) {
      assert.equal(typeof job.uses, 'string', `${filename} reusable reference must be a string`);
      assert.ok(!Object.hasOwn(job, 'steps'), `${filename} cannot mix reusable jobs and steps`);
      references.push({ value: job.uses, kind: 'workflow' });
    }
    if (!Object.hasOwn(job, 'steps')) continue;
    assert.ok(Array.isArray(job.steps), `${filename} steps must be a sequence`);
    for (const step of job.steps) {
      assert.ok(mapping(step), `${filename} step must be a mapping`);
      assert.ok(Object.hasOwn(step, 'uses') || Object.hasOwn(step, 'run'),
        `${filename} has an unsupported executable step`);
      if (!Object.hasOwn(step, 'uses')) {
        assert.equal(typeof step.run, 'string', `${filename} run must be a string`);
        continue;
      }
      assert.equal(typeof step.uses, 'string', `${filename} action reference must be a string`);
      assert.ok(!Object.hasOwn(step, 'run'), `${filename} cannot mix action and run in a step`);
      references.push({ value: step.uses, kind: 'action' });
    }
  }
  return references;
}

// Both the corpus scan and added-file regressions use this exact entry point.
function validateParsedReferences(source, filename) {
  const counts = new Map([...expectedActionRefs.keys()].map((name) => [name, 0]));
  let reusableCount = 0;
  for (const { value, kind } of workflowReferences(source, filename)) {
    const match = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_./-]+)?)@([a-f0-9]{40})$/.exec(value);
    assert.ok(match && match[0] === value, `${filename} must use a supported immutable reference`);
    const category = validateReference(filename, match[1], match[2]);
    if (category === 'reviewed-reusable-workflow') {
      assert.equal(kind, 'workflow', 'Reviewed reusable workflow must be a job');
      reusableCount += 1;
    } else {
      assert.equal(kind, 'action', `${filename} has an unreviewed job-level reusable workflow`);
      counts.set(category, counts.get(category) + 1);
    }
  }
  return { counts, reusableCount };
}

function validateRehearsalSources(sources) {
  assert.equal(sources.size, rehearsalSources.size, 'Incomplete rehearsal source evidence');
  for (const [path, digest] of rehearsalSources) {
    const source = sources.get(path);
    assert.ok(Buffer.isBuffer(source), `Missing reviewed rehearsal source: ${path}`);
    assert.equal(createHash('sha256').update(source).digest('hex'), digest,
      `Rehearsal source changed; explicit re-review required: ${path}`);
  }
}

// Open first and check/read the same handle; never check then reopen a pathname.
// O_NOFOLLOW rejects a swapped leaf symlink; O_NONBLOCK avoids waiting on a FIFO.
// The exact digest still validates the bytes read, not future filesystem state.
async function readRegularSource(file, openFile = open) {
  assert.ok(Number.isInteger(constants.O_NOFOLLOW) && Number.isInteger(constants.O_NONBLOCK),
    'Required safe file-open flags are unavailable');
  const handle = await openFile(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    assert.ok((await handle.stat()).isFile(), 'Rehearsal source must be a regular file');
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function readWorkflowSource(workflowFile, snapshots) {
  const captured = snapshots.get(`.github/workflows/${workflowFile}`);
  // Parse exactly the bytes already fingerprinted, not a second pathname read.
  return captured === undefined
    ? readFile(new URL(workflowFile, workflowsDirectory), 'utf8')
    : captured.toString('utf8');
}

const hasRehearsal = workflowFiles.includes(rehearsalCaller) || workflowFiles.includes(rehearsalRunner);
const checkedRehearsalSources = new Map();
if (hasRehearsal) {
  assert.ok(workflowFiles.includes(rehearsalCaller) && workflowFiles.includes(rehearsalRunner),
    'Both reviewed rehearsal workflows are required');
  for (const path of rehearsalSources.keys()) {
    const file = new URL(`../../../${path}`, import.meta.url);
    checkedRehearsalSources.set(path, await readRegularSource(file));
  }
  validateRehearsalSources(checkedRehearsalSources);
}
let reusableWorkflowCount = 0;

// Run regression assertions in this already-required gate; no new workflow or token request.
const referenceRegressions = [
  ['exact reviewed caller/path/SHA', () => assert.equal(
    validateReference(rehearsalCaller, rehearsalResource, rehearsalRef), 'reviewed-reusable-workflow')],
];
for (const ref of ['main', 'v1', rehearsalRef.slice(0, 12), 'a'.repeat(40), rehearsalRef.toUpperCase(),
  `${rehearsalRef}/extra`, '${{ inputs.ref }}', '', 'e0dda44455cdc6742fba2755b84f9997fecf2b7f']) {
  referenceRegressions.push([`reject unreviewed reusable ref ${ref}`, () => assert.throws(
    () => validateReference(rehearsalCaller, rehearsalResource, ref), /Unreviewed reusable-workflow revision/)]);
}
for (const caller of ['quality.yml', 'publication-oidc-rehearsal-controller.yml', `nested/${rehearsalCaller}`, '']) {
  referenceRegressions.push([`reject unreviewed caller ${caller}`, () => assert.throws(
    () => validateReference(caller, rehearsalResource, rehearsalRef), /Unreviewed reusable-workflow caller/)]);
}
for (const resource of [
  rehearsalResource.replace('runner-558.yml', 'runner.yml'),
  rehearsalResource.replace('runner-558.yml', 'other.yml'),
  `${rehearsalResource}/extra`,
  rehearsalResource.replace('/.github/', '/nested/.github/'),
  rehearsalResource.replace('/.github/', '/./.github/'),
  rehearsalResource.replace('/workflows/', '/workflows/../workflows/'),
  rehearsalResource.replace('usdimpact/', 'other-owner/'),
  rehearsalResource.replace('usd-impact-site/', 'other-repository/'),
  'usdimpact/usd-impact-site',
]) {
  referenceRegressions.push([`reject unreviewed resource ${resource}`, () => assert.throws(
    () => validateReference(rehearsalCaller, resource, rehearsalRef), /uses unapproved action/)]);
}
for (const [action, ref] of expectedActionRefs) {
  referenceRegressions.push([`retain reviewed ${action}`, () => assert.equal(validateReference('quality.yml', action, ref), action)]);
  referenceRegressions.push([`reject changed ${action}`, () => assert.throws(
    () => validateReference('quality.yml', action, 'a'.repeat(40)), /must use the reviewed/)]);
  referenceRegressions.push([`reject mutable ${action}`, () => assert.throws(
    () => validateReference('quality.yml', action, 'main'), /immutable 40-char SHA/)]);
}
if (hasRehearsal) {
  referenceRegressions.push(['exact bound source set', () => validateRehearsalSources(checkedRehearsalSources)]);
  for (const path of rehearsalSources.keys()) {
    referenceRegressions.push([`reject changed source ${path}`, () => {
      const changed = new Map(checkedRehearsalSources);
      changed.set(path, Buffer.concat([changed.get(path), Buffer.from('\n# changed') ]));
      assert.throws(() => validateRehearsalSources(changed), /Rehearsal source changed/);
    }]);
    referenceRegressions.push([`reject missing source ${path}`, () => {
      const missing = new Map(checkedRehearsalSources);
      missing.delete(path);
      assert.throws(() => validateRehearsalSources(missing), /Incomplete rehearsal source evidence/);
    }]);
  }
}
for (const [name, work] of referenceRegressions) {
  try { work(); } catch (error) { error.message = `${name}: ${error.message}`; throw error; }
}
console.log(`Reusable-workflow allowlist: ${referenceRegressions.length} regression groups passed (offline; no workflow execution).`);

// Local temporary files only: no workflow execution, network or credentials.
const fileRegressionNames = [];
const fixtureDirectory = await mkdtemp(join(tmpdir(), 'usdimpact-source-read-'));
async function fileRegression(name, check) {
  try { await check(); fileRegressionNames.push(name); }
  catch (error) { error.message = `${name}: ${error.message}`; throw error; }
}
try {
  const source = join(fixtureDirectory, 'source');
  const alternate = join(fixtureDirectory, 'alternate');
  const link = join(fixtureDirectory, 'link');
  await writeFile(source, 'reviewed bytes');
  await writeFile(alternate, 'unreviewed bytes');
  await fileRegression('read reviewed regular file', async () => {
    assert.equal((await readRegularSource(source)).toString(), 'reviewed bytes');
  });
  await symlink(source, link);
  await fileRegression('reject identical-content leaf symlink', async () => {
    await assert.rejects(() => readRegularSource(link), { code: 'ELOOP' });
  });
  await fileRegression('reject directory', async () => {
    await assert.rejects(() => readRegularSource(fixtureDirectory), /regular file/);
  });
  await fileRegression('reject missing file', async () => {
    await assert.rejects(() => readRegularSource(join(fixtureDirectory, 'missing')), { code: 'ENOENT' });
  });
  await fileRegression('path swap after open does not change the checked handle', async () => {
    const captured = await readRegularSource(source, async (path, flags) => {
      const handle = await open(path, flags);
      await rename(source, join(fixtureDirectory, 'original'));
      await symlink(alternate, source);
      return handle;
    });
    assert.equal(captured.toString(), 'reviewed bytes');
  });
  await fileRegression('close handle when regular-file check fails', async () => {
    let closed = false;
    await assert.rejects(() => readRegularSource(source, async () => ({
      stat: async () => ({ isFile: () => false }),
      readFile: async () => assert.fail('Non-file must not be read'),
      close: async () => { closed = true; },
    })), /regular file/);
    assert.equal(closed, true);
  });
  await fileRegression('close handle when reading fails', async () => {
    let closed = false;
    await assert.rejects(() => readRegularSource(source, async () => ({
      stat: async () => ({ isFile: () => true }),
      readFile: async () => { throw new Error('fixture-read-failure'); },
      close: async () => { closed = true; },
    })), /fixture-read-failure/);
    assert.equal(closed, true);
  });
  await fileRegression('open uses required nofollow and nonblocking flags', async () => {
    await readRegularSource(source, async (_path, flags) => {
      assert.equal(flags, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      return { stat: async () => ({ isFile: () => true }), readFile: async () => Buffer.alloc(0), close: async () => {} };
    });
  });
  await fileRegression('workflow parsing reuses the fingerprinted bytes', async () => {
    const snapshots = new Map([['.github/workflows/absent-fixture.yml', Buffer.from('reviewed snapshot')]]);
    assert.equal(await readWorkflowSource('absent-fixture.yml', snapshots), 'reviewed snapshot');
  });
} finally {
  await rm(fixtureDirectory, { recursive: true, force: true });
}
console.log(`Regular-file snapshots: ${fileRegressionNames.length} regression groups passed (temporary local fixtures only).`);

// R561-01 fixtures are additional files, outside the hash-bound original pair.
// Never execute these YAML fixtures or contact GitHub from this test suite.
const parsedRegressionNames = [];
function parsedRegression(name, work) {
  try { work(); parsedRegressionNames.push(name); }
  catch (error) { throw new Error(`${name}: ${error.message}`, { cause: error }); }
}
const target = `${rehearsalResource}@${rehearsalRef}`;
const extraCaller = (entry) => `name: Additional caller
on: workflow_dispatch
permissions: {}
jobs:
  extra:
    permissions: {contents: read, id-token: write}
    ${entry}
    with: {runner_sha: '${rehearsalRef}', confirmation: true}
`;
function rejectParsed(name, source, pattern) {
  parsedRegression(name, () => assert.throws(
    () => validateParsedReferences(source, 'additional-caller.yml'), pattern));
}
for (const [name, entry] of [
  ['plain', `uses: ${target}`],
  ['single-quoted value', `uses: '${target}'`],
  ['double-quoted value', `uses: "${target}"`],
  ['quoted key', `'uses': ${target}`],
  ['escaped key', `"u\\u0073es": "${target}"`],
  ['escaped value', `uses: "${target.replace('usdimpact', '\\u0075sdimpact')}"`],
  ['folded', `uses: >-\n      ${target}`],
  ['literal', `uses: |-\n      ${target}`],
  ['explicit key', `? uses\n    : '${target}'`],
  ['scalar alias', `name: &reference '${target}'\n    uses: *reference`],
]) rejectParsed(`reject new ${name} caller`, extraCaller(entry), /Unreviewed reusable-workflow caller/);
for (const [name, source] of [
  ['flow mapping', `jobs: {extra: {uses: '${target}'}}`],
  ['multiline flow', `jobs: {\n  extra: {\n    uses: '${target}'\n    }\n  }`],
  ['JSON', JSON.stringify({jobs: {extra: {uses: target}}})],
  ['quoted jobs', `"jobs": {"extra": {"uses": "${target}"}}`],
  ['BOM and CRLF', '\ufeff' + extraCaller(`uses: "${target}"`).replace(/\n/g, '\r\n')],
]) rejectParsed(`reject new ${name} caller`, source, /Unreviewed reusable-workflow caller/);
for (const [name, value] of [
  ['relative workflow', `./.github/workflows/${rehearsalRunner}`],
  ['dollar workflow', `$/.github/workflows/${rehearsalRunner}`],
  ['branch', target.replace(rehearsalRef, 'main')],
  ['tag', target.replace(rehearsalRef, 'v1')],
  ['expression', '${{ inputs.runner }}'],
  ['trailing newline', `|\n      ${target}`],
  ['split folded value', `>-\n      usdimpact/\n      usd-impact-site/.github/workflows/${rehearsalRunner}@${rehearsalRef}`],
  ['unpinned action', 'actions/checkout'],
  ['Docker action', 'docker://alpine:latest'],
]) rejectParsed(`reject unsupported ${name}`, extraCaller(`uses: ${value}`), /supported immutable reference/);
for (const [name, source] of [
  ['duplicate uses', extraCaller(`uses: '${target}'\n    uses: '${target}'`)],
  ['duplicate jobs', `jobs: {one: {uses: '${target}'}}\njobs: {two: {uses: '${target}'}}`],
  ['multiple documents', `jobs: {one: {uses: '${target}'}}\n---\njobs: {two: {uses: '${target}'}}`],
  ['invalid YAML', 'jobs: {'],
  ['unknown tag', extraCaller(`uses: !unknown '${target}'`)],
]) rejectParsed(`reject ${name}`, source, /invalid or unsupported workflow YAML/);
for (const [name, source, pattern] of [
  ['sequence reference', extraCaller(`uses: ['${target}']`), /reference must be a string/],
  ['mapping reference', extraCaller(`uses: {value: '${target}'}`), /reference must be a string/],
  ['jobs sequence', 'jobs: []', /jobs mapping/],
  ['steps mapping', 'jobs: {extra: {steps: {uses: anything}}}', /steps must be a sequence/],
  ['scalar job', 'jobs: {extra: nope}', /must be a mapping/],
  ['empty job', 'jobs: {extra: {}}', /must define a reusable call or steps/],
  ['merge key', `jobs: {extra: {<<: {uses: '${target}'}}}`, /unsupported merge/],
  ['cyclic alias', 'jobs: &jobs {extra: *jobs}', /cyclic or shared/],
  ['shared collection', `jobs: {a: &job {uses: '${target}'}, b: *job}`, /cyclic or shared/],
  ['mixed job', `jobs: {extra: {uses: '${target}', steps: []}}`, /cannot mix reusable/],
  ['reserved key', 'jobs: {extra: {constructor: anything}}', /reserved key/],
  ['empty document', '# comment only', /jobs mapping/],
  ['oversize document', '#'.repeat(1048577), /source limit/],
  ['capitalized key', `jobs: {extra: {Uses: '${target}'}}`, /noncanonical structural key/],
  ['nested executable group', `jobs: {extra: {steps: [{parallel: [{uses: '${target}'}]}]}}`, /unsupported executable step/],
  ['scalar step', 'jobs: {extra: {steps: [nope]}}', /step must be a mapping/],
  ['mapping run', 'jobs: {extra: {steps: [{run: {uses: anything}}]}}', /run must be a string/],
  ['structure limit', `jobs: {extra: {steps: [${'{run: echo},'.repeat(6000)}]}}`, /structure limit/],
]) rejectParsed(`reject ${name}`, source, pattern);
const checkout = `actions/checkout@${expectedActionRefs.get('actions/checkout')}`;
for (const [name, entry] of [
  ['quoted action', `uses: '${checkout}'`],
  ['escaped action key', `"u\\u0073es": "${checkout}"`],
  ['folded action', `uses: >-\n          ${checkout}`],
  ['literal action', `uses: |-\n          ${checkout}`],
]) parsedRegression(`accept reviewed ${name}`, () => {
  const source = `jobs:\n  extra:\n    steps:\n      - ${entry}\n`;
  assert.equal(validateParsedReferences(source, 'additional-action.yml').counts.get('actions/checkout'), 1);
});
parsedRegression('accept reviewed flow action', () => {
  assert.equal(validateParsedReferences(`jobs: {extra: {steps: [{uses: '${checkout}'}]}}`,
    'additional-action.yml').counts.get('actions/checkout'), 1);
});
parsedRegression('comments and shell strings do not create calls', () => {
  const source = `# uses: other/ignored@main\njobs:\n  extra:\n    steps:\n      - run: |\n          echo "uses: ${target}"\n          echo "jobs: {extra: {uses: untrusted}}"\n`;
  const result = validateParsedReferences(source, 'script-only.yml');
  assert.equal(result.reusableCount, 0);
  assert.equal([...result.counts.values()].reduce((sum, n) => sum + n, 0), 0);
});
parsedRegression('reviewed workflow cannot be used as an action', () => {
  assert.throws(() => validateParsedReferences(`jobs: {extra: {steps: [{uses: '${target}'}]}}`,
    rehearsalCaller), /must be a job/);
});
rejectParsed('action cannot be a reusable job', `jobs: {extra: {uses: '${checkout}'}}`, /unreviewed job-level/);
rejectParsed('unapproved quoted action is not missed', `jobs: {extra: {steps: [{uses: 'other/action@${'a'.repeat(40)}'}]}}`, /unapproved action/);
rejectParsed('action and run cannot be mixed', `jobs: {extra: {steps: [{uses: '${checkout}', run: echo}]}}`, /cannot mix action and run/);
if (hasRehearsal) parsedRegression('exact captured caller contains one call', () => {
  const source = checkedRehearsalSources.get(`.github/workflows/${rehearsalCaller}`).toString('utf8');
  assert.equal(validateParsedReferences(source, rehearsalCaller).reusableCount, 1);
});
console.log(`Parsed workflow references: ${parsedRegressionNames.length} regression groups passed (added-file text fixtures only).`);

const actionCounts = new Map([...expectedActionRefs.keys()].map((name) => [name, 0]));
let node24Count = 0;
let strictInstallCount = 0;

for (const workflowFile of workflowFiles) {
  const source = await readWorkflowSource(workflowFile, checkedRehearsalSources);

  assert.doesNotMatch(
    source,
    /ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION/,
    `${workflowFile} must not bypass the GitHub Actions runtime safety gate`,
  );

  const parsedReferences = validateParsedReferences(source, workflowFile);
  if (parsedReferences.reusableCount) {
    assert.ok(hasRehearsal, 'Reviewed rehearsal source evidence is required');
    reusableWorkflowCount += parsedReferences.reusableCount;
  }
  for (const [action, count] of parsedReferences.counts) {
    actionCounts.set(action, actionCounts.get(action) + count);
  }

  for (const match of source.matchAll(/^\s*node-version:\s*['\"]?([^'\"\s#]+)['\"]?/gm)) {
    assert.equal(match[1], '24.x', `${workflowFile} must use Node 24.x`);
    node24Count += 1;
  }

  for (const line of source.split('\n')) {
    if (!line.includes('npm ci')) continue;
    assert.match(
      line,
      /(?:^|\s)--strict-allow-scripts(?:\s|$)/,
      `${workflowFile} must fail closed on unreviewed dependency install scripts`,
    );
    strictInstallCount += 1;
  }
}

assert.equal(reusableWorkflowCount, hasRehearsal ? 1 : 0, 'Expected exactly one reviewed reusable-workflow call');

for (const [action, count] of actionCounts) {
  assert.ok(count > 0, `Expected at least one ${action} reference`);
}
assert.ok(node24Count > 0, 'Expected at least one explicit Node 24.x workflow runtime');
assert.ok(strictInstallCount > 0, 'Expected at least one strict npm ci workflow install');

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const expectedAllowScripts = {
  'esbuild@0.28.1': true,
  fsevents: false,
};
assert.deepEqual(
  packageJson.allowScripts,
  expectedAllowScripts,
  'Dependency install scripts must remain the reviewed allow/deny policy',
);
for (const [packageSpec, policy] of Object.entries(packageJson.allowScripts ?? {})) {
  assert.ok(typeof policy === 'boolean', `${packageSpec} install-script policy must be boolean`);
  if (policy === true) {
    assert.match(
      packageSpec,
      /^(?:@[^/\s]+\/[^@\s]+|[^@\s]+)@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
      `${packageSpec} approval must pin an exact package version`,
    );
  } else {
    assert.match(
      packageSpec,
      /^(?:@[^/\s]+\/[^@\s]+|[^@\s]+)$/,
      `${packageSpec} denial must apply name-wide`,
    );
  }
}

const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.equal(
  vercel.installCommand,
  'npm ci --no-audit --no-fund --strict-allow-scripts',
  'Vercel installs must fail closed on unreviewed dependency install scripts',
);

console.log(
  `GitHub Action supply-chain tests passed (${workflowFiles.length} workflows, ` +
    `${[...actionCounts.entries()].map(([action, count]) => `${count} ${action}`).join(', ')}, ` +
    `${reusableWorkflowCount} reviewed reusable workflow, ${node24Count} Node 24.x declarations, ${strictInstallCount} strict npm ci installs, ` +
    `${Object.values(expectedAllowScripts).filter(Boolean).length} approved and ` +
    `${Object.values(expectedAllowScripts).filter((value) => value === false).length} denied install-script package).`,
);
