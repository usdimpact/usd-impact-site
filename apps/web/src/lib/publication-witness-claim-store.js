const ID = /^[a-f0-9]{32}$/;
const HEX = /^[a-f0-9]{64}$/;
const ORIGIN = 'https://www.usd-impact.com';
const fail = (code) => { throw Object.assign(new Error(code), { code }); };
const need = (ok, code) => { if (!ok) fail(code); };
const freeze = (value) => {
  if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
};
const clone = (value) => freeze(JSON.parse(JSON.stringify(value)));
const outcome = (decision, extra = {}) => Object.freeze({ decision, ...extra,
  publicationAuthorized: false, admissionRecorded: false, enforcementActive: false });
function instant(value) {
  need(typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), 'HOLD_WITNESS_CLAIM_TIME');
  const n = Date.parse(value); need(Number.isFinite(n) && new Date(n).toISOString() === value, 'HOLD_WITNESS_CLAIM_TIME'); return n;
}
function request(value, now) {
  need(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 6
    && ['attemptId','challengeId','challengeSha256','manifestSha256','canonicalOrigin','validUntil'].every((key) => Object.hasOwn(value, key)), 'HOLD_WITNESS_CLAIM_REQUEST');
  need(ID.test(value.attemptId) && ID.test(value.challengeId)
    && HEX.test(value.challengeSha256) && HEX.test(value.manifestSha256)
    && value.canonicalOrigin === ORIGIN, 'HOLD_WITNESS_CLAIM_REQUEST');
  need(instant(value.validUntil) > now, 'HOLD_WITNESS_CLAIM_EXPIRED');
  return clone(value);
}
function stored(record, input, now) {
  need(record && typeof record === 'object' && !Array.isArray(record)
    && record.schema === 'stored-witness-challenge-claim/v1'
    && record.attemptId === input.attemptId && record.challengeId === input.challengeId
    && record.challengeSha256 === input.challengeSha256 && record.manifestSha256 === input.manifestSha256
    && record.canonicalOrigin === input.canonicalOrigin && record.validUntil === input.validUntil, 'HOLD_WITNESS_CLAIM_MISMATCH');
  const claimed = instant(record.claimedAt); const until = instant(record.validUntil);
  need(claimed < until, 'HOLD_WITNESS_CLAIM_TIME');
  return outcome('CLAIMED_WITNESS_CHALLENGE', { claimed: true, attemptId: input.attemptId,
    challengeId: input.challengeId, canonicalOrigin: input.canonicalOrigin, claimedAt: record.claimedAt, validUntil: record.validUntil });
}

/**
 * One-write challenge claimer. Exact persisted evidence is mandatory. An explicit
 * database replay response stays a replay; only an ambiguous transport failure may
 * be reconciled by one exact read. No second write is attempted.
 */
export function createWitnessChallengeClaimStore({ commitClaim, readClaim, now = Date.now, timeoutMs = 3000 } = {}) {
  need([commitClaim, readClaim, now].every((fn) => typeof fn === 'function'), 'HOLD_WITNESS_CLAIM_ADAPTER');
  need(Number.isInteger(timeoutMs) && timeoutMs >= 10 && timeoutMs <= 5000, 'HOLD_WITNESS_CLAIM_CONFIG');
  let highest = -1;
  function clock() { const n = now(); need(Number.isSafeInteger(n) && n >= 0 && n >= highest, 'HOLD_WITNESS_CLAIM_CLOCK'); highest = n; return n; }
  async function call(fn, arg) {
    const controller = new AbortController(); let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(() => fn(arg, { signal: controller.signal })),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Object.assign(new Error('HOLD_WITNESS_CLAIM_TIMEOUT'), { code: 'HOLD_WITNESS_CLAIM_TIMEOUT' })); }, timeoutMs); }),
      ]);
    } finally { clearTimeout(timer); }
  }
  async function reconcile(input) {
    const record = await call(readClaim, freeze({ attemptId: input.attemptId, challengeId: input.challengeId,
      challengeSha256: input.challengeSha256 }));
    if (record === null) return outcome('HOLD_WITNESS_CLAIM_UNRESOLVED', { claimed: false });
    return stored(clone(record), input, clock());
  }
  return Object.freeze({
    async claim(value) {
      let input; let writeStarted = false;
      try {
        input = request(value, clock()); writeStarted = true;
        const acknowledgement = await call(commitClaim, input);
        if (acknowledgement && typeof acknowledgement === 'object'
          && acknowledgement.decision === 'HOLD_WITNESS_CHALLENGE_REPLAY') {
          return outcome('HOLD_WITNESS_CHALLENGE_REPLAY', { claimed: false });
        }
        return await reconcile(input);
      } catch (error) {
        if (error?.code === 'HOLD_WITNESS_CHALLENGE_REPLAY' || String(error?.message ?? '').includes('HOLD_WITNESS_CHALLENGE_REPLAY')) {
          return outcome('HOLD_WITNESS_CHALLENGE_REPLAY', { claimed: false });
        }
        if (writeStarted) {
          try { return await reconcile(input); }
          catch { return outcome('HOLD_WITNESS_CLAIM_UNRESOLVED', { claimed: false }); }
        }
        const allowed = new Set(['HOLD_WITNESS_CLAIM_REQUEST','HOLD_WITNESS_CLAIM_EXPIRED','HOLD_WITNESS_CLAIM_CLOCK']);
        return outcome(allowed.has(error?.code) ? error.code : 'HOLD_WITNESS_CLAIM_FAILURE', { claimed: false });
      }
    },
    async reconcile(value) {
      try { return await reconcile(request(value, clock())); }
      catch { return outcome('HOLD_WITNESS_CLAIM_UNRESOLVED', { claimed: false }); }
    },
  });
}
