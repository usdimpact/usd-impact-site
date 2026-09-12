import { createHash, createPublicKey, verify } from 'node:crypto';
import { SCOPE } from './publication-receipt-verifier.js';

export const WITNESS_RECEIPT_FIELDS = Object.freeze([
  'schema','keyId','audience','repository','projectId','teamId','target','exposure',
  'deploymentId','commitSha','artifactSha256','manifestSha256','approvalSha256','path',
  'sourceSha256','responseSha256','eventIdentity','phase','releaseAt','checkedAt','validUntil',
  'attemptId','surface','method','status','boundaryVersion','canonicalOrigin','challengeId',
  'challengeSha256','witnessManifestSha256','dispatchedAt','finishedAt',
]);
const BOUND = Object.freeze([
  'repository','projectId','teamId','target','exposure','deploymentId','commitSha','artifactSha256',
  'manifestSha256','approvalSha256','path','sourceSha256','responseSha256','eventIdentity','phase',
  'releaseAt','checkedAt','validUntil','attemptId','surface','method','status','boundaryVersion',
]);
const PREFIX = 'usd-impact/first-public-dispatch-receipt/v2\n';
const CANONICAL_ORIGIN = 'https://www.usd-impact.com';
const HEX = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const ID = /^[a-f0-9]{32}$/;
const PATH = /^\/news\/(?:[0-9]{4}-[0-9]{2}-[0-9]{2}|catalysts\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const fail = (code) => { throw Object.assign(new Error(code), { code }); };
const need = (ok, code) => { if (!ok) fail(code); };
const exact = (value, fields) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));
const digest = (value) => createHash('sha256').update(value).digest('hex');
function instant(value, code = 'HOLD_WITNESS_RECEIPT_TIME') {
  need(typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), code);
  const n = Date.parse(value); need(Number.isFinite(n) && new Date(n).toISOString() === value, code); return n;
}
function canonical(payload) {
  need(exact(payload, WITNESS_RECEIPT_FIELDS), 'HOLD_WITNESS_RECEIPT_SCHEMA');
  return JSON.stringify(Object.fromEntries(WITNESS_RECEIPT_FIELDS.map((field) => [field, payload[field]])));
}
function bytes(value, limit) {
  need(typeof value === 'string' && value.length > 0 && value.length <= limit && /^[A-Za-z0-9_-]+$/.test(value), 'HOLD_WITNESS_RECEIPT_ENCODING');
  const out = Buffer.from(value, 'base64url'); need(out.toString('base64url') === value, 'HOLD_WITNESS_RECEIPT_ENCODING'); return out;
}
function validatePayload(payload) {
  need(payload.schema === 'first-public-dispatch/v2' && payload.audience === 'publication-history-recorder', 'HOLD_WITNESS_RECEIPT_SCHEMA');
  need(Object.entries(SCOPE).every(([key, value]) => payload[key] === value), 'HOLD_WITNESS_RECEIPT_SCOPE');
  need(typeof payload.keyId === 'string' && /^public-witness-[a-z0-9-]{1,48}$/.test(payload.keyId), 'HOLD_WITNESS_RECEIPT_KEY');
  need(payload.target === 'production' && payload.exposure === 'public-approved', 'HOLD_WITNESS_RECEIPT_CONTEXT');
  need(typeof payload.deploymentId === 'string' && /^dpl_[A-Za-z0-9]{8,80}$/.test(payload.deploymentId)
    && typeof payload.commitSha === 'string' && SHA.test(payload.commitSha), 'HOLD_WITNESS_RECEIPT_BINDING');
  need(['artifactSha256','manifestSha256','approvalSha256','sourceSha256','responseSha256','challengeSha256','witnessManifestSha256']
    .every((field) => typeof payload[field] === 'string' && HEX.test(payload[field])), 'HOLD_WITNESS_RECEIPT_BINDING');
  need(typeof payload.path === 'string' && payload.path.length <= 240 && PATH.test(payload.path), 'HOLD_WITNESS_RECEIPT_PATH');
  need(typeof payload.attemptId === 'string' && ID.test(payload.attemptId)
    && typeof payload.challengeId === 'string' && ID.test(payload.challengeId), 'HOLD_WITNESS_RECEIPT_ID');
  need(payload.canonicalOrigin === CANONICAL_ORIGIN, 'HOLD_WITNESS_RECEIPT_ORIGIN');
  need(payload.method === 'GET' && payload.status === 200 && payload.surface === 'article'
    && payload.boundaryVersion === 'publication-dispatch/v1', 'HOLD_WITNESS_RECEIPT_RESPONSE');
  need(['preview','outcome','none'].includes(payload.phase), 'HOLD_WITNESS_RECEIPT_PHASE');
  const daily = payload.path.startsWith('/news/') && !payload.path.startsWith('/news/catalysts/');
  if (payload.phase === 'none') need(daily && payload.eventIdentity === null && payload.releaseAt === null, 'HOLD_WITNESS_RECEIPT_EVENT');
  else {
    need(!daily && typeof payload.eventIdentity === 'string'
      && /^BLS:(CPI|PPI|EMPSIT):20\d{2}-(0[1-9]|1[0-2]):initial$/.test(payload.eventIdentity), 'HOLD_WITNESS_RECEIPT_EVENT');
    instant(payload.releaseAt);
  }
}
export function encodeWitnessReceiptPayload(payload) { validatePayload(payload); return canonical(payload); }
export function witnessReceiptSigningBytes(payloadText) { return Buffer.from(PREFIX + payloadText, 'utf8'); }

/**
 * Verifies the successor first-publication receipt. Unlike the legacy signer-only
 * receipt, this proof is cryptographically bound to the exact canonical origin,
 * one-use challenge ID/hash and witness-manifest hash that gated the probe.
 */
export function createWitnessReceiptVerifier({ now = Date.now } = {}) {
  let highest = -1;
  function clock() { const n = now(); need(Number.isSafeInteger(n) && n >= 0 && n >= highest, 'HOLD_WITNESS_RECEIPT_CLOCK'); highest = n; return n; }
  return function verifyWitnessReceipt(rawEnvelope, { keySnapshot, binding, challengeClaim } = {}) {
    try {
      const n = clock();
      need(typeof rawEnvelope === 'string' && Buffer.byteLength(rawEnvelope) > 0 && Buffer.byteLength(rawEnvelope) <= 24000, 'HOLD_WITNESS_RECEIPT_ENVELOPE');
      const envelope = JSON.parse(rawEnvelope);
      need(exact(envelope, ['payload','signature'])
        && rawEnvelope === JSON.stringify({ payload: envelope.payload, signature: envelope.signature }), 'HOLD_WITNESS_RECEIPT_ENVELOPE');
      const payloadBytes = bytes(envelope.payload, 18000); const signature = bytes(envelope.signature, 128);
      need(signature.length === 64, 'HOLD_WITNESS_RECEIPT_SIGNATURE');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(payloadBytes);
      const payload = JSON.parse(text); need(text === canonical(payload), 'HOLD_WITNESS_RECEIPT_NONCANONICAL'); validatePayload(payload);
      need(exact(binding, BOUND) && BOUND.every((field) => binding[field] === payload[field]), 'HOLD_WITNESS_RECEIPT_BINDING');
      need(exact(challengeClaim, ['schema','attemptId','challengeId','challengeSha256','manifestSha256','canonicalOrigin','claimedAt','validUntil'])
        && challengeClaim.schema === 'stored-witness-challenge-claim/v1'
        && challengeClaim.attemptId === payload.attemptId && challengeClaim.challengeId === payload.challengeId
        && challengeClaim.challengeSha256 === payload.challengeSha256
        && challengeClaim.manifestSha256 === payload.witnessManifestSha256
        && challengeClaim.manifestSha256 === payload.manifestSha256
        && challengeClaim.canonicalOrigin === payload.canonicalOrigin, 'HOLD_WITNESS_RECEIPT_CHALLENGE');
      need(exact(keySnapshot, ['observedAt','validUntil','keys']) && Array.isArray(keySnapshot.keys)
        && keySnapshot.keys.length > 0 && keySnapshot.keys.length <= 8, 'HOLD_WITNESS_RECEIPT_KEY_SNAPSHOT');
      const observed = instant(keySnapshot.observedAt), keySnapshotUntil = instant(keySnapshot.validUntil);
      need(observed <= n && n < keySnapshotUntil && keySnapshotUntil - observed <= 15000, 'HOLD_WITNESS_RECEIPT_KEY_SNAPSHOT');
      const ids = keySnapshot.keys.map((key) => key?.keyId); need(new Set(ids).size === ids.length, 'HOLD_WITNESS_RECEIPT_KEY_SNAPSHOT');
      const key = keySnapshot.keys.find((item) => item?.keyId === payload.keyId);
      need(key && exact(key, ['keyId','purpose','publicKeyPem','notBefore','notAfter','revoked'])
        && key.purpose === 'public-response-witness' && key.revoked === false, 'HOLD_WITNESS_RECEIPT_KEY');
      const publicKey = createPublicKey(key.publicKeyPem);
      need(publicKey.type === 'public' && publicKey.asymmetricKeyType === 'ed25519'
        && verify(null, witnessReceiptSigningBytes(text), publicKey, signature), 'HOLD_WITNESS_RECEIPT_SIGNATURE');
      const checked = instant(payload.checkedAt), bindingUntil = instant(payload.validUntil), claimedAt = instant(challengeClaim.claimedAt);
      const challengeUntil = instant(challengeClaim.validUntil), dispatched = instant(payload.dispatchedAt), finished = instant(payload.finishedAt);
      need(checked <= claimedAt && claimedAt <= dispatched && dispatched <= finished && finished <= n, 'HOLD_WITNESS_RECEIPT_TIME_ORDER');
      need(checked < bindingUntil && bindingUntil - checked <= 900000 && n < bindingUntil && n < challengeUntil
        && n - finished < 15000, 'HOLD_WITNESS_RECEIPT_EXPIRED');
      const keyNotBefore = instant(key.notBefore), keyNotAfter = instant(key.notAfter);
      need(keyNotBefore <= dispatched && n < keyNotAfter, 'HOLD_WITNESS_RECEIPT_KEY');
      if (payload.phase === 'preview') need(bindingUntil <= instant(payload.releaseAt) && n < instant(payload.releaseAt), 'HOLD_WITNESS_RECEIPT_PREVIEW_EXPIRED');
      if (payload.phase === 'outcome') need(checked >= instant(payload.releaseAt) && dispatched >= instant(payload.releaseAt), 'HOLD_WITNESS_RECEIPT_OUTCOME_NOT_RELEASED');
      const final = clock();
      const deadline = Math.min(bindingUntil, challengeUntil, keySnapshotUntil, keyNotAfter, finished + 15000);
      need(final < deadline, 'HOLD_WITNESS_RECEIPT_EXPIRED');
      return Object.freeze({ decision: 'VERIFIED_WITNESS_LINKED_RECEIPT', receiptSha256: digest(rawEnvelope),
        payloadSha256: digest(text), attemptId: payload.attemptId, challengeId: payload.challengeId,
        challengeSha256: payload.challengeSha256, canonicalOrigin: payload.canonicalOrigin,
        verifiedAt: new Date(final).toISOString(), recordDeadline: new Date(deadline).toISOString(),
        witnessLinked: true, publicationAuthorized: false, admissionRecorded: false, enforcementActive: false });
    } catch (error) {
      return Object.freeze({ decision: typeof error?.code === 'string' && /^HOLD_WITNESS_RECEIPT_[A-Z_]+$/.test(error.code)
        ? error.code : 'HOLD_WITNESS_RECEIPT_INVALID', witnessLinked: false,
        publicationAuthorized: false, admissionRecorded: false, enforcementActive: false });
    }
  };
}
