import { verifyLemonSqueezyWebhookSignature } from './lemon-squeezy-adapter-scaffold.js';
import {
  inspectLemonSqueezyResearchMembershipWebhook,
  normalizeLemonSqueezyResearchMembershipWebhook,
  prepareLemonSqueezyResearchMembershipTransition,
} from './lemon-squeezy-research-membership-adapter.js';
import { persistResearchMembershipTransition } from './research-membership-persistence.js';
import {
  RESEARCH_MEMBERSHIP_PRODUCT_ID,
  normalizeResearchMembershipLifecycleEvent,
} from './research-membership-runtime.js';
import { researchMembershipEventKey } from './research-membership-event-adapter.js';

const DEVELOPMENT_PROJECT_REF = 'ycstrcvshdluovtuasjc';
const PRODUCTION_PROJECT_REF = 'gjzetjugmnwanvjkchux';
const PROVIDER = 'lemon-squeezy';
const MAX_BODY_BYTES = 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function enabled(value) {
  return text(String(value ?? '')).toLowerCase() === 'true';
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new TypeError(`${name} is invalid.`);
  return parsed;
}

function projectRef(value) {
  try {
    return new URL(value).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

function configurationError(message, code = 'RESEARCH_WEBHOOK_CONFIGURATION_INVALID') {
  const error = new Error(message);
  error.code = code;
  error.status = 503;
  return error;
}

function recurringProviderConfig(environment, prefix, expectedTestMode) {
  const secret = text(environment[`${prefix}_WEBHOOK_SECRET`]);
  const supabaseSecret = text(environment.SUPABASE_SECRET_KEY);
  if (secret.length < 16 || !supabaseSecret.startsWith('sb_secret_')) {
    throw configurationError('Research Membership webhook credentials are invalid.');
  }

  const variants = [
    positiveInteger(environment[`${prefix}_MONTHLY_VARIANT_ID`], 'monthly variant'),
    positiveInteger(environment[`${prefix}_ANNUAL_VARIANT_ID`], 'annual variant'),
  ];
  if (variants[0] === variants[1]) throw new TypeError('Research Membership recurring variants must be distinct.');

  return Object.freeze({
    secret,
    storeId: positiveInteger(environment[`${prefix}_STORE_ID`], 'store id'),
    productId: positiveInteger(environment[`${prefix}_PRODUCT_ID`], 'product id'),
    variantIds: Object.freeze(variants),
    expectedTestMode,
    supabaseUrl: new URL(environment.SUPABASE_URL).origin,
    supabaseSecret,
  });
}

function readConfig(environment = process.env) {
  const vercelEnvironment = text(environment.VERCEL_ENV).toLowerCase();
  if (!enabled(environment.RESEARCH_MEMBERSHIP_WEBHOOK_ENABLED)) {
    throw configurationError('Research Membership webhook execution is disabled.', 'RESEARCH_WEBHOOK_DISABLED');
  }

  if (vercelEnvironment === 'preview') {
    if (projectRef(environment.SUPABASE_URL) !== DEVELOPMENT_PROJECT_REF) {
      throw configurationError('Research Membership Preview webhook must target canonical Development Supabase.', 'RESEARCH_WEBHOOK_DATABASE_MISMATCH');
    }
    if (!enabled(environment.LEMON_SQUEEZY_RESEARCH_TEST_MODE)) {
      throw configurationError('Research Membership Preview webhook requires Lemon Squeezy Test Mode.', 'RESEARCH_WEBHOOK_TEST_MODE_REQUIRED');
    }
    return recurringProviderConfig(environment, 'LEMON_SQUEEZY_RESEARCH_TEST', true);
  }

  if (vercelEnvironment === 'production') {
    if (!enabled(environment.RESEARCH_MEMBERSHIP_PRODUCTION_ACTIVATION_APPROVED)) {
      throw configurationError('Research Membership Production webhook activation is not approved.', 'RESEARCH_WEBHOOK_PRODUCTION_NOT_APPROVED');
    }
    if (projectRef(environment.SUPABASE_URL) !== PRODUCTION_PROJECT_REF) {
      throw configurationError('Research Membership Production webhook must target canonical Production Supabase.', 'RESEARCH_WEBHOOK_DATABASE_MISMATCH');
    }
    if (enabled(environment.LEMON_SQUEEZY_RESEARCH_PRODUCTION_TEST_MODE)) {
      throw configurationError('Research Membership Production webhook must reject Lemon Squeezy Test Mode.', 'RESEARCH_WEBHOOK_PRODUCTION_TEST_MODE_REJECTED');
    }
    return recurringProviderConfig(environment, 'LEMON_SQUEEZY_RESEARCH_PRODUCTION', false);
  }

  const error = new Error('Research Membership webhook execution is limited to Vercel Preview or Production.');
  error.code = 'RESEARCH_WEBHOOK_ENVIRONMENT_REJECTED';
  error.status = 403;
  throw error;
}

function rawBuffer(rawBody) {
  if (Buffer.isBuffer(rawBody)) {
    if (rawBody.length > MAX_BODY_BYTES) throw new Error('REQUEST_BODY_TOO_LARGE');
    return rawBody;
  }
  if (typeof rawBody === 'string') {
    const buffer = Buffer.from(rawBody, 'utf8');
    if (buffer.length > MAX_BODY_BYTES) throw new Error('REQUEST_BODY_TOO_LARGE');
    return buffer;
  }
  throw new TypeError('rawBody must be the exact webhook body.');
}

function signedEnvelope(rawBody, signature, secret) {
  const body = rawBuffer(rawBody);
  if (!verifyLemonSqueezyWebhookSignature({ rawBody: body, signature, secret })) {
    const error = new Error('Invalid Lemon Squeezy webhook signature.');
    error.code = 'RESEARCH_WEBHOOK_SIGNATURE_INVALID';
    error.status = 401;
    throw error;
  }
  let payload;
  try {
    payload = JSON.parse(body.toString('utf8'));
  } catch {
    const error = new Error('Webhook JSON is invalid.');
    error.code = 'RESEARCH_WEBHOOK_INVALID_JSON';
    error.status = 400;
    throw error;
  }
  const data = payload?.data;
  const attributes = data?.attributes;
  if (!data || typeof data !== 'object' || !attributes || typeof attributes !== 'object') {
    const error = new Error('Webhook payload shape is invalid.');
    error.code = 'RESEARCH_WEBHOOK_INVALID_PAYLOAD';
    error.status = 400;
    throw error;
  }
  const providerSubscriptionId = data.type === 'subscriptions'
    ? text(String(data.id ?? ''))
    : data.type === 'subscription-invoices'
      ? text(String(attributes.subscription_id ?? ''))
      : '';
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$/.test(providerSubscriptionId)) {
    const error = new Error('Webhook subscription identifier is invalid.');
    error.code = 'RESEARCH_WEBHOOK_SUBSCRIPTION_ID_INVALID';
    error.status = 400;
    throw error;
  }
  return { body, providerSubscriptionId };
}

function headers(secretKey) {
  return {
    Accept: 'application/json',
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
  };
}

async function readJson(response) {
  const raw = await response.text();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function loadExistingSubscription({ config, providerSubscriptionId, fetchImpl }) {
  const query = new URLSearchParams({
    select: 'id,account_id,product_id,provider,provider_subscription_id,state,current_period_start,current_period_end,cancel_at_period_end',
    provider: `eq.${PROVIDER}`,
    provider_subscription_id: `eq.${providerSubscriptionId}`,
    product_id: `eq.${RESEARCH_MEMBERSHIP_PRODUCT_ID}`,
    limit: '2',
  });
  const response = await fetchImpl(`${config.supabaseUrl}/rest/v1/subscriptions?${query}`, {
    headers: headers(config.supabaseSecret),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    const error = new Error('Research Membership subscription lookup failed.');
    error.code = 'RESEARCH_WEBHOOK_SUBSCRIPTION_LOOKUP_FAILED';
    error.status = 502;
    throw error;
  }
  if (!Array.isArray(payload) || payload.length !== 1) {
    const error = new Error('Research Membership subscription binding was not uniquely resolved.');
    error.code = 'RESEARCH_WEBHOOK_SUBSCRIPTION_NOT_FOUND';
    error.status = 409;
    throw error;
  }
  const row = payload[0];
  if (!row || !UUID_PATTERN.test(row.id) || !UUID_PATTERN.test(row.account_id)) {
    throw replayError('RESEARCH_WEBHOOK_SUBSCRIPTION_NOT_FOUND', 409);
  }
  return {
    id: row.id,
    accountId: row.account_id,
    productId: row.product_id,
    provider: row.provider,
    providerSubscriptionId: row.provider_subscription_id,
    state: row.state,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
  };
}

function replayError(code = 'RESEARCH_WEBHOOK_REPLAY_CONFLICT', status = 409) {
  const error = new Error('Research Membership replay evidence could not be verified.');
  error.code = code;
  error.status = status;
  return error;
}

async function loadProcessedEvent({ config, eventKey, fetchImpl }) {
  // Look up the globally unique key without filtering away conflicting bindings.
  const query = new URLSearchParams({
    select: 'event_key,subscription_id,account_id,product_id,provider_event_id,from_state,to_state,reason,actor_type,occurred_at,metadata',
    event_key: `eq.${eventKey}`,
    limit: '2',
  });
  let response;
  let rows;
  try {
    response = await fetchImpl(`${config.supabaseUrl}/rest/v1/subscription_events?${query}`, {
      headers: headers(config.supabaseSecret),
    });
    rows = await readJson(response);
  } catch {
    throw replayError('RESEARCH_WEBHOOK_EVENT_LOOKUP_FAILED', 502);
  }
  if (!response.ok || !Array.isArray(rows)) throw replayError('RESEARCH_WEBHOOK_EVENT_LOOKUP_FAILED', 502);
  if (rows.length > 1) throw replayError();
  if (rows.length === 0) return null;
  if (!rows[0] || typeof rows[0] !== 'object' || Array.isArray(rows[0])) throw replayError();
  return rows[0];
}

function verifiedDuplicate(row, { inspected, options, eventKey }) {
  const subscription = options.existingSubscription;
  const metadata = row.metadata;
  if (row.event_key !== eventKey
      || row.subscription_id !== subscription.id
      || row.account_id !== subscription.accountId
      || row.product_id !== RESEARCH_MEMBERSHIP_PRODUCT_ID
      || row.provider_event_id !== inspected.providerEventId
      || row.actor_type !== 'provider_webhook'
      || typeof row.occurred_at !== 'string'
      || Date.parse(row.occurred_at) !== Date.parse(inspected.occurredAt)
      || !metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw replayError();

  for (const field of ['lemonEventName', 'lemonDataType', 'lemonDataId', 'lemonStatus', 'lemonBillingReason', 'testMode']) {
    if (metadata[field] !== inspected.metadata[field]) throw replayError();
  }
  // Legacy rows have only the six provider fields above. Compare every field
  // they retained, without inventing a historical full-payload fingerprint.
  // A present but invalid/version-mismatched fingerprint never falls back.
  if (Object.hasOwn(metadata, 'replayFingerprint') || Object.hasOwn(metadata, 'replayFingerprintVersion')) {
    if (metadata.replayFingerprintVersion !== 1
        || metadata.replayFingerprint !== inspected.metadata.replayFingerprint) throw replayError();
  }
  try {
    // Reconstruct classification using the archived from-state, not today's
    // terminal state or billing period. This never constructs a mutation plan.
    const normalized = normalizeLemonSqueezyResearchMembershipWebhook({
      ...options,
      existingSubscription: { ...subscription, state: row.from_state, currentPeriodStart: null, currentPeriodEnd: null },
    });
    if (normalized.action !== 'apply') throw replayError();
    const event = normalizeResearchMembershipLifecycleEvent({
      ...normalized.providerEvent, accountId: subscription.accountId, currentState: row.from_state,
    });
    if (event.toState !== row.to_state || event.eventType !== row.reason) throw replayError();
  } catch {
    throw replayError();
  }
  return Object.freeze({ action: 'duplicate', eventKey, providerSubscriptionId: subscription.providerSubscriptionId });
}

export async function processResearchMembershipWebhook({
  rawBody,
  signature,
  environment = process.env,
  fetchImpl = fetch,
}) {
  const config = readConfig(environment);
  const envelope = signedEnvelope(rawBody, signature, config.secret);
  const existingSubscription = await loadExistingSubscription({
    config,
    providerSubscriptionId: envelope.providerSubscriptionId,
    fetchImpl,
  });
  const options = {
    rawBody: envelope.body,
    signature,
    secret: config.secret,
    existingSubscription,
    expectedStoreId: config.storeId,
    expectedProductId: config.productId,
    expectedVariantIds: config.variantIds,
    expectedTestMode: config.expectedTestMode,
  };
  // Authenticate and validate all provider/account bindings before consulting
  // duplicate evidence. No state transition is authorized by this inspection.
  const inspected = inspectLemonSqueezyResearchMembershipWebhook(options);
  const eventKey = researchMembershipEventKey(inspected.provider, inspected.providerEventId);
  const replayContext = { inspected, options, eventKey };
  const readEvent = () => loadProcessedEvent({ config, eventKey, fetchImpl });
  const previous = await readEvent();
  if (previous) return verifiedDuplicate(previous, replayContext);

  let plan;
  try {
    plan = prepareLemonSqueezyResearchMembershipTransition(options);
  } catch (error) {
    if (error?.code === 'RESEARCH_MEMBERSHIP_INVALID_TRANSITION') {
      const concurrent = await readEvent();
      if (concurrent) return verifiedDuplicate(concurrent, replayContext);
    }
    throw error;
  }
  if (plan.action === 'ignore') {
    return Object.freeze({ action: 'ignored', providerEventId: plan.providerEventId, reason: plan.reason });
  }

  let persisted;
  try {
    persisted = await persistResearchMembershipTransition({
      plan,
      subscriptionId: existingSubscription.id,
      environment,
      fetchImpl,
    });
  } catch (error) {
    // The response may be lost after commit, or another delivery may have won.
    // Reconcile by one read only; never resubmit the RPC or loosen state guards.
    const concurrent = await readEvent();
    if (concurrent) return verifiedDuplicate(concurrent, replayContext);
    throw error;
  }
  if (persisted.action === 'duplicate') {
    const concurrent = await readEvent();
    if (!concurrent) throw replayError();
    return verifiedDuplicate(concurrent, replayContext);
  }
  return Object.freeze({
    action: persisted.action,
    eventKey: plan.eventKey,
    providerSubscriptionId: existingSubscription.providerSubscriptionId,
  });
}

export function publicResearchMembershipWebhookError(error) {
  const knownStatus = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    ? error.status
    : 400;
  const code = text(error?.code) || 'RESEARCH_WEBHOOK_REJECTED';
  return Object.freeze({
    status: knownStatus,
    payload: Object.freeze({
      error: knownStatus >= 500 ? 'Research Membership webhook processing is unavailable.' : 'Research Membership webhook was rejected.',
      code,
    }),
  });
}
