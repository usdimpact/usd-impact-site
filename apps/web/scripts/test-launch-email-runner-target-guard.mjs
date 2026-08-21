import assert from 'node:assert/strict';
import {
  LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF,
  LAUNCH_EMAIL_PRODUCTION_PROJECT_REF,
  runLaunchEmailDispatchBatch,
} from '../src/lib/launch-email-dispatch.js';

let ledgerCalled = false;
let providerCalled = false;

await assert.rejects(
  () => runLaunchEmailDispatchBatch({
    tasks: [{
      state: {
        enabled: true,
        projectRef: LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF,
        config: {
          url: `https://${LAUNCH_EMAIL_PRODUCTION_PROJECT_REF}.supabase.co`,
          secretKey: 'sb_secret_abcdefghijklmnopqrstuvwxyz',
        },
        intent: { messageId: 'support_case_received' },
        outbox: { id: '9ca40ee4-6477-4fcb-88cc-bf4488dd9adc' },
      },
    }],
    environment: {
      VERCEL_ENV: 'preview',
      LAUNCH_EMAIL_DISPATCH_ENABLED: 'true',
    },
    ledgerFetchImpl: async () => {
      ledgerCalled = true;
      throw new Error('mismatched target must not reach the ledger');
    },
    providerFetchImpl: async () => {
      providerCalled = true;
      throw new Error('mismatched target must not reach the provider');
    },
  }),
  (error) => error?.code === 'UNEXPECTED_SUPABASE_PROJECT',
);

assert.equal(ledgerCalled, false);
assert.equal(providerCalled, false);

console.log('Lifecycle dispatch runner target guard tests passed.');
