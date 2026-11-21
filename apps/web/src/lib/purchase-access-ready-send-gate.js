import {
  LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF,
  LAUNCH_EMAIL_PRODUCTION_PROJECT_REF,
  LaunchEmailDispatchError,
  deepFreeze,
  projectRefFromUrl,
} from './launch-email-dispatch-common.js';

// This is invoked by the ONLY shared lifecycle provider dispatch path after
// the outbox is independently loaded, but BEFORE marking it "sending".
// Other message types retain their existing provider/consent behavior.
// The database RPC makes its own fresh verified-purchase, account, entitlement
// and immutable-snapshot check. No failed/missing proof can reach Resend.
export async function assertPurchaseAccessReadySendGate({
  state,
  environment = process.env,
  fetchImpl = fetch,
} = {}) {
  if (state?.intent?.messageId !== 'purchase_access_ready') {
    return deepFreeze({ checked: false, reason: 'other_message' });
  }
  if (environment.PURCHASE_ACCESS_READY_ATOMIC_DISPATCH_ENABLED !== 'true') {
    throw new LaunchEmailDispatchError(
      'Atomic purchase email sending has not been independently approved.',
      'PURCHASE_ACCESS_READY_DISPATCH_HOLD',
    );
  }
  const isProd = String(environment.VERCEL_ENV || '').trim().toLowerCase() === 'production';
  if (isProd && environment.PURCHASE_ACCESS_READY_PRODUCTION_APPROVED !== 'true') {
    throw new LaunchEmailDispatchError(
      'Production purchase access notification sending remains on hold.',
      'PURCHASE_ACCESS_READY_PRODUCTION_HOLD',
    );
  }
  const expectedProject = isProd
    ? LAUNCH_EMAIL_PRODUCTION_PROJECT_REF
    : LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF;
  const currentProject = projectRefFromUrl(state?.config?.url);
  if (currentProject !== expectedProject || state?.projectRef !== expectedProject
    || typeof state?.config?.secretKey !== 'string'
    || !state.config.secretKey.trim()) {
    throw new LaunchEmailDispatchError(
      'Purchase email dispatch project binding is incomplete.',
      'PURCHASE_ACCESS_READY_DISPATCH_PROJECT_HOLD',
    );
  }
  const key = state?.outbox?.idempotency_key;
  const id = state?.outbox?.id;
  if (typeof key !== 'string' || !/^notification:v1:[0-9a-f]{64}$/.test(key)
    || typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new LaunchEmailDispatchError(
      'Purchase email outbox identity is invalid.',
      'PURCHASE_ACCESS_READY_DISPATCH_IDENTITY_HOLD',
    );
  }
  let response;
  try {
    response = await fetchImpl(
      state.config.url + '/rest/v1/rpc/ui02_check_access_ready_dispatch',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          apikey: state.config.secretKey,
          Authorization: 'Bearer ' + state.config.secretKey,
        },
        body: JSON.stringify({ p_outbox_id: id, p_idempotency_key: key }),
      },
    );
  } catch {
    throw new LaunchEmailDispatchError(
      'The purchase email dispatch verification service is unavailable.',
      'PURCHASE_ACCESS_READY_DISPATCH_PROOF_HOLD',
    );
  }
  if (!response?.ok) {
    throw new LaunchEmailDispatchError(
      'The purchase email dispatch verification service denied this send.',
      'PURCHASE_ACCESS_READY_DISPATCH_PROOF_HOLD',
    );
  }
  let proof;
  try {
    proof = await response.json();
  } catch {
    throw new LaunchEmailDispatchError(
      'The purchase email dispatch verification response was invalid.',
      'PURCHASE_ACCESS_READY_DISPATCH_PROOF_HOLD',
    );
  }
  if (!proof || proof.verified !== true
    || proof.locale !== 'en'
    || proof.outboxId !== id
    || proof.idempotencyKey !== key
    || proof.templateVersion !== state.outbox.template_version
    || proof.templateVersion !== state.intent.outboxRecord.template_version) {
    throw new LaunchEmailDispatchError(
      'The provider-ready email and immutable purchase snapshot do not match.',
      'PURCHASE_ACCESS_READY_DISPATCH_PROOF_HOLD',
    );
  }
  return deepFreeze({ checked: true, verified: true, locale: 'en' });
}
