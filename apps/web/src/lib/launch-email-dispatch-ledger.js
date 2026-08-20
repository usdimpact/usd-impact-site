import { readSupabaseServerConfig } from './supabase-server.js';
import {
  LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF,
  LAUNCH_EMAIL_PRODUCTION_PROJECT_REF,
  OUTBOX_SELECT_FIELDS,
  LaunchEmailDispatchError,
  deepFreeze,
  projectRefFromUrl,
} from './launch-email-dispatch-common.js';
import {
  lifecycleEmailLedgerEnabled,
  verifyLaunchEmailOutboxIdentity,
} from './launch-email-dispatch-intent.js';

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function serviceRequest({ config, path, method = 'GET', body, prefer, fetchImpl = fetch }) {
  const response = await fetchImpl(`${config.url}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    throw new LaunchEmailDispatchError(
      `Supabase launch email request failed with status ${response.status}.`,
      'LAUNCH_EMAIL_LEDGER_REQUEST_FAILED',
    );
  }
  return payload;
}

function assertExpectedProject(config, environment) {
  const actualRef = projectRefFromUrl(config.url);
  const vercelEnvironment = String(environment.VERCEL_ENV || '').trim().toLowerCase();
  if (vercelEnvironment === 'production') {
    if (environment.EMAIL_READINESS_PRODUCTION_APPROVED !== 'true') {
      throw new LaunchEmailDispatchError(
        'Production launch email ledger writes are not approved.',
        'PRODUCTION_LEDGER_NOT_APPROVED',
      );
    }
    if (actualRef !== LAUNCH_EMAIL_PRODUCTION_PROJECT_REF) {
      throw new LaunchEmailDispatchError(
        'Production launch email target does not match the canonical Production project.',
        'UNEXPECTED_SUPABASE_PROJECT',
      );
    }
    return actualRef;
  }
  if (actualRef !== LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF) {
    throw new LaunchEmailDispatchError(
      'Non-production launch email writes must target the canonical Development project.',
      'UNEXPECTED_SUPABASE_PROJECT',
    );
  }
  return actualRef;
}

function insertableOutboxRecord(record) {
  const { status: _status, attempt_count: _attemptCount, ...insertable } = record;
  return insertable;
}

export async function loadLaunchEmailOutbox({ config, intent, id = null, fetchImpl = fetch }) {
  const filter = id
    ? `id=eq.${encodeURIComponent(id)}`
    : `idempotency_key=eq.${encodeURIComponent(intent.outboxRecord.idempotency_key)}`;
  const rows = await serviceRequest({
    config,
    path: `/rest/v1/notification_outbox?${filter}&select=${OUTBOX_SELECT_FIELDS}&limit=1`,
    fetchImpl,
  });
  const outbox = Array.isArray(rows) ? rows[0] : null;
  if (!outbox) {
    throw new LaunchEmailDispatchError(
      'Notification outbox row could not be loaded.',
      'OUTBOX_ROW_MISSING',
    );
  }
  return verifyLaunchEmailOutboxIdentity(intent, outbox);
}

async function insertOrLoadOutbox({ config, intent, fetchImpl }) {
  const inserted = await serviceRequest({
    config,
    path: '/rest/v1/notification_outbox?on_conflict=idempotency_key',
    method: 'POST',
    body: insertableOutboxRecord(intent.outboxRecord),
    prefer: 'resolution=ignore-duplicates,return=representation',
    fetchImpl,
  });
  if (Array.isArray(inserted) && inserted.length === 1) {
    return verifyLaunchEmailOutboxIdentity(intent, inserted[0]);
  }
  return loadLaunchEmailOutbox({ config, intent, fetchImpl });
}

export async function enqueueLaunchEmailIntent({
  intent,
  environment = process.env,
  fetchImpl = fetch,
}) {
  if (!lifecycleEmailLedgerEnabled(environment)) {
    return deepFreeze({ enabled: false, intent });
  }
  if (!intent?.outboxRecord) {
    throw new LaunchEmailDispatchError(
      'A prepared launch email intent is required.',
      'INVALID_DISPATCH_INTENT',
    );
  }

  let config;
  try {
    config = readSupabaseServerConfig(environment, { requireSecret: true });
  } catch (error) {
    throw new LaunchEmailDispatchError(
      `Launch email database configuration is invalid: ${error?.code || 'CONFIGURATION_ERROR'}.`,
      'LAUNCH_EMAIL_LEDGER_CONFIGURATION_ERROR',
    );
  }
  const projectRef = assertExpectedProject(config, environment);
  const outbox = await insertOrLoadOutbox({ config, intent, fetchImpl });
  return deepFreeze({ enabled: true, config, projectRef, intent, outbox });
}

export async function patchLaunchEmailOutbox({ state, body, fetchImpl = fetch }) {
  const expectedStatus = String(state.outbox.status || '');
  const expectedAttemptCount = Number.isInteger(state.outbox.attempt_count)
    ? state.outbox.attempt_count
    : null;
  if (!expectedStatus || expectedAttemptCount === null || expectedAttemptCount < 0) {
    throw new LaunchEmailDispatchError(
      'Notification outbox compare-and-set state is invalid.',
      'INVALID_OUTBOX_STATE',
    );
  }

  const rows = await serviceRequest({
    config: state.config,
    path: `/rest/v1/notification_outbox?id=eq.${encodeURIComponent(state.outbox.id)}&status=eq.${encodeURIComponent(expectedStatus)}&attempt_count=eq.${expectedAttemptCount}`,
    method: 'PATCH',
    body,
    prefer: 'return=representation',
    fetchImpl,
  });
  const updated = Array.isArray(rows) ? rows[0] : null;
  if (!updated) {
    const current = await loadLaunchEmailOutbox({
      config: state.config,
      intent: state.intent,
      id: state.outbox.id,
      fetchImpl,
    });
    throw new LaunchEmailDispatchError(
      `Notification outbox state changed concurrently from ${expectedStatus}/${expectedAttemptCount} to ${current.status}/${current.attempt_count}.`,
      'OUTBOX_STATE_CONFLICT',
    );
  }
  return verifyLaunchEmailOutboxIdentity(state.intent, updated);
}
