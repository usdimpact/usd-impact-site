import { createHash, createPublicKey } from 'node:crypto';
import { createReceiptVerifier } from './publication-receipt-verifier.js';

const hash = (s) => createHash('sha256').update(s).digest('hex');
const idPattern = /^[a-f0-9]{32}$/;
const hex = /^[a-f0-9]{64}$/;
const freeze = (value) => {
  if (value && typeof value === 'object') { for (const v of Object.values(value)) freeze(v); Object.freeze(value); }
  return value;
};
const fail = (code) => { throw Object.assign(new Error(code), { code }); };
const need = (value, code) => { if (!value) fail(code); };
const clone = (value) => freeze(JSON.parse(JSON.stringify(value)));
const iso = (s) => {
  need(typeof s === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s), 'HOLD_TIME');
  const n = Date.parse(s); need(Number.isFinite(n) && new Date(n).toISOString() === s, 'HOLD_TIME'); return n;
};
const outcome = (decision, extra = {}) => Object.freeze({ decision, ...extra,
  publicationAuthorized: false, enforcementActive: false });

/** Dormant, provider-independent recorder. All adapters MUST be authenticated
 * server-only services. No request can supply a key snapshot or prepared binding.
 * It never creates an attempt or signs a receipt. A signed assertion is not proof
 * of public exposure. SQL must use the atomic receipt-ledger successor, NOT the
 * original digest-only finalizer. There is at most one write invocation per call.
 */
export function createPublicationReceiptRecorder({ loadAttempt, loadKeySnapshot, commitReceipt,
  readReceipt, now = Date.now, timeoutMs = 3000 } = {}) {
  need([loadAttempt, loadKeySnapshot, commitReceipt, readReceipt, now].every((f) => typeof f === 'function'), 'HOLD_ADAPTER_REQUIRED');
  need(Number.isInteger(timeoutMs) && timeoutMs >= 10 && timeoutMs <= 5000, 'HOLD_TIMEOUT_CONFIG');
  let highest = -1;
  function clock() { const n = now(); need(Number.isSafeInteger(n) && n >= highest && n >= 0, 'HOLD_CLOCK'); highest = n; return n; }
  const verifier = createReceiptVerifier({ now: clock });
  async function call(fn, value) {
    const controller = new AbortController(); let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(() => fn(value, { signal: controller.signal })),
        new Promise((_, reject) => { timer = setTimeout(() => {
          controller.abort(); reject(Object.assign(new Error('HOLD_ADAPTER_TIMEOUT'), { code: 'HOLD_ADAPTER_TIMEOUT' }));
        }, timeoutMs); }),
      ]);
    } finally { clearTimeout(timer); }
  }
  function request(id, raw) {
    need(typeof id === 'string' && idPattern.test(id) && typeof raw === 'string'
      && Buffer.byteLength(raw) > 0 && Buffer.byteLength(raw) <= 24000, 'HOLD_INVALID_REQUEST');
    return freeze({ attemptId: id, envelope: raw, receiptSha256: hash(raw) });
  }
  function persisted(record, input, payloadHash = null, binding = null) {
    need(record && record.schema === 'stored-dispatch-receipt/v1'
      && record.attemptId === input.attemptId && record.receiptSha256 === input.receiptSha256
      && typeof record.payloadSha256 === 'string' && hex.test(record.payloadSha256), 'HOLD_RECONCILIATION_MISMATCH');
    if (payloadHash !== null) need(record.payloadSha256 === payloadHash, 'HOLD_RECONCILIATION_MISMATCH');
    if (binding !== null) need(record.path === binding.path && record.sourceSha256 === binding.sourceSha256, 'HOLD_RECONCILIATION_MISMATCH');
    const admitted = iso(record.admittedAt), stored = iso(record.recordedAt), until = iso(record.verificationDeadline);
    need(admitted <= stored && stored < until && stored <= clock(), 'HOLD_RECONCILIATION_TIME');
    need(record.state === 'admitted' || record.state === 'revoked', 'HOLD_RECONCILIATION_MISMATCH');
    return outcome(record.state === 'revoked' ? 'RECORDED_BUT_REVOKED' : 'RECORDED_SIGNER_ASSERTION', {
      attemptId: input.attemptId, receiptSha256: input.receiptSha256,
      admissionRecorded: true, admittedAt: record.admittedAt,
    });
  }
  async function reconcile(input, payloadHash = null, binding = null) {
    const record = await call(readReceipt, freeze({ attemptId: input.attemptId, receiptSha256: input.receiptSha256 }));
    // A null after connection loss is NOT proof that an in-flight write cannot commit.
    if (record === null) return outcome('HOLD_RECORDING_UNRESOLVED', { admissionRecorded: false });
    return persisted(clone(record), input, payloadHash, binding);
  }
  return Object.freeze({
    async record(attemptId, rawEnvelope) {
      let input, proof, binding, writeStarted = false, readStarted = false;
      try {
        input = request(attemptId, rawEnvelope); clock();
        const attempt = clone(await call(loadAttempt, freeze({ attemptId })));
        need(attempt && attempt.attemptId === attemptId && attempt.state === 'pending'
          && attempt.binding?.attemptId === attemptId && typeof attempt.keyFingerprint === 'string'
          && hex.test(attempt.keyFingerprint), 'HOLD_ATTEMPT_UNAVAILABLE');
        binding = attempt.binding;
        need(iso(attempt.validUntil) > clock(), 'HOLD_ATTEMPT_EXPIRED');
        const snapshot = clone(await call(loadKeySnapshot, freeze({ keyId: attempt.keyId })));
        const key = snapshot.keys?.find((k) => k.keyId === attempt.keyId);
        need(key && hash(createPublicKey(key.publicKeyPem).export({ type: 'spki', format: 'der' })) === attempt.keyFingerprint, 'HOLD_KEY_BINDING');
        proof = verifier(input.envelope, { binding, keySnapshot: snapshot });
        need(proof.decision === 'VERIFIED_SIGNER_ASSERTION_ONLY', proof.decision);
        const payload = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(JSON.parse(input.envelope).payload, 'base64url'));
        need(JSON.parse(payload).keyId === attempt.keyId, 'HOLD_KEY_BINDING');
        // Fresh authoritative attempt read closes preparation/revocation drift before
        // the write. SQL still rechecks immutable bindings, revocation and its clock.
        const current = clone(await call(loadAttempt, freeze({ attemptId })));
        need(JSON.stringify(current) === JSON.stringify(attempt), 'HOLD_ATTEMPT_DRIFT');
        const freshKeys = clone(await call(loadKeySnapshot, freeze({ keyId: attempt.keyId })));
        const freshKey = freshKeys.keys?.find((k) => k.keyId === attempt.keyId);
        need(freshKey && hash(createPublicKey(freshKey.publicKeyPem).export({ type: 'spki', format: 'der' })) === attempt.keyFingerprint, 'HOLD_KEY_BINDING');
        const refreshedProof = verifier(input.envelope, { binding, keySnapshot: freshKeys });
        need(refreshedProof.decision === 'VERIFIED_SIGNER_ASSERTION_ONLY', refreshedProof.decision);
        const deadline = Math.min(iso(proof.recordDeadline), iso(refreshedProof.recordDeadline), iso(attempt.validUntil));
        need(clock() < deadline, 'HOLD_RECEIPT_EXPIRED');
        writeStarted = true;
        await call(commitReceipt, freeze({ attemptId, envelope: input.envelope, payload,
          verificationDeadline: new Date(deadline).toISOString() }));
        // Do not trust a success boolean. Reconcile exact committed receipt bytes.
        readStarted = true;
        return await reconcile(input, proof.payloadSha256, binding);
      } catch (error) {
        if (writeStarted) {
          if (readStarted) return outcome('HOLD_RECORDING_UNRESOLVED', { admissionRecorded: false });
          try { return await reconcile(input, proof.payloadSha256, binding); }
          catch { return outcome('HOLD_RECORDING_UNRESOLVED', { admissionRecorded: false }); }
        }
        // Callback messages/code properties never become public diagnostics.
        const allowed = new Set(['HOLD_INVALID_REQUEST','HOLD_CLOCK','HOLD_ATTEMPT_UNAVAILABLE','HOLD_ATTEMPT_EXPIRED',
          'HOLD_KEY_BINDING','HOLD_ATTEMPT_DRIFT','HOLD_RECEIPT_EXPIRED']);
        return outcome(allowed.has(error?.code) ? error.code : 'HOLD_RECEIPT_NOT_VERIFIED', { admissionRecorded: false });
      }
    },
    async reconcile(attemptId, rawEnvelope) {
      try { return await reconcile(request(attemptId, rawEnvelope)); }
      catch { return outcome('HOLD_RECORDING_UNRESOLVED', { admissionRecorded: false }); }
    },
  });
}
