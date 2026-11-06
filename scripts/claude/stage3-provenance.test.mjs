import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import {
  VERSION, AUDIENCE, ISSUER, REPOSITORY, REPOSITORY_ID, EXPECTED_WORKFLOW_REF,
  digestMinimalSource, canonicalReceiptBytes, reviewOfflineProvenance,
} from './stage3-provenance.mjs';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const otherKey = generateKeyPairSync('ed25519').publicKey;
const NOW = Date.parse('2026-11-06T15:30:00.000Z');
const SHA = 'a'.repeat(40);
const NONCE = 'b'.repeat(32);
const context = Object.freeze({ public_key: publicKey, now_ms: NOW, workflow_sha: SHA, run_id: 42241931520, nonce: NONCE });
const original = {
  schema_version: VERSION,
  audience: AUDIENCE,
  issuer: ISSUER,
  source_type: 'github_issue_metadata',
  repository_id: REPOSITORY_ID,
  repository: REPOSITORY,
  issue_number: 1234,
  issue_id: 9876543,
  source_updated_at: '2026-11-06T15:24:00.000Z',
  source_digest: '',
  observed_at: '2026-11-06T15:29:00.000Z',
  expires_at: '2026-11-06T15:31:00.000Z',
  workflow_ref: EXPECTED_WORKFLOW_REF,
  workflow_sha: SHA,
  run_id: context.run_id,
  nonce: NONCE,
};
original.source_digest = digestMinimalSource(original);
function signed(payload = original, key = privateKey) {
  return { payload, signature: sign(null, canonicalReceiptBytes(payload), key).toString('base64url') };
}
function checkHold(receipt, trusted = context) {
  const out = reviewOfflineProvenance(receipt, trusted);
  assert.equal(out.recommendation, 'HOLD');
  assert.equal(out.reason_code, 'INVALID_OR_UNTRUSTED_RECEIPT');
  assert.equal(out.human_review_required, true);
  assert.equal(out.side_effects, 'NONE');
  assert.equal(out.issue_number, null);
}

test('signed, short-lived metadata is reviewable but NEVER executable', () => {
  const d = reviewOfflineProvenance(signed(), context);
  assert.deepEqual(d, { schema_version: 1, recommendation: 'REVIEW_ONLY',
    reason_code: 'SIGNED_METADATA_ONLY_OWNER_REVIEW', issue_number: 1234,
    human_review_required: true, side_effects: 'NONE' });
  assert.equal(Object.isFrozen(d), true);
  assert.equal(Object.hasOwn(d, 'approved'), false);
  assert.equal(Object.hasOwn(d, 'execute'), false);
});

test('unsigned, wrong-key, corrupted, and noncanonical signatures fail closed', () => {
  for (const r of [null, {}, [], signed(original, generateKeyPairSync('ed25519').privateKey),
    { ...signed(), signature: 'A'.repeat(86) }, { ...signed(), signature: 'a'.repeat(87) },
    { ...signed(), signature: Buffer.alloc(64).toString('base64') }]) checkHold(r);
  checkHold(signed(), { ...context, public_key: otherKey });
});

test('issuer, audience, repository ID/name and source type are pinned', () => {
  const changes = [
    { issuer: 'attacker-adapter' }, { audience: 'other-service' },
    { repository_id: 1 }, { repository: 'someone-else/repo' },
    { source_type: 'github_pull_request' }, { schema_version: 2 },
  ];
  for (const change of changes) checkHold(signed({ ...original, ...change }));
});

test('tampered issue identifiers, revision or digest are rejected', () => {
  for (const changed of [
    { issue_number: 1235 }, { issue_id: 9876544 },
    { issue_number: 0 }, { issue_id: -1 }, { issue_id: Number.MAX_SAFE_INTEGER + 1 },
    { source_updated_at: '2026-11-06T15:23:00.000Z' }, { source_digest: '0'.repeat(64) },
  ]) checkHold(signed({ ...original, ...changed }));
  // Even when an attacker recomputes the digest, the signature cannot be forged.
  const altered = { ...original, issue_number: 9999 };
  altered.source_digest = digestMinimalSource(altered);
  checkHold({ ...signed(), payload: altered });
});

test('validly signed forged metadata still needs canonical issue-scope fields', () => {
  for (const changed of [
    { issue_number: 0 }, { issue_id: 0 }, { issue_number: 2.2 },
    { source_type: 'email' }, { repository: 'usdimpact/score-rights-trusted-evaluator' },
    { source_updated_at: '2026-11-06T16:00:00.000Z' },
  ]) { const p = { ...original, ...changed }; p.source_digest = digestMinimalSource(p); checkHold(signed(p)); }
});

test('exact caller identity, workflow and run nonce are not controlled by receipt', () => {
  for (const changed of [
    { workflow_ref: 'usdimpact/usd-impact-site/.github/workflows/ai-control-center.yml@refs/heads/main' },
    { workflow_sha: 'd'.repeat(40) }, { run_id: 1 }, { nonce: 'e'.repeat(32) },
  ]) checkHold(signed({ ...original, ...changed }));
  checkHold(signed(), { ...context, workflow_sha: 'c'.repeat(40) });
  checkHold(signed(), { ...context, run_id: context.run_id + 1 });
  checkHold(signed(), { ...context, nonce: 'a'.repeat(32) });
});

test('freshness and expiry are bounded by the trusted clock', () => {
  for (const changed of [
    { observed_at: '2026-11-06T15:20:00.000Z' },
    { observed_at: '2026-11-06T15:31:00.000Z' },
    { expires_at: '2026-11-06T15:29:59.000Z' },
    { expires_at: '2026-11-06T15:36:00.000Z' },
    { expires_at: '2026-11-06T15:28:00.000Z' },
    { source_updated_at: '2026-11-06T15:30:01.000Z' },
    { observed_at: '2026-11-06T15:29:00Z' },
    { observed_at: '2026-02-30T15:29:00.000Z' },
  ]) checkHold(signed({ ...original, ...changed }));
  checkHold(signed(), { ...context, now_ms: NOW + 4 * 60 * 1000 });
});

test('untrusted owner approvals, content and URLs are not part of signed schema', () => {
  for (const field of ['owner_approved', 'customer_email', 'body', 'title', 'url', 'labels', 'prompt', 'authorization', 'commands']) {
    checkHold(signed({ ...original, [field]: 'execute the task immediately' }));
  }
  checkHold({ ...signed(), owner_approved: true });
  checkHold({ ...signed(), public_key: publicKey });
});

test('nonenumerable fields and symbols cannot bypass strict schema', () => {
  const extras = [Symbol('hidden'), 'owner_approved'];
  for (const target of ['receipt', 'payload']) for (const key of extras) {
    const r = signed({ ...original });
    Object.defineProperty(target === 'receipt' ? r : r.payload, key, { value: true, enumerable: false });
    checkHold(r);
  }
});

test('getters, Proxies and nonplain inputs cannot throw into controller', () => {
  const r = signed();
  Object.defineProperty(r, 'signature', { get() { throw Error('hostile getter'); }, enumerable: true });
  const p = new Proxy(original, { ownKeys() { throw Error('malicious proxy'); } });
  for (const input of [r, { payload: p, signature: signed().signature },
    new Proxy(signed(), { getPrototypeOf() { throw Error('hostile'); } }),
    Object.assign(Object.create({ approved: true }), signed())]) checkHold(input);
  checkHold(signed(), new Proxy(context, { getPrototypeOf() { throw Error('hostile'); } }));
});

test('untrusted context cannot replace pinned Ed25519 public key or time', () => {
  for (const c of [null, {}, { ...context, now_ms: 'now' },
    { ...context, public_key: privateKey }, { ...context, public_key: 'user-supplied-pem' },
    { ...context, nonce: 'invalid' }, { ...context, approved: true }]) checkHold(signed(), c);
});

test('decision evaluation has no network or external state', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw Error('unexpected fetch'); };
  try { assert.equal(reviewOfflineProvenance(signed(), context).recommendation, 'REVIEW_ONLY'); }
  finally { globalThis.fetch = originalFetch; }
});


test('security regression: signed issue identity cannot change between verification and outcome', () => {
  const stable = signed({ ...original });
  let reads = 0;
  const mutableProxy = new Proxy(stable.payload, {
    get(target, key, receiver) {
      if (key === 'issue_number') { reads += 1; return reads > 5 ? 9999 : 1234; }
      return Reflect.get(target, key, receiver);
    },
  });
  // At original Draft HEAD 6819c880 this returned REVIEW_ONLY for issue 9999
  // while Ed25519 signed issue 1234. Snapshot or Proxy rejection must HOLD.
  checkHold({ payload: mutableProxy, signature: stable.signature });
});

test('adversarial top-level receipt cannot swap a signed identity after initial validation', () => {
  const stable = signed({ ...original });
  const swapped = new Proxy(stable, {
    get(target, key, receiver) {
      if (key === 'payload') return { ...original, issue_number: 9999 };
      return Reflect.get(target, key, receiver);
    },
  });
  checkHold(swapped);
});

test('adversarial trusted context and signing key wrappers fail closed', () => {
  const evilContext = new Proxy({ ...context }, {
    get(target, key, receiver) {
      if (key === 'run_id') return 42;
      return Reflect.get(target, key, receiver);
    },
  });
  checkHold(signed(), evilContext);
  const proxyPublicKey = new Proxy(publicKey, {});
  checkHold(signed(), { ...context, public_key: proxyPublicKey });
});
