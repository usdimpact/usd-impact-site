import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const dir = new URL('../public/data/three-dials/archive/', import.meta.url);
const archives = (await readdir(dir)).filter((s) => s.endsWith('.json')).sort();
assert(archives.length >= 7, 'Historical archives must remain as dated hold notices');
const pub = await readFile(new URL('../public/data/three-dials/latest.json', import.meta.url), 'utf8');
const src = await readFile(new URL('../src/data/three-dials-latest.json', import.meta.url), 'utf8');
assert.equal(pub, src, 'Latest public and source files must be identical');
const allowed = ['version','status','week_ending','source_rights_state','hold_applied_at','message','scope','notice_url'].sort();

const verify = (raw, filename, week) => {
  const value = JSON.parse(raw);
  assert.deepEqual(Object.keys(value).sort(), allowed, filename + ' contains unscreened fields');
  assert.equal(value.version, 1, filename);
  assert.equal(value.status, 'pending', filename);
  assert.equal(value.week_ending, week, filename);
  assert.equal(value.source_rights_state, 'unverified', filename);
  assert.equal(value.hold_applied_at, '2026-10-21', filename);
  assert.match(value.message, /temporarily unavailable pending source-rights review/);
  assert.match(value.scope, /Numeric observations, historical comparisons/);
  assert.equal(value.notice_url, 'https://github.com/usdimpact/usd-impact-site/issues/845');
  for (const key of ['dials', 'facts', 'interpretation', 'model_output', 'latest', 'previous', 'change']) {
    assert(!Object.hasOwn(value, key), filename + ' leaked ' + key);
  }
};
for (const filename of archives) {
  assert.match(filename, /^20\d{2}-\d{2}-\d{2}\.json$/);
  verify(await readFile(new URL(filename, dir), 'utf8'), filename, filename.slice(0, -5));
}
verify(pub, 'latest.json', archives.at(-1).slice(0, -5));
console.log('Three Dials source-rights redaction PASS: '+archives.length+' historical archives plus synchronized latest.');
