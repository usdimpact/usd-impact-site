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

// A draft HTML import could accidentally leak into another rendered HTML page
// or a public JS/data bundle even with getStaticPaths([]). Scan every generated
// public text asset for the candidate-only fingerprint, not only its intended URL.
const textExtensions = /\.(?:html|htm|js|mjs|json|xml|txt|css|map)$/i;
const fingerprints = [
  'data-release-candidate="draft"',
  'UNPUBLISHED RELEASE CANDIDATE',
  'Release Candidate • Draft only',
  '2026 — Draft Release Candidate (Unpublished)'
];
let scannedFiles = 0;
const scanOutput = (root) => {
  for (const entry of readdirSync(root, { withFileTypes:true })) {
    const target = new URL(encodeURIComponent(entry.name) + (entry.isDirectory() ? '/' : ''), root);
    if (entry.isDirectory()) {
      scanOutput(target);
    } else if (entry.isFile() && textExtensions.test(entry.name)) {
      const contents = readFileSync(target, 'utf8');
      scannedFiles++;
      for (const marker of fingerprints) {
        assert.ok(!contents.includes(marker),
          'FAIL-CLOSED: private release candidate leaked into a generated public text asset');
      }
    }
  }
};
scanOutput(dist);
assert.ok(scannedFiles > 0, 'FAIL-CLOSED: expected built public assets to inspect');

console.log('Independent Macro Weekly build guard: no public HTML path and no sitemap entry. Publication HOLD.');
