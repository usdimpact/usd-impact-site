import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  adaptAuthenticatedPaddleAudit,
  adaptAuthenticatedVercelAudit,
} from './release-gatekeeper-audit-adapters.mjs';
import { parseReleaseEvidence } from './release-gatekeeper-evidence.mjs';
import { buildReleaseEvidenceEnvelope } from './release-gatekeeper-producers.mjs';

const shaPattern = /^[0-9a-f]{40}$/;
const dataPlaneKeys = new Set(['gate', 'status', 'source', 'ref', 'observed_at', 'release_head']);

function assertExactKeys(value, allowed, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  assert.deepEqual(unexpected, [], `${label} contains unsupported fields: ${unexpected.join(', ')}`);
}

function validateProductionDataPlaneRecord(record, releaseHead) {
  assertExactKeys(record, dataPlaneKeys, 'Production data-plane record');
  assert.equal(record.gate, 'production-data-plane', 'Production data-plane record has wrong gate');
  assert.equal(record.status, 'verified', 'Production data-plane record must be verified');
  assert.ok(['supabase-api', 'github-audit'].includes(record.source), 'Unsupported Production data-plane source');
  assert.equal(record.release_head, releaseHead, 'Production data-plane record release SHA mismatch');
  assert.equal(typeof record.ref, 'string', 'Production data-plane record ref must be a string');
  assert.match(record.ref, /^[A-Za-z0-9][A-Za-z0-9._:/#-]{2,199}$/, 'Production data-plane record ref format is invalid');
  assert.ok(Number.isFinite(Date.parse(record.observed_at)), 'Production data-plane observed_at must be a valid timestamp');
  return record;
}

export function assembleReleaseEvidence({ releaseHead, vercelAudit, paddleAudit, productionDataPlaneRecord, now = Date.now() }) {
  assert.match(releaseHead, shaPattern, 'releaseHead must be a full lowercase SHA');

  const vercelRecords = adaptAuthenticatedVercelAudit(vercelAudit, { releaseHead });
  const paddleRecords = adaptAuthenticatedPaddleAudit(paddleAudit, { releaseHead });
  const dataPlaneRecord = validateProductionDataPlaneRecord(productionDataPlaneRecord, releaseHead);

  const envelope = buildReleaseEvidenceEnvelope({
    releaseHead,
    records: [...vercelRecords, ...paddleRecords, dataPlaneRecord],
  });

  const parsed = parseReleaseEvidence(JSON.stringify(envelope), { expectedHead: releaseHead, now });
  assert.equal(parsed.gates.vercelProductionEnvironment, true, 'Vercel Production gate did not validate');
  assert.equal(parsed.gates.checkoutClosed, true, 'Checkout CLOSED gate did not validate');
  assert.equal(parsed.gates.paddleLive, true, 'Paddle Live gate did not validate');
  assert.equal(parsed.gates.productionDataPlane, true, 'Production data-plane gate did not validate');

  return envelope;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    args[key.slice(2)] = value;
    index += 1;
  }
  return args;
}

async function readJsonFile(path, label) {
  assert.equal(typeof path, 'string', `${label} path is required`);
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} must be readable valid JSON: ${error.message}`);
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const releaseHead = args['release-head'];
  assert.match(releaseHead ?? '', shaPattern, '--release-head must be a full lowercase SHA');

  const [vercelAudit, paddleAudit, productionDataPlaneRecord] = await Promise.all([
    readJsonFile(args.vercel, 'Vercel audit'),
    readJsonFile(args.paddle, 'Paddle audit'),
    readJsonFile(args['production-data-plane'], 'Production data-plane record'),
  ]);

  const envelope = assembleReleaseEvidence({
    releaseHead,
    vercelAudit,
    paddleAudit,
    productionDataPlaneRecord,
  });

  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`Release evidence assembly failed: ${error.message}`);
    process.exitCode = 1;
  });
}
