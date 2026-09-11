import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { verifyProgressEmailQaSourceArtifact } from '../src/lib/progress-email-qa-source-artifact.js';

const artifactPath = path.join(
  process.cwd(),
  'dist',
  'newsletter',
  'progress',
  '2026-09-04.json',
);
assert.equal(fs.existsSync(artifactPath), true, `Missing built artifact: ${artifactPath}`);

const raw = fs.readFileSync(artifactPath, 'utf8');
const artifact = verifyProgressEmailQaSourceArtifact(JSON.parse(raw));
assert.equal(artifact.payload.weekEnding, '2026-09-04');
assert.equal(artifact.payload.currentWeeklyReport.status, 'published');
assert.equal(artifact.payload.currentWeeklyReport.category, 'Weekly USD Impact Brief');
assert.equal(artifact.payload.sourceReports.length >= 1, true);
assert.equal(
  artifact.payload.sourceReports.some((source) => source.periodEnd === '2026-09-04'),
  true,
);
assert.match(artifact.checksum, /^[0-9a-f]{64}$/);

console.log('Built Progress QA source artifact contract passed.');
