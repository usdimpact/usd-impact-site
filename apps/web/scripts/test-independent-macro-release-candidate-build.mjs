import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const candidatePath = new URL('macro-reviews/weekly/2026-10-30/index.html', dist);
const candidateDir = new URL('macro-reviews/weekly/2026-10-30/', dist);

assert.ok(existsSync(dist), 'Astro must build before the release-candidate output guard');
assert.equal(existsSync(candidatePath), false,
  'FAIL-CLOSED: Draft candidate was emitted as public static HTML');
assert.equal(existsSync(candidateDir), false,
  'FAIL-CLOSED: Draft candidate directory exists in public output');
const walkSitemaps = (root) => {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes:true })) {
    const child = new URL(encodeURIComponent(entry.name) + (entry.isDirectory() ? '/' : ''), root);
    if (entry.isDirectory()) files.push(...walkSitemaps(child));
    else if (/^sitemap.*\.xml$/i.test(entry.name)) files.push(child);
  }
  return files;
};
for (const xml of walkSitemaps(dist)) {
  const contents = readFileSync(xml, 'utf8');
  assert.ok(!contents.includes('/macro-reviews/weekly/2026-10-30'),
    'FAIL-CLOSED: unpublished independent Macro Weekly included in sitemap');
}
console.log('Independent Macro Weekly build guard: no public HTML path and no sitemap entry. Publication HOLD.');
