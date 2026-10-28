import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

assert.equal(
  pkg.overrides?.['@vercel/cli-config']?.zod,
  '4.6.7',
  'The Vercel cli-config Zod override must remain pinned to the reviewed patched version.',
);

// npm may materialize the overridden package either beneath @vercel/cli-config
// or hoist it to the root when the dependency graph permits deduplication.
// Both layouts are safe only when the effective lock entry is the reviewed
// patched Zod build.
const nested = lock.packages?.['node_modules/@vercel/cli-config/node_modules/zod'];
const hoisted = lock.packages?.['node_modules/zod'];
const effective = nested || hoisted;
assert.ok(effective, 'Expected an effective Zod lock entry for the Vercel cli-config override.');
assert.equal(effective.version, '4.6.7');
assert.equal(effective.resolved, 'https://registry.npmjs.org/zod/-/zod-4.6.7.tgz');
assert.equal(
  effective.integrity,
  'sha512-g8W2D2kU6a8untc053fX1uVBKzM7yqAxW/3zwk83+6RyF2+SKOuV+c0wBDhUwzV1PaGapmZH+rmcUzPf+3CGwg==',
);

const vulnerable = Object.entries(lock.packages || {})
  .filter(([entryPath, meta]) => (
    entryPath === 'node_modules/@vercel/cli-config/node_modules/zod'
    || entryPath === 'node_modules/zod'
  ) && meta?.version === '4.1.11');

assert.deepEqual(
  vulnerable,
  [],
  'The effective Vercel cli-config Zod resolution must not contain vulnerable Zod 4.1.11.',
);

console.log(
  `Vercel cli-config Zod supply-chain override contract passed (${nested ? 'nested' : 'hoisted'} layout).`,
);
