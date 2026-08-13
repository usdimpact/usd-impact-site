import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  adaptAuthenticatedPaddleAudit,
  adaptAuthenticatedVercelAudit,
} from './release-gatekeeper-audit-adapters.mjs';
import { parseReleaseEvidence } from './release-gatekeeper-evidence.mjs';
import { buildReleaseEvidenceEnvelope } from './release-gatekeeper-producers.mjs';

const shaPattern = /^[0-9a-f]{40}$/;
const recordKeys = new Set(['gate', 'status', 'source', 'ref', 'observed_at', 'release_head']);

function assertExactKeys(value, allowed, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  assert.deepEqual(unexpected, [], `${label} contains unsupported fields: ${unexpected.join(', ')}`);
}

function validateRecord(record, { gate, sources, releaseHead, label }) {
  assertExactKeys(record, recordKeys, label);
  assert.equal(record.gate, gate, `${label} has wrong gate`);
  assert.equal(record.status, 'verified', `${label} must be verified`);
  assert.ok(sources.includes(record.source), `Unsupported ${label} source`);
  assert.equal(record.release_head, releaseHead, `${label} release SHA mismatch`);
  assert.equal(typeof record.ref, 'string', `${label} ref must be a string`);
  assert.match(record.ref, /^[A-Za-z0-9][A-Za-z0-9._:/#-]{2,199}$/, `${label} ref format is invalid`);
  assert.ok(Number.isFinite(Date.parse(record.observed_at)), `${label} observed_at must be a valid timestamp`);
  return record;
}

function validateProductionDataPlaneRecord(record, releaseHead) {
  return validateRecord(record, {
    gate: 'production-data-plane',
    sources: ['supabase-api', 'github-audit'],
    releaseHead,
    label: 'Production data-plane record',
  });
}

function validateCommerceProviderRecord(record, releaseHead) {
  return validateRecord(record, {
    gate: 'commerce-provider-live',
    sources: ['commerce-provider-api', 'commerce-provider-dashboard', 'owner-visible-commerce-provider'],
    releaseHead,
    label: 'Commerce-provider record',
  });
}

export function assembleReleaseEvidence({
  releaseHead,
  vercelAudit,
  paddleAudit = null,
  commerceProviderRecord = null,
  productionDataPlaneRecord,
  now = Date.now(),
}) {
  assert.match(releaseHead, shaPattern, 'releaseHead must be a full lowercase SHA');

  const records = [
    ...adaptAuthenticatedVercelAudit(vercelAudit, { releaseHead }),
  ];

  if (paddleAudit) records.push(...adaptAuthenticatedPaddleAudit(paddleAudit, { releaseHead }));
  if (commerceProviderRecord) records.push(validateCommerceProviderRecord(commerceProviderRecord, releaseHead));
  records.push(validateProductionDataPlaneRecord(productionDataPlaneRecord, releaseHead));

  const envelope = buildReleaseEvidenceEnvelope({ releaseHead, records });
  const parsed = parseReleaseEvidence(JSON.stringify(envelope), { expectedHead: releaseHead, now });

  assert.equal(parsed.gates.vercelProductionEnvironment, true, 'Vercel Production gate did not validate');
  assert.equal(parsed.gates.checkoutClosed, true, 'Checkout CLOSED gate did not validate');
  assert.equal(parsed.gates.productionDataPlane, true, 'Production data-plane gate did not validate');
  if (paddleAudit || commerceProviderRecord) {
    assert.equal(parsed.gates.commerceProviderLive, true, 'Commerce-provider gate did not validate');
  }

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
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} must be readable valid JSON: ${error.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const releaseHead = args['release-head'];
  assert.match(releaseHead ?? '', shaPattern, '--release-head must be a full lowercase SHA');

  const vercelAudit = await readJsonFile(args.vercel, 'Vercel audit');
  const productionDataPlaneRecord = await readJsonFile(args['production-data-plane'], 'Production data-plane record');
  const paddleAudit = args.paddle ? await readJsonFile(args.paddle, 'Paddle audit') : null;
  const commerceProviderRecord = args['commerce-provider']
    ? await readJsonFile(args['commerce-provider'], 'Commerce-provider record')
    : null;

  const envelope = assembleReleaseEvidence({
    releaseHead,
    vercelAudit,
    paddleAudit,
    commerceProviderRecord,
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
