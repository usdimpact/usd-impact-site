import { createHash, createPublicKey } from 'node:crypto';
import { createWitnessReceiptVerifier } from './publication-witness-receipt-verifier.js';

const ID = /^[a-f0-9]{32}$/;
const HEX = /^[a-f0-9]{64}$/;
const ORIGIN = 'https://www.usd-impact.com';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const fail = (code) => { throw Object.assign(new Error(code), { code }); };
const need = (ok, code) => { if (!ok) fail(code); };
const freeze = (value) => {
  if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
};
const clone = (value) => freeze(JSON.parse(JSON.stringify(value)));
function instant(value, code = 'HOLD_WITNESS_RECEIPT_TIME') {
  need(typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), code);
  const n = Date.parse(value); need(Number.isFinite(n) && new Date(n).toISOString() === value, code); return n;
}
const outcome = (decision, extra = {}) => Object.freeze({ decision, ...extra,
  witnessLinked: Boolean(extra.witnessLinked), publicationAuthorized: false, enforcementActive: false });
function exactContext(value) {
  need(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 4
    && ['canonicalOrigin','challengeId','challengeSha256','manifestSha256'].every((key) => Object.hasOwn(value, key)), 'HOLD_WITNESS_RECEIPT_CONTEXT');
  need(value.canonicalOrigin === ORIGIN && ID.test(value.challengeId)
    && HEX.test(value.challengeSha256) && HEX.test(value.manifestSha256), 'HOLD_WITNESS_RECEIPT_CONTEXT');
  return clone(value);
}

/**
 * Successor recorder for first-publication witness receipts. The exact one-use
 * challenge claim is reloaded before and after signature verification. Only the
 * witness-linked v2 receipt is eligible for the atomic successor SQL writer.
 */
export function createWitnessReceiptRecorder({ loadAttempt, loadWitnessKeySnapshot, loadChallengeClaim,
  commitWitnessReceipt, readWitnessReceipt, now = Date.now, timeoutMs = 3000 } = {}) {
  need([loadAttempt, loadWitnessKeySnapshot, loadChallengeClaim, commitWitnessReceipt, readWitnessReceipt, now]
    .every((fn) => typeof fn === 'function'), 'HOLD_WITNESS_RECEIPT_ADAPTER');
  need(Number.isInteger(timeoutMs) && timeoutMs >= 10 && timeoutMs <= 5000, 'HOLD_WITNESS_RECEIPT_CONFIG');
  let highest = -1;
  function clock() { const n = now(); need(Number.isSafeInteger(n) && n >= 0 && n >= highest, 'HOLD_WITNESS_RECEIPT_CLOCK'); highest = n; return n; }
  const verifier = createWitnessReceiptVerifier({ now: clock });
  async function call(fn, value) {
    const controller = new AbortController(); let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(() => fn(value, { signal: controller.signal })),
        new Promise((_, reject) => { timer = setTimeout(() => {
          controller.abort(); reject(Object.assign(new Error('HOLD_WITNESS_RECEIPT_TIMEOUT'), { code: 'HOLD_WITNESS_RECEIPT_TIMEOUT' }));
        }, timeoutMs); }),
      ]);
    } finally { clearTimeout(timer); }
  }
  function request(attemptId, envelope, witnessContext) {
    need(typeof attemptId === 'string' && ID.test(attemptId) && typeof envelope === 'string'
      && Buffer.byteLength(envelope) > 0 && Buffer.byteLength(envelope) <= 24000, 'HOLD_WITNESS_RECEIPT_REQUEST');
    return freeze({ attemptId, envelope, receiptSha256: hash(envelope), witnessContext: exactContext(witnessContext) });
  }
  function stableAttempt(attempt) {
    need(attempt && attempt.attemptId && attempt.binding, 'HOLD_WITNESS_RECEIPT_ATTEMPT');
    return JSON.stringify({ attemptId: attempt.attemptId, state: attempt.state, keyId: attempt.keyId,
      keyFingerprint: attempt.keyFingerprint, validUntil: attempt.validUntil, binding: attempt.binding });
  }
  function exactClaim(record, input) {
    need(record && record.schema === 'stored-witness-challenge-claim/v1'
      && record.attemptId === input.attemptId
      && record.challengeId === input.witnessContext.challengeId
      && record.challengeSha256 === input.witnessContext.challengeSha256
      && record.manifestSha256 === input.witnessContext.manifestSha256
      && record.canonicalOrigin === input.witnessContext.canonicalOrigin, 'HOLD_WITNESS_RECEIPT_CHALLENGE');
    need(instant(record.claimedAt) < instant(record.validUntil) && clock() < instant(record.validUntil), 'HOLD_WITNESS_RECEIPT_EXPIRED');
    return clone(record);
  }
  function persisted(record, input, payloadSha256, binding) {
    need(record && record.schema === 'stored-witness-dispatch-receipt/v2'
      && record.attemptId === input.attemptId && record.receiptSha256 === input.receiptSha256
      && record.payloadSha256 === payloadSha256 && record.path === binding.path && record.sourceSha256 === binding.sourceSha256
      && record.challengeId === input.witnessContext.challengeId
      && record.challengeSha256 === input.witnessContext.challengeSha256
      && record.canonicalOrigin === input.witnessContext.canonicalOrigin, 'HOLD_WITNESS_RECEIPT_RECONCILIATION');
    const admitted = instant(record.admittedAt), stored = instant(record.recordedAt), until = instant(record.verificationDeadline);
    need(admitted <= stored && stored < until && stored <= clock(), 'HOLD_WITNESS_RECEIPT_RECONCILIATION');
    need(record.state === 'admitted' || record.state === 'revoked', 'HOLD_WITNESS_RECEIPT_RECONCILIATION');
    return outcome(record.state === 'revoked' ? 'RECORDED_WITNESS_BUT_REVOKED' : 'RECORDED_WITNESS_ASSERTION', {
      witnessLinked: true, admissionRecorded: true, attemptId: input.attemptId,
      challengeId: input.witnessContext.challengeId, canonicalOrigin: input.witnessContext.canonicalOrigin,
      receiptSha256: input.receiptSha256, admittedAt: record.admittedAt,
    });
  }
  async function reconcile(input, payloadSha256, binding) {
    const record = await call(readWitnessReceipt, freeze({ attemptId: input.attemptId,
      receiptSha256: input.receiptSha256, challengeId: input.witnessContext.challengeId }));
    if (record === null) return outcome('HOLD_WITNESS_RECEIPT_UNRESOLVED', { admissionRecorded: false });
    return persisted(clone(record), input, payloadSha256, binding);
  }
  return Object.freeze({
    async record(attemptId, rawEnvelope, witnessContext) {
      let input, proof, binding, writeStarted = false, readStarted = false;
      try {
        input = request(attemptId, rawEnvelope, witnessContext); clock();
        const attempt = clone(await call(loadAttempt, freeze({ attemptId })));
        need(attempt && attempt.attemptId === attemptId && attempt.state === 'pending'
          && attempt.binding?.attemptId === attemptId && typeof attempt.keyFingerprint === 'string'
          && HEX.test(attempt.keyFingerprint), 'HOLD_WITNESS_RECEIPT_ATTEMPT');
        binding = attempt.binding; need(instant(attempt.validUntil) > clock(), 'HOLD_WITNESS_RECEIPT_EXPIRED');
        const claimRequest = freeze({ attemptId, challengeId: input.witnessContext.challengeId,
          challengeSha256: input.witnessContext.challengeSha256 });
        const claim = exactClaim(clone(await call(loadChallengeClaim, claimRequest)), input);
        const snapshot = clone(await call(loadWitnessKeySnapshot, freeze({ keyId: attempt.keyId })));
        const key = snapshot.keys?.find((item) => item.keyId === attempt.keyId);
        need(key && key.purpose === 'public-response-witness'
          && hash(createPublicKey(key.publicKeyPem).export({ type: 'spki', format: 'der' })) === attempt.keyFingerprint,
        'HOLD_WITNESS_RECEIPT_KEY');
        proof = verifier(input.envelope, { binding, keySnapshot: snapshot, challengeClaim: claim });
        need(proof.decision === 'VERIFIED_WITNESS_LINKED_RECEIPT', proof.decision);
        const payload = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(JSON.parse(input.envelope).payload, 'base64url'));
        const currentAttempt = clone(await call(loadAttempt, freeze({ attemptId })));
        need(stableAttempt(currentAttempt) === stableAttempt(attempt), 'HOLD_WITNESS_RECEIPT_ATTEMPT_DRIFT');
        const currentClaim = exactClaim(clone(await call(loadChallengeClaim, claimRequest)), input);
        need(JSON.stringify(currentClaim) === JSON.stringify(claim), 'HOLD_WITNESS_RECEIPT_CHALLENGE_DRIFT');
        const freshSnapshot = clone(await call(loadWitnessKeySnapshot, freeze({ keyId: attempt.keyId })));
        const freshKey = freshSnapshot.keys?.find((item) => item.keyId === attempt.keyId);
        need(freshKey && freshKey.purpose === 'public-response-witness'
          && hash(createPublicKey(freshKey.publicKeyPem).export({ type: 'spki', format: 'der' })) === attempt.keyFingerprint,
        'HOLD_WITNESS_RECEIPT_KEY');
        const refreshed = verifier(input.envelope, { binding, keySnapshot: freshSnapshot, challengeClaim: currentClaim });
        need(refreshed.decision === 'VERIFIED_WITNESS_LINKED_RECEIPT', refreshed.decision);
        const deadline = Math.min(instant(proof.recordDeadline), instant(refreshed.recordDeadline), instant(attempt.validUntil), instant(claim.validUntil));
        need(clock() < deadline, 'HOLD_WITNESS_RECEIPT_EXPIRED');
        writeStarted = true;
        await call(commitWitnessReceipt, freeze({ attemptId, envelope: input.envelope, payload,
          verificationDeadline: new Date(deadline).toISOString(), challengeId: input.witnessContext.challengeId }));
        readStarted = true;
        return await reconcile(input, proof.payloadSha256, binding);
      } catch (error) {
        if (writeStarted) {
          if (readStarted) return outcome('HOLD_WITNESS_RECEIPT_UNRESOLVED', { admissionRecorded: false });
          try { return await reconcile(input, proof.payloadSha256, binding); }
          catch { return outcome('HOLD_WITNESS_RECEIPT_UNRESOLVED', { admissionRecorded: false }); }
        }
        const allowed = new Set(['HOLD_WITNESS_RECEIPT_REQUEST','HOLD_WITNESS_RECEIPT_CONTEXT','HOLD_WITNESS_RECEIPT_CLOCK',
          'HOLD_WITNESS_RECEIPT_ATTEMPT','HOLD_WITNESS_RECEIPT_EXPIRED','HOLD_WITNESS_RECEIPT_CHALLENGE',
          'HOLD_WITNESS_RECEIPT_KEY','HOLD_WITNESS_RECEIPT_ATTEMPT_DRIFT','HOLD_WITNESS_RECEIPT_CHALLENGE_DRIFT']);
        return outcome(allowed.has(error?.code) ? error.code : 'HOLD_WITNESS_RECEIPT_NOT_VERIFIED', { admissionRecorded: false });
      }
    },
  });
}
