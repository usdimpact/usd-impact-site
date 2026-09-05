import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA_VERSION, sha256 } from './integrity-watchdog-policy.mjs';

export function serializeJsonArtifact(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function writeJsonArtifact(file, value) {
  const serialized = serializeJsonArtifact(value);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, serialized, 'utf8');
  return serialized;
}

export function verifyReportManifest({ reportFile, manifest }) {
  const persistedReportSha256 = sha256(fs.readFileSync(reportFile, 'utf8'));
  if (persistedReportSha256 !== manifest.report_sha256) {
    throw new Error(`Evidence manifest report digest mismatch: expected ${manifest.report_sha256}, observed ${persistedReportSha256}.`);
  }
  return persistedReportSha256;
}

export function writeEvidenceArtifacts({ outputDir, report, workflowRegister, results, packets, generatedAt, reportMarkdown }) {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outputDir, 'fix-ready'), { recursive: true });

  const reportFile = path.join(outputDir, 'report.json');
  const reportJson = writeJsonArtifact(reportFile, report);
  writeJsonArtifact(path.join(outputDir, 'workflow-register.json'), workflowRegister);

  const manifest = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    report_sha256: sha256(reportJson),
    contract_evidence_digests: Object.fromEntries(results.map((entry) => [entry.id, entry.evidence_digest])),
    secret_values_persisted: false,
  };
  writeJsonArtifact(path.join(outputDir, 'evidence-manifest.json'), manifest);

  for (const packet of packets) writeJsonArtifact(path.join(outputDir, 'fix-ready', `${packet.id}.json`), packet);
  fs.writeFileSync(path.join(outputDir, 'report.md'), reportMarkdown, 'utf8');

  verifyReportManifest({ reportFile, manifest });
  return { manifest, report_sha256: manifest.report_sha256 };
}
