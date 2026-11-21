import { readSupabaseServerConfig } from './supabase-server.js';
import {
  LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF,
  LAUNCH_EMAIL_PRODUCTION_PROJECT_REF,
  LaunchEmailDispatchError, deepFreeze, projectRefFromUrl,
} from './launch-email-dispatch-common.js';
import {
  lifecycleEmailLedgerEnabled, verifyLaunchEmailOutboxIdentity,
} from './launch-email-dispatch-intent.js';
import { verifyPurchaseAccessReadyAtomicPair } from './purchase-access-ready-atomic-pair-review.js';

// The only permitted purchase_access_ready writer. The service-role-only
// Postgres RPC inserts the outbox and locale snapshot IN ONE transaction.
// No generic outbox-only fallback and no historical email backfill.
export async function enqueuePurchaseAccessReadyAtomic({
  accessResult, prepared, environment = process.env, fetchImpl = fetch,
} = {}) {
  const intent = prepared?.intent;
  if (!intent || intent.messageId !== 'purchase_access_ready') {
    throw new LaunchEmailDispatchError(
      'The purchase access notification intent is not verified.',
      'INVALID_PURCHASE_ACCESS_READY_INTENT',
    );
  }
  if (!lifecycleEmailLedgerEnabled(environment)
    || environment.PURCHASE_ACCESS_READY_ATOMIC_LEDGER_ENABLED !== 'true') {
    return deepFreeze({ enabled: false, intent });
  }
  const isProduction = String(environment.VERCEL_ENV || '').trim().toLowerCase() === 'production';
  if (isProduction && environment.EMAIL_READINESS_PRODUCTION_APPROVED !== 'true') {
    throw new LaunchEmailDispatchError(
      'Production email ledger writes are not approved.',
      'PRODUCTION_LEDGER_NOT_APPROVED',
    );
  }
  if (isProduction && environment.PURCHASE_ACCESS_READY_PRODUCTION_APPROVED !== 'true') {
    throw new LaunchEmailDispatchError(
      'Production atomic purchase email writes are not approved.',
      'PURCHASE_ACCESS_READY_PRODUCTION_HOLD',
    );
  }
  let config;
  try {
    config = readSupabaseServerConfig(environment, { requireSecret: true });
  } catch {
    throw new LaunchEmailDispatchError(
      'Atomic purchase email ledger configuration is unavailable.',
      'PURCHASE_ACCESS_READY_LEDGER_CONFIG_HOLD',
    );
  }
  const expectedProject = isProduction
    ? LAUNCH_EMAIL_PRODUCTION_PROJECT_REF
    : LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF;
  const actualProject = projectRefFromUrl(config.url);
  if (actualProject !== expectedProject) {
    throw new LaunchEmailDispatchError(
      'The atomic purchase email ledger targets an unapproved Supabase project.',
      'UNEXPECTED_SUPABASE_PROJECT',
    );
  }
  let response;
  try {
    response = await fetchImpl(config.url + '/rest/v1/rpc/ui02_enqueue_access_ready_atomic', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        apikey: config.secretKey,
        Authorization: 'Bearer ' + config.secretKey,
      },
      body: JSON.stringify({ p_purchase_id: accessResult?.purchase?.id }),
    });
  } catch {
    throw new LaunchEmailDispatchError(
      'Atomic purchase notification ledger is not available.',
      'PURCHASE_ACCESS_READY_ATOMIC_RPC_HOLD',
    );
  }
  if (!response?.ok) {
    throw new LaunchEmailDispatchError(
      'Atomic purchase email ledger rejected the request.',
      'PURCHASE_ACCESS_READY_ATOMIC_RPC_HOLD',
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new LaunchEmailDispatchError(
      'Atomic purchase email ledger returned invalid data.',
      'PURCHASE_ACCESS_READY_ATOMIC_RESPONSE_HOLD',
    );
  }
  if (!result || result.state !== 'atomic_pair_verified' || !result.outbox || !result.snapshot) {
    throw new LaunchEmailDispatchError(
      'Atomic purchase email ledger did not return a complete pair.',
      'PURCHASE_ACCESS_READY_ATOMIC_RESPONSE_HOLD',
    );
  }
  try {
    const outbox = verifyLaunchEmailOutboxIdentity(intent, result.outbox);
    const checked = verifyPurchaseAccessReadyAtomicPair({
      accessResult, outbox, snapshot: result.snapshot,
    });
    if (checked.state !== 'MATCHED_REVIEW_ONLY' || checked.locale !== 'en') {
      throw new Error('Unapproved locale or pair state');
    }
    return deepFreeze({
      enabled: true, intent, config, projectRef: actualProject, outbox,
    });
  } catch {
    throw new LaunchEmailDispatchError(
      'The immutable notification pair does not match the verified purchase.',
      'PURCHASE_ACCESS_READY_ATOMIC_PAIR_HOLD',
    );
  }
}
