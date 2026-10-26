import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

assert.equal(
  pkg.overrides?.['@vercel/cli-config']?.zod,
  '4.6.7',
  'The Vercel cli-config Zod override must remain pinned to the reviewed patched version.',
);

const nested = lock.packages?.['node_modules/@vercel/cli-config/node_modules/zod'];
assert.ok(nested, 'Expected Vercel cli-config nested Zod lock entry.');
assert.equal(nested.version, '4.6.7');
assert.equal(nested.resolved, 'https://registry.npmjs.org/zod/-/zod-4.6.7.tgz');
assert.equal(
  nested.integrity,
  'sha512-g8W2D2kU6a8untc053fX1uVBKzM7yqAxW/3zwk83+6RyF2+SKOuV+c0wBDhUwzV1PaGapmZH+rmcUzPf+3CGwg==',
);

const vulnerable = Object.entries(lock.packages || {})
  .filter(([path]) => path.includes('@vercel/cli-config') && path.endsWith('/node_modules/zod'))
  .filter(([, meta]) => meta?.version === '4.1.11');

assert.deepEqual(vulnerable, [], 'Vercel cli-config must not resolve the vulnerable Zod 4.1.11 lock entry.');

console.log('Vercel cli-config Zod supply-chain override contract passed.');
