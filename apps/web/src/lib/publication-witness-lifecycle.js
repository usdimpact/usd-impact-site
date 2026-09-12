import { waitUntil as vercelWaitUntil } from '@vercel/functions';

const outcome = (decision, extra = {}) => Object.freeze({ decision, ...extra,
  publicationAuthorized: false, admissionRecorded: false, enforcementActive: false });

/**
 * Trusted server-only adapter around Vercel's request-lifetime primitive.
 * A task is gated until waitUntil() accepts its promise, so a scheduler failure
 * cannot start post-response receipt work opportunistically.
 */
export function createVercelWitnessCompletionScheduler({ waitUntilFn = vercelWaitUntil } = {}) {
  if (typeof waitUntilFn !== 'function') throw Object.assign(new Error('HOLD_WITNESS_LIFECYCLE_CONFIG'), { code: 'HOLD_WITNESS_LIFECYCLE_CONFIG' });
  return Object.freeze({
    schedule(task) {
      if (typeof task !== 'function') return outcome('HOLD_WITNESS_LIFECYCLE_CONFIG', { scheduled: false });
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      const completion = gate.then(async () => {
        try { return await task(); }
        catch { return outcome('HOLD_WITNESS_COMPLETION_FAILURE', { scheduled: true }); }
      });
      try { waitUntilFn(completion); }
      catch { return outcome('HOLD_WITNESS_LIFECYCLE_UNAVAILABLE', { scheduled: false }); }
      release();
      return outcome('SCHEDULED_WITNESS_COMPLETION', { scheduled: true });
    },
  });
}
