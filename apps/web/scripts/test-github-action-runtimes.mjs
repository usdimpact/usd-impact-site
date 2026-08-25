import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const workflowsDirectory = new URL('../../../.github/workflows/', import.meta.url);
const workflowFiles = (await readdir(workflowsDirectory))
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();

assert.ok(workflowFiles.length > 0, 'Expected at least one GitHub Actions workflow');

const expectedActionRefs = new Map([
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1'],
  ['actions/setup-node', '820762786026740c76f36085b0efc47a31fe5020'],
  ['actions/upload-artifact', '043fb46d1a93c77aae656e7c1c64a875d1fc6a0a'],
  ['github/codeql-action', 'db488ddef3bf6cb639b32c2e9a7c0a7ea8271d28'],
  ['actions/dependency-review-action', 'a1d282b36b6f3519aa1f3fc636f609c47dddb294'],
]);
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

  for (const match of source.matchAll(/uses:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\/[A-Za-z0-9_./-]+)?@([^\s#]+)/g)) {
    const [, action, ref] = match;
    assert.ok(expectedActionRefs.has(action), `${workflowFile} uses unapproved action ${action}`);
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
    `${node24Count} Node 24.x declarations, ${strictInstallCount} strict npm ci installs, ` +
    `${Object.values(expectedAllowScripts).filter(Boolean).length} approved and ` +
    `${Object.values(expectedAllowScripts).filter((value) => value === false).length} denied install-script package).`,
);
