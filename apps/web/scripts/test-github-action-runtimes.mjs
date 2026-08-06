import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const workflowsDirectory = new URL('../../../.github/workflows/', import.meta.url);
const workflowFiles = (await readdir(workflowsDirectory))
  .filter((name) => /\.ya?ml$/i.test(name))
  .sort();

assert.ok(workflowFiles.length > 0, 'Expected at least one GitHub Actions workflow');

let checkoutV7Count = 0;
let setupNodeV7Count = 0;

for (const workflowFile of workflowFiles) {
  const source = await readFile(new URL(workflowFile, workflowsDirectory), 'utf8');

  assert.doesNotMatch(
    source,
    /actions\/checkout@v[1-6]\b/,
    `${workflowFile} must use actions/checkout@v7 or newer`,
  );
  assert.doesNotMatch(
    source,
    /actions\/setup-node@v[1-6]\b/,
    `${workflowFile} must use actions/setup-node@v7 or newer`,
  );
  assert.doesNotMatch(
    source,
    /ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION/,
    `${workflowFile} must not bypass the GitHub Actions runtime safety gate`,
  );

  checkoutV7Count += (source.match(/actions\/checkout@v7\b/g) ?? []).length;
  setupNodeV7Count += (source.match(/actions\/setup-node@v7\b/g) ?? []).length;
}

assert.ok(checkoutV7Count > 0, 'Expected at least one actions/checkout@v7 reference');
assert.ok(setupNodeV7Count > 0, 'Expected at least one actions/setup-node@v7 reference');

console.log(
  `GitHub Action runtime tests passed (${workflowFiles.length} workflows, ` +
    `${checkoutV7Count} checkout and ${setupNodeV7Count} setup-node references).`,
);
