import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

// Already installed by the reviewed lockfile; no network or fallback parser.
const require = createRequire(import.meta.url);
assert.equal(require('js-yaml/package.json').version, '4.3.2', 'Review YAML parser version changes');
const { load, FAILSAFE_SCHEMA } = require('js-yaml');
import { runReusableWorkflowPolicyRegressions } from './test-github-action-reusable-workflow.mjs';

const expectedActionRefs = new Map([
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1'],
  ['actions/setup-node', '820762786026740c76f36085b0efc47a31fe5020'],
  ['actions/upload-artifact', '043fb46d1a93c77aae656e7c1c64a875d1fc6a0a'],
  ['github/codeql-action', 'cdf488f595d80d6e07e03d4674febd5ab45fa938'],
  ['actions/dependency-review-action', 'a1d282b36b6f3519aa1f3fc636f609c47dddb294'],
]);
// This is a single reviewed workflow exception, not a repository-wide action grant.
// Changing either workflow requires explicit review and new source fingerprints.
const reviewedCaller = 'publication-oidc-rehearsal-controller.yml';
const reviewedRunnerCommit = 'e0dda44455cdc6742fba2755b84f9997fecf2b7f';
const reviewedWorkflowHashes = new Map([
  [reviewedCaller, 'ddff1841c02e28bc96aef9dbfe327856019c9a13258cbe7e3c7084460297d0fd'],
  ['publication-oidc-rehearsal-runner.yml', '56ac13fc3cc5d8fb45f5b9c18526f05e8e8cda71f2003f84eaf83a2c6c0beb2f'],
]);

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
      check(child, depth + 1);
    }
  }
  check(document);
  assert.ok(mapping(document) && mapping(document.jobs) && Object.keys(document.jobs).length > 0,
    `${filename} must have a jobs mapping`);
  const references = [];
  for (const [id, job] of Object.entries(document.jobs)) {
    assert.ok(mapping(job), `${filename} job ${id} must be a mapping`);
    if (Object.hasOwn(job, 'uses')) {
      assert.equal(typeof job.uses, 'string', `${filename} reusable reference must be a string`);
      assert.ok(!Object.hasOwn(job, 'steps'), `${filename} cannot mix reusable jobs and steps`);
      references.push({ value: job.uses, kind: 'workflow' });
    }
    if (!Object.hasOwn(job, 'steps')) continue;
    assert.ok(Array.isArray(job.steps), `${filename} steps must be a sequence`);
    for (const step of job.steps) {
      assert.ok(mapping(step), `${filename} step must be a mapping`);
      if (!Object.hasOwn(step, 'uses')) continue;
      assert.equal(typeof step.uses, 'string', `${filename} action reference must be a string`);
      assert.ok(!Object.hasOwn(step, 'run'), `${filename} cannot mix action and run in a step`);
      references.push({ value: step.uses, kind: 'action' });
    }
  }
  return references;
}

function validateWorkflowSources(workflowSources) {
  assert.ok(workflowSources.size > 0, 'Expected at least one GitHub Actions workflow');
  const hasRehearsal = [...reviewedWorkflowHashes.keys()].some((name) => workflowSources.has(name));
  if (hasRehearsal) {
    for (const [name, digest] of reviewedWorkflowHashes) {
      const source = workflowSources.get(name);
      assert.equal(typeof source, 'string', `Missing reviewed rehearsal workflow ${name}`);
      assert.equal(createHash('sha256').update(source, 'utf8').digest('hex'), digest,
        `${name} differs from the reviewed rehearsal workflow`);
    }
  }
  const actionCounts = new Map([...expectedActionRefs.keys()].map((name) => [name, 0]));
  let node24Count = 0;
  let strictInstallCount = 0;
  let reusableWorkflowCount = 0;

  for (const [workflowFile, source] of workflowSources) {

    assert.doesNotMatch(
      source,
      /ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION/,
      `${workflowFile} must not bypass the GitHub Actions runtime safety gate`,
    );

    for (const { value, kind } of workflowReferences(source, workflowFile)) {
      const match = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)((?:\/[A-Za-z0-9_./-]+)?)@([a-f0-9]{40})$/.exec(value);
      assert.ok(match && match[0] === value, `${workflowFile} must use a supported immutable workflow/action reference`);
      const [, action, subpath, ref] = match;
      if (action === 'usdimpact/usd-impact-site') {
        assert.equal(kind, 'workflow', 'Reviewed reusable workflow must be a job, not an action');
        assert.equal(workflowFile, reviewedCaller, 'Reusable workflow is restricted to the reviewed caller');
        assert.equal(subpath, '/.github/workflows/publication-oidc-rehearsal-runner.yml',
          'Reusable workflow must use the reviewed runner path');
        assert.equal(ref, reviewedRunnerCommit, 'Reusable workflow must use the reviewed immutable commit');
        reusableWorkflowCount += 1;
        continue;
      }
      assert.ok(expectedActionRefs.has(action), `${workflowFile} uses unapproved action ${action}`);
      assert.equal(kind, 'action', `${workflowFile} uses an unreviewed reusable workflow`);
      assert.match(ref, /^[0-9a-f]{40}$/, `${workflowFile} must pin ${action} to an immutable 40-char SHA`);
      assert.equal(
        ref,
        expectedActionRefs.get(action),
        `${workflowFile} must use the reviewed ${action} SHA`,
      );
      actionCounts.set(action, actionCounts.get(action) + 1);
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

  for (const [action, count] of actionCounts) {
    assert.ok(count > 0, `Expected at least one ${action} reference`);
  }
  assert.ok(node24Count > 0, 'Expected at least one explicit Node 24.x workflow runtime');
  assert.ok(strictInstallCount > 0, 'Expected at least one strict npm ci workflow install');

  assert.equal(reusableWorkflowCount, hasRehearsal ? 1 : 0, 'Expected exactly one reviewed reusable call');
  return { actionCounts, node24Count, strictInstallCount, reusableWorkflowCount };
}

const workflowsDirectory = new URL('../../../.github/workflows/', import.meta.url);
const workflowFiles = (await readdir(workflowsDirectory)).filter((name) => /\.ya?ml$/i.test(name)).sort();
const workflowSources = new Map(await Promise.all(workflowFiles.map(async (name) =>
  [name, await readFile(new URL(name, workflowsDirectory), 'utf8')])));
const { actionCounts, node24Count, strictInstallCount, reusableWorkflowCount } = validateWorkflowSources(workflowSources);
const regressionCount = runReusableWorkflowPolicyRegressions(validateWorkflowSources, workflowSources);

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
    `${reusableWorkflowCount} reviewed reusable workflow, ${regressionCount} reusable-policy regression groups, ` +
    `${node24Count} Node 24.x declarations, ${strictInstallCount} strict npm ci installs, ` +
    `${Object.values(expectedAllowScripts).filter(Boolean).length} approved and ` +
    `${Object.values(expectedAllowScripts).filter((value) => value === false).length} denied install-script package).`,
);
