import { createHash } from 'node:crypto';
import { ServerResponse } from 'node:http';
import { createWitnessChallengeVerifier } from './publication-witness-challenge.js';

const HEADER = 'x-usd-impact-witness-challenge';
const PATH = /^\/news\/(?:[0-9]{4}-[0-9]{2}-[0-9]{2}|catalysts\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const HEX = /^[a-f0-9]{64}$/;
const ID = /^[a-f0-9]{32}$/;
const MAX_BODY = 1_000_000;
const SAFE_HEADERS = Object.freeze({
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  Pragma: 'no-cache', Expires: '0',
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
});
const hash = (value) => createHash('sha256').update(value).digest('hex');
const freeze = (value) => {
  if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
};
const clone = (value) => freeze(JSON.parse(JSON.stringify(value)));
class Hold extends Error { constructor(code, status = 503) { super(code); this.code = code; this.status = status; } }
const fail = (code, status) => { throw new Hold(code, status); };
const need = (value, code, status) => { if (!value) fail(code, status); };
function instant(value) {
  need(typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), 'HOLD_WITNESS_TIME');
  const n = Date.parse(value); need(Number.isFinite(n) && new Date(n).toISOString() === value, 'HOLD_WITNESS_TIME'); return n;
}
function exactHeader(request) {
  const occurrences = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index]?.toLowerCase() === HEADER) occurrences.push(request.rawHeaders[index + 1]);
  }
  need(occurrences.length === 1 && typeof occurrences[0] === 'string' && occurrences[0].length <= 24000,
    'HOLD_WITNESS_CHALLENGE_REQUIRED', 404);
  return occurrences[0];
}
function stableAttempt(attempt) {
  need(attempt && typeof attempt === 'object' && attempt.attemptId && attempt.binding, 'HOLD_ATTEMPT_UNAVAILABLE');
  return JSON.stringify({ attemptId: attempt.attemptId, state: attempt.state, keyId: attempt.keyId,
    keyFingerprint: attempt.keyFingerprint, validUntil: attempt.validUntil, binding: attempt.binding });
}
function validateAttempt(attempt, { attemptId, path, canonicalOrigin, now }) {
  need(attempt.attemptId === attemptId && attempt.state === 'pending' && ID.test(attemptId), 'HOLD_ATTEMPT_UNAVAILABLE');
  need(typeof attempt.keyId === 'string' && /^public-witness-[a-z0-9-]{1,48}$/.test(attempt.keyId)
    && typeof attempt.keyFingerprint === 'string' && HEX.test(attempt.keyFingerprint), 'HOLD_WITNESS_KEY');
  need(instant(attempt.validUntil) > now, 'HOLD_ATTEMPT_EXPIRED');
  const b = attempt.binding;
  need(b && b.target === 'production' && b.exposure === 'public-approved'
    && b.attemptId === attemptId && b.path === path && b.surface === 'article'
    && b.method === 'GET' && b.status === 200 && b.boundaryVersion === 'publication-dispatch/v1'
    && typeof b.deploymentId === 'string' && /^dpl_[A-Za-z0-9]{8,80}$/.test(b.deploymentId)
    && typeof b.responseSha256 === 'string' && HEX.test(b.responseSha256)
    && typeof b.manifestSha256 === 'string' && HEX.test(b.manifestSha256)
    && typeof canonicalOrigin === 'string' && canonicalOrigin.startsWith('https://'), 'HOLD_ATTEMPT_BINDING');
  return b;
}
function clearHeaders(response) { for (const name of response.getHeaderNames()) response.removeHeader(name); }
function result(decision, extra = {}) { return Object.freeze({ decision, ...extra, publicationAuthorized: false, enforcementActive: false }); }

/** Dormant authenticated witness-probe handler. It is intentionally NOT a public
 * article handler. Only a short-lived challenge signed by the dedicated witness
 * can receive candidate bytes. General public serving remains recorded-only.
 * The witness receipt is recorded after the independent witness says it received
 * the exact canonical-origin response; Node's `finish` event is never used as proof.
 */
export function createFirstPublicationWitnessHandler({ attemptId, path, canonicalOrigin,
  loadAttempt, loadWitnessKeySnapshot, claimChallenge, render, awaitReceipt, recordReceipt,
  scheduleAfterResponse = null, now = Date.now, preparationTimeoutMs = 5000, witnessTimeoutMs = 5000 } = {}) {
  need(typeof attemptId === 'string' && ID.test(attemptId) && typeof path === 'string' && PATH.test(path), 'HOLD_ROUTE_CONFIGURATION');
  need(typeof canonicalOrigin === 'string' && canonicalOrigin.startsWith('https://') && !canonicalOrigin.endsWith('/'), 'HOLD_ROUTE_CONFIGURATION');
  need([loadAttempt, loadWitnessKeySnapshot, claimChallenge, render, awaitReceipt, recordReceipt, now].every((fn) => typeof fn === 'function'), 'HOLD_ADAPTER_REQUIRED');
  need(scheduleAfterResponse === null || typeof scheduleAfterResponse === 'function', 'HOLD_WITNESS_LIFECYCLE_CONFIG');
  need([preparationTimeoutMs, witnessTimeoutMs].every((n) => Number.isInteger(n) && n >= 10 && n <= 15000), 'HOLD_TIMEOUT_CONFIG');
  let highest = -1;
  function clock() { const n = now(); need(Number.isSafeInteger(n) && n >= highest && n >= 0, 'HOLD_WITNESS_CLOCK'); highest = n; return n; }
  const verifyChallenge = createWitnessChallengeVerifier({ now: clock });
  async function bounded(fn, arg, timeoutMs, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(() => fn(arg, { signal: controller.signal })),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Hold('HOLD_WITNESS_TIMEOUT')); }, timeoutMs); }),
      ]);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  return async function handleWitnessProbe(request, response) {
    if (!(response instanceof ServerResponse) || response.req !== request) return result('HOLD_RESPONSE_UNSUPPORTED', { probeDispatched: false, admissionRecorded: false });
    let probeDispatched = false; const abort = new AbortController();
    try {
      need(request.method === 'GET', 'HOLD_ROUTE_NOT_FOUND', 404);
      need(typeof request.url === 'string' && request.url === path, 'HOLD_ROUTE_NOT_FOUND', 404);
      need(!request.aborted && !response.destroyed && !response.headersSent && !response.writableEnded, 'HOLD_RESPONSE_UNAVAILABLE');
      const rawChallenge = exactHeader(request);
      const attempt = clone(await bounded(loadAttempt, freeze({ attemptId }), preparationTimeoutMs, abort.signal));
      const binding = validateAttempt(attempt, { attemptId, path, canonicalOrigin, now: clock() });
      const keys = clone(await bounded(loadWitnessKeySnapshot, freeze({ keyId: attempt.keyId }), preparationTimeoutMs, abort.signal));
      const expected = freeze({ attemptId, deploymentId: binding.deploymentId, path, responseSha256: binding.responseSha256,
        manifestSha256: binding.manifestSha256, canonicalOrigin });
      const proof = verifyChallenge(rawChallenge, { keySnapshot: keys, expected });
      need(proof.decision === 'VERIFIED_PUBLIC_WITNESS_CHALLENGE', proof.decision, 404);
      need(proof.keyId === attempt.keyId, 'HOLD_WITNESS_KEY', 404);
      const claim = await bounded(claimChallenge, freeze({ attemptId, challengeId: proof.challengeId,
        challengeSha256: proof.challengeSha256, manifestSha256: proof.manifestSha256, validUntil: proof.validUntil }), preparationTimeoutMs, abort.signal);
      need(claim && claim.decision === 'CLAIMED_WITNESS_CHALLENGE' && claim.attemptId === attemptId
        && claim.challengeId === proof.challengeId, 'HOLD_WITNESS_CHALLENGE_REPLAY', 404);
      const text = await bounded(render, freeze({ attemptId, path, sourceSha256: binding.sourceSha256 }), preparationTimeoutMs, abort.signal);
      need(typeof text === 'string' && Buffer.byteLength(text) > 0 && Buffer.byteLength(text) <= MAX_BODY, 'HOLD_RENDER_INVALID');
      const bytes = Buffer.from(text, 'utf8'); need(hash(bytes) === binding.responseSha256, 'HOLD_RESPONSE_BINDING');
      const freshAttempt = clone(await bounded(loadAttempt, freeze({ attemptId }), preparationTimeoutMs, abort.signal));
      need(stableAttempt(freshAttempt) === stableAttempt(attempt), 'HOLD_ATTEMPT_DRIFT');
      validateAttempt(freshAttempt, { attemptId, path, canonicalOrigin, now: clock() });
      const freshKeys = clone(await bounded(loadWitnessKeySnapshot, freeze({ keyId: attempt.keyId }), preparationTimeoutMs, abort.signal));
      const freshProof = verifyChallenge(rawChallenge, { keySnapshot: freshKeys, expected });
      need(freshProof.decision === 'VERIFIED_PUBLIC_WITNESS_CHALLENGE' && freshProof.challengeSha256 === proof.challengeSha256,
        'HOLD_WITNESS_EXPIRED', 404);
      need(clock() < instant(freshProof.validUntil) && clock() < instant(attempt.validUntil), 'HOLD_WITNESS_EXPIRED', 404);
      need(!request.aborted && !response.destroyed && !response.headersSent && !response.writableEnded, 'HOLD_RESPONSE_UNAVAILABLE');
      clearHeaders(response);
      response.writeHead(200, { ...SAFE_HEADERS, 'Content-Length': String(bytes.length) });
      response.end(bytes); probeDispatched = true;
      // Receipt work uses its own bounded lifecycle after dispatch. The preparation
      // AbortController is intentionally not reused because the request handler may
      // return while Vercel keeps this completion alive with waitUntil().
      const completeWitness = async () => {
        const completionAbort = new AbortController();
        try {
          // The independent adapter must wait for the witness service to finish
          // receiving and authenticate its signed receipt. No Host/forwarded header,
          // response.finish event or local clock can substitute for this evidence.
          const rawReceipt = await bounded(awaitReceipt, freeze({ attemptId, challengeId: proof.challengeId,
            manifestSha256: proof.manifestSha256, canonicalOrigin, path, deploymentId: binding.deploymentId,
            responseSha256: binding.responseSha256 }), witnessTimeoutMs, completionAbort.signal);
          need(typeof rawReceipt === 'string' && Buffer.byteLength(rawReceipt) > 0 && Buffer.byteLength(rawReceipt) <= 24000, 'HOLD_WITNESS_RECEIPT');
          const recorded = await bounded(({ attemptId: id, envelope }) => recordReceipt(id, envelope),
            freeze({ attemptId, envelope: rawReceipt }), witnessTimeoutMs, completionAbort.signal);
          need(recorded && recorded.admissionRecorded === true
            && ['RECORDED_SIGNER_ASSERTION','RECORDED_BUT_REVOKED'].includes(recorded.decision), 'HOLD_WITNESS_RECORDING');
          need(recorded.decision === 'RECORDED_SIGNER_ASSERTION', 'HOLD_WITNESS_REVOKED');
          return result('WITNESS_RECEIPT_RECORDED', { probeDispatched: true, admissionRecorded: true,
            attemptId, challengeId: proof.challengeId, recordedAt: recorded.admittedAt ?? null });
        } catch (error) {
          const code = error instanceof Hold || /^HOLD_[A-Z_]+$/.test(error?.code ?? '') ? error.code : 'HOLD_WITNESS_FAILURE';
          return result(code, { probeDispatched: true, admissionRecorded: false, attemptId, challengeId: proof.challengeId });
        } finally { completionAbort.abort(); }
      };
      if (scheduleAfterResponse) {
        const scheduled = scheduleAfterResponse(completeWitness);
        need(scheduled && scheduled.decision === 'SCHEDULED_WITNESS_COMPLETION' && scheduled.scheduled === true,
          'HOLD_WITNESS_LIFECYCLE_UNAVAILABLE');
        return result('WITNESS_PROBE_DISPATCHED_PENDING_RECEIPT', { probeDispatched: true, admissionRecorded: false,
          attemptId, challengeId: proof.challengeId });
      }
      return await completeWitness();
    } catch (error) {
      const code = error instanceof Hold || /^HOLD_[A-Z_]+$/.test(error?.code ?? '') ? error.code : 'HOLD_WITNESS_FAILURE';
      if (!probeDispatched && !response.headersSent && !response.writableEnded && !response.destroyed) {
        const status = error?.status === 404 ? 404 : 503;
        const body = status === 404 ? 'Not found.\n' : 'Publication unavailable.\n';
        clearHeaders(response); response.writeHead(status, { ...SAFE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8',
          'Content-Length': String(Buffer.byteLength(body)) }); response.end(body);
      }
      return result(code, { probeDispatched, admissionRecorded: false });
    } finally { abort.abort(); }
  };
}
