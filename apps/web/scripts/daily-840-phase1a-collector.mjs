// Injected read-only adapters only: no built-in I/O, credentials or implicit clock.
// Callers authenticate and normalize the evidence. Errors contain no provider text.
import { ownData, READER_KEYS, sanitizeEvidencePart, validEditionDate, validUtc } from './daily-840-phase1a-classifier.mjs';

export async function collectDailyPhase1a(input) {
  try {
    const editionDate = ownData(input, 'editionDate'), startNow = ownData(input, 'now');
    if (!validEditionDate(editionDate) || !validUtc(startNow))
      return { editionDate: null, now: null, evidence: {}, errors: ['REQUEST_DATE_OR_CLOCK_INVALID'] };
    const readers = ownData(input, 'readers'), evidence = {}, errors = [];
    for (const key of READER_KEYS) {
      const read = ownData(readers, key);
      if (key === 'recoveryOrigin' && read === undefined) { evidence[key] = null; continue; }
      if (typeof read !== 'function') { evidence[key] = null; errors.push(`READER_MISSING:${key}`); continue; }
      try {
        const part = sanitizeEvidencePart(key, await read(editionDate));
        evidence[key] = part.value;
        if (!part.valid) errors.push(`READER_INVALID:${key}`);
      } catch { evidence[key] = null; errors.push(`READER_FAILED:${key}`); }
    }
    // Caller-injected trusted clock is sampled AFTER the last reader; never
    // use a pre-read timestamp to judge a later observation.
    const clock = ownData(input, 'clock');
    if (typeof clock !== 'function') return { editionDate, now: null, evidence, errors: [...errors, 'FINAL_CLOCK_MISSING'] };
    let finalNow;
    try { finalNow = await clock(); } catch { return { editionDate, now: null, evidence, errors: [...errors, 'FINAL_CLOCK_FAILED'] }; }
    if (!validUtc(finalNow) || Date.parse(finalNow) < Date.parse(startNow) ||
        Date.parse(finalNow) - Date.parse(startNow) > 10 * 60 * 1000)
      return { editionDate, now: null, evidence, errors: [...errors, 'FINAL_CLOCK_INVALID'] };
    return { editionDate, now: finalNow, evidence, errors };
  } catch { return { editionDate: null, now: null, evidence: {}, errors: ['INPUT_NOT_SAFE_DATA'] }; }
}
