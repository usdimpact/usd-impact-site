import { createHash, createPublicKey, verify } from 'node:crypto';

const SCOPE = Object.freeze({ repository: 'usdimpact/usd-impact-site',
  projectId: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7', teamId: 'team_1LuMlacGuM198mRjoID4O3Ct' });
const MANIFEST_FIELDS = Object.freeze(['schema','challengeId','canonicalOrigin','repository','projectId','teamId',
  'deploymentId','path','attemptId','responseSha256','method','status','boundaryVersion']);
const PAYLOAD_FIELDS = Object.freeze(['schema','keyId','audience','manifest','manifestSha256','issuedAt','expiresAt']);
const PREFIX = 'usd-impact/public-response-witness-challenge/v1\n';
const HEX = /^[a-f0-9]{64}$/;
const ID = /^[a-f0-9]{32}$/;
const PATH = /^\/news\/(?:[0-9]{4}-[0-9]{2}-[0-9]{2}|catalysts\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const fail = (code) => { throw Object.assign(new Error(code), { code }); };
const need = (value, code) => { if (!value) fail(code); };
const exact = (o, fields) => o && typeof o === 'object' && !Array.isArray(o)
  && Object.keys(o).length === fields.length && fields.every((key) => Object.hasOwn(o, key));
const canonical = (o, fields) => {
  need(exact(o, fields), 'HOLD_WITNESS_SCHEMA');
  return JSON.stringify(Object.fromEntries(fields.map((key) => [key, o[key]])));
};
const hash = (value) => createHash('sha256').update(value).digest('hex');
function instant(value) {
  need(typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), 'HOLD_WITNESS_TIME');
  const n = Date.parse(value); need(Number.isFinite(n) && new Date(n).toISOString() === value, 'HOLD_WITNESS_TIME'); return n;
}
function b64(value, max) {
  need(typeof value === 'string' && value.length > 0 && value.length <= max && /^[A-Za-z0-9_-]+$/.test(value), 'HOLD_WITNESS_ENCODING');
  const bytes = Buffer.from(value, 'base64url'); need(bytes.toString('base64url') === value, 'HOLD_WITNESS_ENCODING'); return bytes;
}
function origin(value) {
  need(typeof value === 'string' && value.length <= 200, 'HOLD_WITNESS_ORIGIN');
  let url; try { url = new URL(value); } catch { fail('HOLD_WITNESS_ORIGIN'); }
  need(url.protocol === 'https:' && url.username === '' && url.password === '' && url.port === ''
    && url.pathname === '/' && url.search === '' && url.hash === '' && url.hostname.includes('.'), 'HOLD_WITNESS_ORIGIN');
  return value.replace(/\/$/, '');
}
function validateManifest(manifest) {
  canonical(manifest, MANIFEST_FIELDS);
  need(manifest.schema === 'public-response-witness-manifest/v1', 'HOLD_WITNESS_SCHEMA');
  need(Object.entries(SCOPE).every(([key, value]) => manifest[key] === value), 'HOLD_WITNESS_SCOPE');
  need(typeof manifest.challengeId === 'string' && ID.test(manifest.challengeId)
    && typeof manifest.attemptId === 'string' && ID.test(manifest.attemptId), 'HOLD_WITNESS_ID');
  need(typeof manifest.deploymentId === 'string' && /^dpl_[A-Za-z0-9]{8,80}$/.test(manifest.deploymentId), 'HOLD_WITNESS_BINDING');
  need(typeof manifest.path === 'string' && PATH.test(manifest.path) && manifest.path.length <= 240, 'HOLD_WITNESS_BINDING');
  need(typeof manifest.responseSha256 === 'string' && HEX.test(manifest.responseSha256), 'HOLD_WITNESS_BINDING');
  need(manifest.method === 'GET' && manifest.status === 200 && manifest.boundaryVersion === 'publication-dispatch/v1', 'HOLD_WITNESS_BINDING');
  origin(manifest.canonicalOrigin);
}
export function encodeWitnessManifest(manifest) { validateManifest(manifest); return canonical(manifest, MANIFEST_FIELDS); }
export function witnessManifestSha256(manifest) { return hash(encodeWitnessManifest(manifest)); }
export function encodeWitnessChallengePayload(payload) {
  canonical(payload, PAYLOAD_FIELDS); validateManifest(payload.manifest);
  need(payload.schema === 'public-response-witness-challenge/v1'
    && payload.audience === 'publication-first-response-probe', 'HOLD_WITNESS_SCHEMA');
  need(typeof payload.keyId === 'string' && /^[a-z0-9-]{1,64}$/.test(payload.keyId), 'HOLD_WITNESS_KEY');
  need(typeof payload.manifestSha256 === 'string' && HEX.test(payload.manifestSha256)
    && payload.manifestSha256 === witnessManifestSha256(payload.manifest), 'HOLD_WITNESS_BINDING');
  instant(payload.issuedAt); instant(payload.expiresAt);
  return canonical(payload, PAYLOAD_FIELDS);
}
export function witnessChallengeSigningBytes(payloadText) { return Buffer.from(PREFIX + payloadText, 'utf8'); }

/** Verifies a short-lived probe challenge signed by a dedicated public-response
 * witness key. This authenticates the witness service and a canonical-origin
 * assertion; it does not authenticate the incoming Host header or mint history.
 */
export function createWitnessChallengeVerifier({ now = Date.now } = {}) {
  let highest = -1;
  function clock() { const n = now(); need(Number.isSafeInteger(n) && n >= highest && n >= 0, 'HOLD_WITNESS_CLOCK'); highest = n; return n; }
  return function verifyChallenge(rawEnvelope, { keySnapshot, expected } = {}) {
    try {
      const n = clock();
      need(typeof rawEnvelope === 'string' && Buffer.byteLength(rawEnvelope) > 0 && Buffer.byteLength(rawEnvelope) <= 20000, 'HOLD_WITNESS_ENVELOPE');
      const envelope = JSON.parse(rawEnvelope);
      need(exact(envelope, ['payload','signature']) && rawEnvelope === JSON.stringify({ payload: envelope.payload, signature: envelope.signature }), 'HOLD_WITNESS_ENVELOPE');
      const payloadBytes = b64(envelope.payload, 15000); const signature = b64(envelope.signature, 128);
      need(signature.length === 64, 'HOLD_WITNESS_SIGNATURE');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(payloadBytes);
      const payload = JSON.parse(text); need(text === encodeWitnessChallengePayload(payload), 'HOLD_WITNESS_NONCANONICAL');
      need(exact(expected, ['attemptId','deploymentId','path','responseSha256','manifestSha256','canonicalOrigin'])
        && payload.manifest.attemptId === expected.attemptId && payload.manifest.deploymentId === expected.deploymentId
        && payload.manifest.path === expected.path && payload.manifest.responseSha256 === expected.responseSha256
        && payload.manifestSha256 === expected.manifestSha256 && payload.manifest.canonicalOrigin === expected.canonicalOrigin,
      'HOLD_WITNESS_BINDING');
      need(exact(keySnapshot, ['observedAt','validUntil','keys']) && Array.isArray(keySnapshot.keys)
        && keySnapshot.keys.length > 0 && keySnapshot.keys.length <= 8, 'HOLD_WITNESS_KEY_SNAPSHOT');
      const observed = instant(keySnapshot.observedAt), valid = instant(keySnapshot.validUntil);
      need(observed <= n && n < valid && valid - observed <= 15000, 'HOLD_WITNESS_KEY_SNAPSHOT');
      const ids = keySnapshot.keys.map((key) => key?.keyId); need(new Set(ids).size === ids.length, 'HOLD_WITNESS_KEY_SNAPSHOT');
      const key = keySnapshot.keys.find((item) => item?.keyId === payload.keyId);
      need(key && exact(key, ['keyId','purpose','publicKeyPem','notBefore','notAfter','revoked'])
        && key.purpose === 'public-response-witness' && key.revoked === false, 'HOLD_WITNESS_KEY');
      const publicKey = createPublicKey(key.publicKeyPem);
      need(publicKey.type === 'public' && publicKey.asymmetricKeyType === 'ed25519'
        && verify(null, witnessChallengeSigningBytes(text), publicKey, signature), 'HOLD_WITNESS_SIGNATURE');
      const issued = instant(payload.issuedAt), expires = instant(payload.expiresAt);
      need(issued <= n && n < expires && expires - issued <= 15000 && n - issued <= 15000, 'HOLD_WITNESS_EXPIRED');
      need(instant(key.notBefore) <= issued && n < instant(key.notAfter), 'HOLD_WITNESS_KEY');
      const final = clock(); need(final < expires && final < valid && final < instant(key.notAfter), 'HOLD_WITNESS_EXPIRED');
      return Object.freeze({ decision: 'VERIFIED_PUBLIC_WITNESS_CHALLENGE', challengeId: payload.manifest.challengeId,
        keyId: payload.keyId, manifestSha256: payload.manifestSha256, challengeSha256: hash(rawEnvelope),
        validUntil: new Date(Math.min(expires, valid, instant(key.notAfter))).toISOString(),
        publicationAuthorized: false, admissionRecorded: false, enforcementActive: false });
    } catch (error) {
      return Object.freeze({ decision: typeof error?.code === 'string' && /^HOLD_WITNESS_[A-Z_]+$/.test(error.code)
        ? error.code : 'HOLD_WITNESS_INVALID', publicationAuthorized: false, admissionRecorded: false, enforcementActive: false });
    }
  };
}
