const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireText(value, name) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new TypeError(`${name} is required.`);
  return normalized;
}

function requireUuid(value, name) {
  const normalized = requireText(value, name);
  if (!UUID_PATTERN.test(normalized)) throw new TypeError(`${name} must be a UUID.`);
  return normalized;
}

function requirePlan(plan) {
  if (!plan || typeof plan !== 'object' || plan.action !== 'apply') {
    throw new TypeError('An applicable Research Membership mutation plan is required.');
  }
  if (!plan.event || !plan.subscriptionPatch || !plan.entitlementPatch || !plan.eventInsert) {
    throw new TypeError('Research Membership mutation plan is incomplete.');
  }
  return plan;
}

export function researchMembershipPersistenceRpcBody({ plan, subscriptionId }) {
  const normalizedPlan = requirePlan(plan);
  const event = normalizedPlan.event;
  const subscriptionPatch = normalizedPlan.subscriptionPatch;
  const entitlementPatch = normalizedPlan.entitlementPatch;
  const eventInsert = normalizedPlan.eventInsert;

  return Object.freeze({
    p_subscription_id: requireUuid(subscriptionId, 'subscriptionId'),
    p_event_key: requireText(normalizedPlan.eventKey, 'eventKey'),
    p_provider_event_id: requireText(event.providerEventId, 'providerEventId'),
    p_expected_provider: requireText(event.provider, 'provider'),
    p_expected_provider_subscription_id: requireText(event.providerSubscriptionId, 'providerSubscriptionId'),
    p_expected_from_state: requireText(event.fromState, 'fromState'),
    p_to_state: requireText(subscriptionPatch.state, 'toState'),
    p_current_period_start: subscriptionPatch.currentPeriodStart,
    p_current_period_end: subscriptionPatch.currentPeriodEnd,
    p_cancel_at_period_end: subscriptionPatch.cancelAtPeriodEnd === true,
    p_entitlement_state: requireText(entitlementPatch.state, 'entitlementState'),
    p_entitlement_starts_at: entitlementPatch.startsAt,
    p_entitlement_ends_at: entitlementPatch.endsAt,
    p_reason: requireText(eventInsert.reason, 'reason'),
    p_occurred_at: requireText(eventInsert.occurredAt, 'occurredAt'),
    p_metadata: eventInsert.metadata || {},
  });
}

function readPersistenceConfig(environment = process.env) {
  const rawUrl = requireText(environment.SUPABASE_URL, 'SUPABASE_URL');
  const secretKey = requireText(environment.SUPABASE_SECRET_KEY, 'SUPABASE_SECRET_KEY');
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new TypeError('SUPABASE_URL is invalid.');
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new TypeError('SUPABASE_URL must use HTTPS outside localhost.');
  }
  if (!secretKey.startsWith('sb_secret_')) throw new TypeError('SUPABASE_SECRET_KEY is invalid.');
  return Object.freeze({ url: url.origin, secretKey });
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

export async function persistResearchMembershipTransition({
  plan,
  subscriptionId,
  environment = process.env,
  fetchImpl = fetch,
}) {
  if (plan?.action === 'duplicate') {
    return Object.freeze({ action: 'duplicate', eventKey: plan.eventKey });
  }

  const body = researchMembershipPersistenceRpcBody({ plan, subscriptionId });
  const config = readPersistenceConfig(environment);
  const response = await fetchImpl(`${config.url}/rest/v1/rpc/apply_research_membership_transition`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || 'Research Membership persistence failed.');
    error.code = payload?.code || 'RESEARCH_MEMBERSHIP_PERSISTENCE_FAILED';
    error.status = response.status;
    throw error;
  }
  if (!payload || !['applied', 'duplicate'].includes(payload.action)) {
    throw new Error('Research Membership persistence returned an invalid result.');
  }
  return Object.freeze({ ...payload });
}
