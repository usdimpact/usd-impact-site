// OFFLINE PROTOTYPE ONLY. A signed metadata receipt is not a task authorization.
// No GitHub API access, issue body/title, persistent state, or privileged operations.
import { createHash, verify, KeyObject } from 'node:crypto';

export const VERSION = 1;
export const AUDIENCE = 'usdimpact-claude-stage3-metadata-review-v1';
export const ISSUER = 'usdimpact-trusted-read-adapter-v1';
export const REPOSITORY_ID = 1265351071;
export const REPOSITORY = 'usdimpact/usd-impact-site';
export const EXPECTED_WORKFLOW_REF =
  'usdimpact/usd-impact-site/.github/workflows/claude-stage3-provenance.yml@refs/heads/main';
const MAX_RECEIPT_AGE_MS = 5 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 30 * 1000;
const PAYLOAD_KEYS = Object.freeze([
  'schema_version', 'audience', 'issuer', 'source_type', 'repository_id',
  'repository', 'issue_number', 'issue_id', 'source_updated_at', 'source_digest',
  'observed_at', 'expires_at', 'workflow_ref', 'workflow_sha', 'run_id', 'nonce',
]);
const RECEIPT_KEYS = Object.freeze(['payload', 'signature']);
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const NONCE_PATTERN = /^[0-9a-f]{32}$/;
const TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function exactRecord(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) return false;
  const present = Reflect.ownKeys(value);
  if (present.length !== keys.length) return false;
  for (const key of present) {
    if (typeof key !== 'string' || !keys.includes(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return false;
  }
  return true;
}

function isoMillis(value) {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

// Deliberately excludes issue titles, bodies, author emails, labels and arbitrary URLs.
export function digestMinimalSource(source) {
  const { repository_id, issue_number, issue_id, source_updated_at } = source;
  const tuple = JSON.stringify([repository_id, issue_number, issue_id, source_updated_at]);
  return createHash('sha256').update(tuple, 'utf8').digest('hex');
}

// Exact canonical bytes: no ambiguous property order, no user-provided serializer.
export function canonicalReceiptBytes(payload) {
  return Buffer.from(JSON.stringify(PAYLOAD_KEYS.map(key => payload[key])), 'utf8');
}

function outcome(allowed, issueNumber = null) {
  return Object.freeze({
    schema_version: VERSION,
    recommendation: allowed ? 'REVIEW_ONLY' : 'HOLD',
    reason_code: allowed ? 'SIGNED_METADATA_ONLY_OWNER_REVIEW' : 'INVALID_OR_UNTRUSTED_RECEIPT',
    issue_number: allowed ? issueNumber : null,
    human_review_required: true,
    side_effects: 'NONE',
  });
}

// Trusted context must be sourced OUTSIDE the receipt. This function cannot
// authenticate a live GitHub fetch or the identity of the adapter by itself.
export function reviewOfflineProvenance(receipt, trustedContext) {
  try {
    if (!exactRecord(trustedContext, ['public_key', 'now_ms', 'workflow_sha', 'run_id', 'nonce'])) return outcome(false);
    if (!(trustedContext.public_key instanceof KeyObject) ||
        trustedContext.public_key.type !== 'public' ||
        trustedContext.public_key.asymmetricKeyType !== 'ed25519' ||
        !Number.isSafeInteger(trustedContext.now_ms) || trustedContext.now_ms < 0 ||
        typeof trustedContext.workflow_sha !== 'string' || !SHA_PATTERN.test(trustedContext.workflow_sha) ||
        !Number.isSafeInteger(trustedContext.run_id) || trustedContext.run_id < 1 ||
        typeof trustedContext.nonce !== 'string' || !NONCE_PATTERN.test(trustedContext.nonce)) return outcome(false);
    if (!exactRecord(receipt, RECEIPT_KEYS) || !exactRecord(receipt.payload, PAYLOAD_KEYS)) return outcome(false);
    const p = receipt.payload;
    if (p.schema_version !== VERSION || p.audience !== AUDIENCE || p.issuer !== ISSUER ||
        p.source_type !== 'github_issue_metadata' || p.repository_id !== REPOSITORY_ID ||
        p.repository !== REPOSITORY ||
        !Number.isSafeInteger(p.issue_number) || p.issue_number < 1 || p.issue_number > 2147483647 ||
        !Number.isSafeInteger(p.issue_id) || p.issue_id < 1 ||
        typeof p.source_digest !== 'string' || !SHA256_PATTERN.test(p.source_digest) ||
        typeof p.workflow_sha !== 'string' || p.workflow_sha !== trustedContext.workflow_sha ||
        p.workflow_ref !== EXPECTED_WORKFLOW_REF || p.run_id !== trustedContext.run_id ||
        p.nonce !== trustedContext.nonce) return outcome(false);
    const updated = isoMillis(p.source_updated_at);
    const observed = isoMillis(p.observed_at);
    const expires = isoMillis(p.expires_at);
    if (updated === null || observed === null || expires === null ||
        updated > observed || observed > trustedContext.now_ms + MAX_CLOCK_SKEW_MS ||
        observed < trustedContext.now_ms - MAX_RECEIPT_AGE_MS ||
        expires <= trustedContext.now_ms || expires <= observed ||
        expires > observed + MAX_RECEIPT_AGE_MS ||
        p.source_digest !== digestMinimalSource(p)) return outcome(false);
    if (typeof receipt.signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(receipt.signature)) return outcome(false);
    const sig = Buffer.from(receipt.signature, 'base64url');
    if (sig.length !== 64 || sig.toString('base64url') !== receipt.signature ||
        !verify(null, canonicalReceiptBytes(p), trustedContext.public_key, sig)) return outcome(false);
    return outcome(true, p.issue_number);
  } catch {
    // Includes adversarial Proxies and getters; never throw into a scheduler.
    return outcome(false);
  }
}
