import { createHash, createPublicKey } from 'node:crypto';
import { createGitHubOidcWitnessVerifier } from './publication-github-oidc-witness.js';
import { createWitnessChallengeVerifier, encodeWitnessChallengePayload } from './publication-witness-challenge.js';
import { createWitnessReceiptVerifier, encodeWitnessReceiptPayload } from './publication-witness-receipt-verifier.js';

// Dormant dual-proof verifier: not a route, observer, token client, or admission writer.
// OIDC authenticates who asserts the evidence; the independent signed v2 receipt
// remains mandatory. Neither this result nor an OIDC token authorizes publication.
const ORIGIN = 'https://www.usd-impact.com';
const REPO = 'usdimpact/usd-impact-site';
const SHA = /^[a-f0-9]{40}$/;
const HEX = /^[a-f0-9]{64}$/;
const ID = /^[a-f0-9]{32}$/;
const RUN = /^[1-9][0-9]{0,30}$/;
const TOKEN_AGE_MS = 30000;
const POLICY_FIELDS = Object.freeze(['schema','workflowRef','workflowSha','jobWorkflowRef','jobWorkflowSha',
  'eventName','runId','runAttempt','checkRunId','approvedAt','validUntil']);
const PACKET_FIELDS = Object.freeze(['schema','challengeEnvelope','challengeToken','receiptEnvelope','receiptToken']);
const FALSE_FLAGS = Object.freeze({ identityAuthenticated: false, witnessLinked: false, evidenceBound: false,
  publicationAuthorized: false, admissionRecorded: false, enforcementActive: false,
  publicResponseObserved: false, replayConsumed: false });
const hash = (value) => createHash('sha256').update(value).digest('hex');
class Hold extends Error { constructor(code) { super(code); this.code = code; } }
const need = (value, code) => { if (!value) throw new Hold(`HOLD_OIDC_EVIDENCE_${code}`); };
const exact = (value, fields) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === fields.length && fields.every((key) => Object.hasOwn(value, key));
function instant(value) {
  need(typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), 'TIME');
  const n = Date.parse(value);
  need(Number.isSafeInteger(n) && new Date(n).toISOString() === value, 'TIME'); return n;
}

// Snapshot trusted adapter data without invoking accessors, toJSON, or coercion.
// The adapter and clock are trusted code, never objects supplied in an HTTP body.
function snapshot(value, seen = new Set(), budget = { count: 0 }, depth = 0) {
  need(++budget.count <= 2048 && depth <= 12, 'TRUST');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') { need(value.length <= 24000, 'TRUST'); return value; }
  if (typeof value === 'number') { need(Number.isFinite(value), 'TRUST'); return value; }
  need(typeof value === 'object' && !seen.has(value), 'TRUST'); seen.add(value);
  const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
  need(array ? proto === Array.prototype : proto === Object.prototype || proto === null, 'TRUST');
  const keys = Reflect.ownKeys(value);
  need(keys.length <= 65 && keys.every((key) => typeof key === 'string' && key.length <= 80
    && !['__proto__','prototype','constructor'].includes(key)), 'TRUST');
  if (array) need(value.length <= 16 && keys.length === value.length + 1
    && keys.includes('length') && Array.from({ length: value.length }, (_, i) => String(i)).every(k => keys.includes(k)), 'TRUST');
  const out = array ? [] : {};
  for (const key of keys) {
    if (array && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    need(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable, 'TRUST');
    out[key] = snapshot(descriptor.value, seen, budget, depth + 1);
  }
  return Object.freeze(out);
}
function text(value, max) {
  need(typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= max, 'ENVELOPE');
  return value;
}
function signedPayload(raw, purpose) {
  text(raw, purpose === 'challenge' ? 20000 : 24000);
  const envelope = JSON.parse(raw);
  need(exact(envelope, ['payload','signature']) && raw === JSON.stringify({ payload: envelope.payload, signature: envelope.signature }), 'ENVELOPE');
  const parts = [envelope.payload, envelope.signature].map((value) => {
    need(typeof value === 'string' && value.length > 0 && /^[A-Za-z0-9_-]+$/.test(value), 'ENVELOPE');
    const bytes = Buffer.from(value, 'base64url'); need(bytes.toString('base64url') === value, 'ENVELOPE'); return bytes;
  });
  need(parts[1].length === 64, 'ENVELOPE');
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(parts[0]);
  const payload = JSON.parse(decoded);
  const encode = purpose === 'challenge' ? encodeWitnessChallengePayload : encodeWitnessReceiptPayload;
  need(decoded === encode(payload), 'ENVELOPE'); return payload;
}
function compactToken(value) {
  text(value, 20000); need(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value), 'ENVELOPE');
  return value;
}

// Syntax/digest builders ONLY. Calling either helper does not verify a signature.
export function publicationChallengeEvidenceSha256(rawChallenge) {
  try {
    signedPayload(rawChallenge, 'challenge');
    return hash('usd-impact/publication-oidc-evidence/challenge/v1\n' + rawChallenge);
  } catch { throw new Hold('HOLD_OIDC_EVIDENCE_ENVELOPE'); }
}
export function publicationReceiptEvidenceSha256(rawChallenge, challengeToken, rawReceipt) {
  try {
    const challengeEvidenceSha256 = publicationChallengeEvidenceSha256(rawChallenge);
    compactToken(challengeToken); signedPayload(rawReceipt, 'receipt');
    return hash('usd-impact/publication-oidc-evidence/receipt/v1\n' + JSON.stringify({
      challengeEvidenceSha256, challengeTokenSha256: hash(challengeToken), receiptSha256: hash(rawReceipt),
    }));
  } catch { throw new Hold('HOLD_OIDC_EVIDENCE_ENVELOPE'); }
}
function policySnapshot(value) {
  const policy = snapshot(value);
  need(exact(policy, POLICY_FIELDS) && policy.schema === 'publication-oidc-evidence-policy/v1', 'POLICY');
  need(SHA.test(policy.workflowSha) && SHA.test(policy.jobWorkflowSha), 'POLICY');
  const name = (ref, suffix) => {
    need(typeof ref === 'string' && ref.startsWith(`${REPO}/.github/workflows/`) && ref.endsWith(suffix), 'POLICY');
    const file = ref.slice(`${REPO}/.github/workflows/`.length, -suffix.length);
    need(/^[a-z0-9][a-z0-9-]{0,95}\.ya?ml$/.test(file)
      && !/(rehearsal|diagnostic)/.test(file), 'POLICY');
  };
  name(policy.workflowRef, '@refs/heads/main'); name(policy.jobWorkflowRef, `@${policy.jobWorkflowSha}`);
  need(policy.eventName === 'workflow_dispatch' && policy.runAttempt === '1'
    && typeof policy.runId === 'string' && RUN.test(policy.runId)
    && typeof policy.checkRunId === 'string' && RUN.test(policy.checkRunId), 'POLICY');
  const start = instant(policy.approvedAt), until = instant(policy.validUntil);
  need(start < until && until - start <= 900000, 'POLICY'); return policy;
}

/** Construct only from protected server policy. Trusted per-call context must be
 * independently loaded by the recorder, never deserialized from the evidence
 * packet. This pure verifier cannot prove that an adapter is trusted, reload its
 * state, or consume the durable one-use claim. The recorder must do those steps.
 */
export function createPublicationOidcEvidenceBridge({ workflowPolicy, now = Date.now } = {}) {
  need(typeof now === 'function', 'POLICY');
  const policy = policySnapshot(workflowPolicy); let highest = -1;
  const clock = () => {
    const n = now(); need(Number.isSafeInteger(n) && n >= 0 && n >= highest, 'CLOCK'); highest = n; return n;
  };
  const verifyChallenge = createWitnessChallengeVerifier({ now: clock });
  const verifyReceipt = createWitnessReceiptVerifier({ now: clock });
  const verifyIdentity = createGitHubOidcWitnessVerifier({ now: clock, maxTokenAgeMs: TOKEN_AGE_MS });
  return function verifyEvidence(rawPacket, trustedContext) {
    try {
      const n = clock();
      need(instant(policy.approvedAt) <= n && n < instant(policy.validUntil), 'EXPIRED');
      text(rawPacket, 100000);
      const packet = JSON.parse(rawPacket);
      need(exact(packet, PACKET_FIELDS) && packet.schema === 'publication-oidc-evidence/v1'
        && rawPacket === JSON.stringify(Object.fromEntries(PACKET_FIELDS.map(key => [key, packet[key]]))), 'ENVELOPE');
      const challengePayload = signedPayload(packet.challengeEnvelope, 'challenge');
      const receiptPayload = signedPayload(packet.receiptEnvelope, 'receipt');
      compactToken(packet.challengeToken); compactToken(packet.receiptToken);
      const context = snapshot(trustedContext);
      need(exact(context, ['attempt','challengeClaim','witnessKeySnapshot','jwksSnapshot']), 'TRUST');
      const { attempt, challengeClaim, witnessKeySnapshot, jwksSnapshot } = context;
      need(exact(attempt, ['attemptId','state','keyId','keyFingerprint','validUntil','binding'])
        && typeof attempt.attemptId === 'string' && ID.test(attempt.attemptId)
        && attempt.state === 'pending' && attempt.binding?.attemptId === attempt.attemptId
        && typeof attempt.keyFingerprint === 'string' && HEX.test(attempt.keyFingerprint), 'TRUST');
      need(n < instant(attempt.validUntil), 'EXPIRED');
      const binding = attempt.binding;
      need(challengePayload.keyId === attempt.keyId && receiptPayload.keyId === attempt.keyId, 'KEY');
      const key = witnessKeySnapshot?.keys?.find(item => item.keyId === attempt.keyId);
      need(key && key.purpose === 'public-response-witness' && key.revoked === false
        && typeof key.publicKeyPem === 'string' && key.publicKeyPem.startsWith('-----BEGIN PUBLIC KEY-----'), 'KEY');
      const publicKey = createPublicKey(key.publicKeyPem);
      need(publicKey.asymmetricKeyType === 'ed25519'
        && hash(publicKey.export({ type: 'spki', format: 'der' })) === attempt.keyFingerprint, 'KEY');
      const challenge = verifyChallenge(packet.challengeEnvelope, { keySnapshot: witnessKeySnapshot, expected: {
        attemptId: attempt.attemptId, deploymentId: binding.deploymentId, path: binding.path,
        responseSha256: binding.responseSha256, manifestSha256: binding.manifestSha256, canonicalOrigin: ORIGIN,
      }});
      need(challenge.decision === 'VERIFIED_PUBLIC_WITNESS_CHALLENGE', 'CHALLENGE');
      need(challengeClaim?.challengeId === challenge.challengeId
        && challengeClaim.challengeSha256 === challenge.challengeSha256
        && challengeClaim.manifestSha256 === challenge.manifestSha256, 'CLAIM');
      need(instant(challengePayload.issuedAt) <= instant(challengeClaim.claimedAt)
        && instant(challengeClaim.claimedAt) < instant(challengeClaim.validUntil)
        && instant(challengeClaim.validUntil) <= instant(challengePayload.expiresAt), 'CLAIM');
      const receipt = verifyReceipt(packet.receiptEnvelope, { keySnapshot: witnessKeySnapshot, binding, challengeClaim });
      need(receipt.decision === 'VERIFIED_WITNESS_LINKED_RECEIPT', 'RECEIPT');
      const challengeDigest = publicationChallengeEvidenceSha256(packet.challengeEnvelope);
      const expectation = (purpose, evidenceSha256, run = null) => ({ purpose, evidenceSha256,
        workflowRef: policy.workflowRef, workflowSha: policy.workflowSha, jobWorkflowRef: policy.jobWorkflowRef,
        jobWorkflowSha: policy.jobWorkflowSha, eventName: policy.eventName, run });
      const first = verifyIdentity(packet.challengeToken, { jwksSnapshot, expected: expectation('challenge', challengeDigest) });
      need(first.identityAuthenticated === true, 'IDENTITY');
      need(first.run.runId === policy.runId && first.run.runAttempt === policy.runAttempt
        && first.run.checkRunId === policy.checkRunId, 'RUN');
      const receiptDigest = publicationReceiptEvidenceSha256(packet.challengeEnvelope, packet.challengeToken, packet.receiptEnvelope);
      const second = verifyIdentity(packet.receiptToken, { jwksSnapshot,
        expected: expectation('receipt', receiptDigest, first.run) });
      need(second.identityAuthenticated === true && packet.challengeToken !== packet.receiptToken, 'IDENTITY');
      // Read expiration only after the unchanged verifier authenticated each JWT.
      // The bridge uses an exclusive final deadline, conservatively including the
      // original challenge identity, not just the last successfully verified token.
      const tokenDeadline = (token, identity) => Math.min(
        JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).exp * 1000,
        instant(identity.run.tokenIssuedAt) + TOKEN_AGE_MS);
      const deadline = Math.min(instant(policy.validUntil), instant(attempt.validUntil),
        instant(challenge.validUntil), instant(receipt.recordDeadline), instant(challengeClaim.validUntil),
        instant(jwksSnapshot.validUntil), tokenDeadline(packet.challengeToken, first), tokenDeadline(packet.receiptToken, second));
      const final = clock(); need(Number.isSafeInteger(deadline) && final < deadline, 'EXPIRED');
      return Object.freeze({ schema: 'publication-oidc-evidence-result/v1',
        decision: 'VERIFIED_IDENTITY_BOUND_WITNESS_EVIDENCE', ...FALSE_FLAGS,
        identityAuthenticated: true, witnessLinked: true, evidenceBound: true,
        attemptId: attempt.attemptId, challengeId: challenge.challengeId, canonicalOrigin: ORIGIN,
        evidenceSha256: hash(rawPacket), challengeSha256: challenge.challengeSha256,
        receiptSha256: receipt.receiptSha256, challengeEvidenceSha256: challengeDigest, receiptEvidenceSha256: receiptDigest,
        runId: first.run.runId, runAttempt: first.run.runAttempt, checkRunId: first.run.checkRunId,
        workflowSha: policy.workflowSha, jobWorkflowSha: policy.jobWorkflowSha,
        verifiedAt: new Date(final).toISOString(), verificationDeadline: new Date(deadline).toISOString() });
    } catch (error) {
      return Object.freeze({ schema: 'publication-oidc-evidence-result/v1',
        decision: error instanceof Hold ? error.code : 'HOLD_OIDC_EVIDENCE_INVALID', ...FALSE_FLAGS });
    }
  };
}
