import assert from 'node:assert/strict';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

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
// This is a narrow compatibility rule, not a general-purpose YAML parser.
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

function validateRehearsalSources(sources) {
  assert.equal(sources.size, rehearsalSources.size, 'Incomplete rehearsal source evidence');
  for (const [path, digest] of rehearsalSources) {
    const source = sources.get(path);
    assert.ok(Buffer.isBuffer(source), `Missing reviewed rehearsal source: ${path}`);
    assert.equal(createHash('sha256').update(source).digest('hex'), digest,
      `Rehearsal source changed; explicit re-review required: ${path}`);
  }
}

const hasRehearsal = workflowFiles.includes(rehearsalCaller) || workflowFiles.includes(rehearsalRunner);
const checkedRehearsalSources = new Map();
if (hasRehearsal) {
  assert.ok(workflowFiles.includes(rehearsalCaller) && workflowFiles.includes(rehearsalRunner),
    'Both reviewed rehearsal workflows are required');
  for (const path of rehearsalSources.keys()) {
    const file = new URL(`../../../${path}`, import.meta.url);
    assert.ok((await lstat(file)).isFile(), `Rehearsal source must be a regular file: ${path}`);
    checkedRehearsalSources.set(path, await readFile(file));
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

const actionCounts = new Map([...expectedActionRefs.keys()].map((name) => [name, 0]));
let node24Count = 0;
let strictInstallCount = 0;

for (const workflowFile of workflowFiles) {
  const source = await readFile(new URL(workflowFile, workflowsDirectory), 'utf8');

  assert.doesNotMatch(
    source,
    /ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION/,
    `${workflowFile} must not bypass the GitHub Actions runtime safety gate`,
  );

  for (const match of source.matchAll(/uses:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(\/[A-Za-z0-9_./-]+)?@([^\s#]+)/g)) {
    const [, action, path = '', ref] = match;
    const kind = validateReference(workflowFile, `${action}${path}`, ref);
    if (kind === 'reviewed-reusable-workflow') {
      assert.ok(hasRehearsal, 'Reviewed rehearsal source evidence is required');
      reusableWorkflowCount += 1;
    } else {
      actionCounts.set(kind, actionCounts.get(kind) + 1);
    }
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
