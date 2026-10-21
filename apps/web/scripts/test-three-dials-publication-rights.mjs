import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Tests the actual scheduled generator without contacting providers or editing
// any published JSON. A future Friday prevents the immutable-archive no-op.
const generator = new URL('./generate-three-dials-snapshot.mjs', import.meta.url);
const workingDirectory = fileURLToPath(new URL('../', import.meta.url));
const futureArchive = new URL('../public/data/three-dials/archive/2031-01-03.json', import.meta.url);
const sourceLatest = new URL('../src/data/three-dials-latest.json', import.meta.url);
const publicLatest = new URL('../public/data/three-dials/latest.json', import.meta.url);

assert.equal(existsSync(futureArchive), false, 'Future test week must not be present');
const [beforeSource, beforePublic, generatorText] = await Promise.all([
  readFile(sourceLatest, 'utf8'),
  readFile(publicLatest, 'utf8'),
  readFile(generator, 'utf8'),
]);
assert.equal(beforeSource, beforePublic, 'Existing latest copies must be synchronized');
assert.ok(
  generatorText.indexOf('assertPublicThreeDialsRedistributionRights();') <
    generatorText.indexOf('const fredEntries = await Promise.all('),
  'Public rights gate must run before any provider requests',
);

const trial = spawnSync(process.execPath, [fileURLToPath(generator)], {
  cwd: workingDirectory,
  env: { ...process.env, THREE_DIALS_NOW: '2031-01-06T12:00:00.000Z' },
  encoding: 'utf8',
  timeout: 10_000,
  maxBuffer: 100_000,
});
assert.equal(trial.status, 1, 'New snapshot generation must fail closed');
assert.match(trial.stderr, /HOLD_THREE_DIALS_REDISTRIBUTION_RIGHTS/);
assert.match(trial.stderr, /DX-Y\.NYB/);
assert.match(trial.stderr, /BAMLH0A0HYM2/);
assert.match(trial.stderr, /VIXCLS/);
assert.match(trial.stderr, /issues\/845/);
assert.doesNotMatch(trial.stderr, /Source request failed|fetch failed|network/i);

const [afterSource, afterPublic] = await Promise.all([
  readFile(sourceLatest, 'utf8'),
  readFile(publicLatest, 'utf8'),
]);
assert.equal(afterSource, beforeSource, 'Source latest must remain untouched');
assert.equal(afterPublic, beforePublic, 'Public latest must remain untouched');
assert.equal(existsSync(futureArchive), false, 'No archive can be created on hold');
console.log('Three-Dials redistribution rights publication guard PASS (no network, no writes).');
