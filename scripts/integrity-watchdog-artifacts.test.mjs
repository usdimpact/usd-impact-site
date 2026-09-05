import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256 } from './integrity-watchdog-policy.mjs';
import { verifyReportManifest, writeEvidenceArtifacts } from './integrity-watchdog-artifacts.mjs';

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'watchdog-artifacts-'));
const generatedAt = '2026-09-05T00:00:00.000Z';
const report = {
  schema_version: 1,
  generated_at: generatedAt,
  health: { status: 'AMBER' },
  nested: { pretty_printed: true },
};
const workflowRegister = [{ id: 'WF', current_classification: 'B_FUNCTIONAL' }];
const results = [{ id: 'CONTRACT', evidence_digest: 'evidence-digest-test' }];
const packets = [{ id: 'FIX-CONTRACT', status: 'PROPOSED_ONLY' }];

try {
  const written = writeEvidenceArtifacts({
    outputDir,
    report,
    workflowRegister,
    results,
    packets,
    generatedAt,
    reportMarkdown: '# Test report\n',
  });

  const reportFile = path.join(outputDir, 'report.json');
  const manifestFile = path.join(outputDir, 'evidence-manifest.json');
  const reportBytes = fs.readFileSync(reportFile, 'utf8');
  const persistedManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));

  assert.equal(written.manifest.report_sha256, sha256(reportBytes));
  assert.equal(persistedManifest.report_sha256, sha256(reportBytes));
  assert.equal(verifyReportManifest({ reportFile, manifest: persistedManifest }), persistedManifest.report_sha256);
  assert.match(reportBytes, /\n  "nested": \{\n/);
  assert.ok(reportBytes.endsWith('\n'));

  fs.appendFileSync(reportFile, ' ', 'utf8');
  assert.throws(
    () => verifyReportManifest({ reportFile, manifest: persistedManifest }),
    /Evidence manifest report digest mismatch/,
  );
} finally {
  fs.rmSync(outputDir, { recursive: true, force: true });
}

console.log('USD Impact watchdog artifact-manifest integrity tests passed.');
