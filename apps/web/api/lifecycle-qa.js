import { randomBytes, timingSafeEqual } from 'node:crypto';
import { PAID_PRODUCT_ID } from '../src/lib/paid-access.js';
import { readSupabaseServerConfig, sendJson } from '../src/lib/supabase-server.js';
import { createResendLaunchEmailAdapter } from '../src/lib/launch-email-dispatch.js';
import {
  createSupportCaseReceivedEmailIntent,
  dispatchSupportCaseReceivedEmail,
  enqueueSupportCaseReceivedEmail,
} from '../src/lib/support-case-email.js';

const APPROVED_RECIPIENT = 'mircea.management+usdimpact-library-pass-qa@gmail.com';

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function authorized(request) {
  const expected = String(process.env.CRON_SECRET || '');
  const supplied = header(request, 'authorization').replace(/^Bearer\s+/i, '');
  if (expected.length < 32 || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function enabled() {
  return process.env.VERCEL_ENV === 'production'
    && process.env.LIFECYCLE_QA_ROUTE_ENABLED === 'true'
    && process.env.LIFECYCLE_QA_PRODUCTION_APPROVED === 'true'
    && process.env.LIFECYCLE_QA_RECIPIENT_EMAIL === APPROVED_RECIPIENT;
}

async function json(response) {
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    const error = new Error('Lifecycle QA provider request failed.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function service(config, path, options = {}) {
  return fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
      ...(options.headers || {}),
    },
  }).then(json);
}

async function existingFixture(config) {
  const rows = await service(
    config,
    `/rest/v1/profiles?email=eq.${encodeURIComponent(APPROVED_RECIPIENT)}&select=account_id,status&limit=1`,
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function createFixture(config) {
  if (await existingFixture(config)) {
    const error = new Error('The bounded Production QA fixture already exists.');
    error.code = 'LIFECYCLE_QA_FIXTURE_EXISTS';
    throw error;
  }

  const password = randomBytes(48).toString('base64url');
  const user = await service(config, '/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: APPROVED_RECIPIENT,
      password,
      email_confirm: true,
      app_metadata: { usd_impact_fixture: 'production-lifecycle-qa-v1' },
    }),
  });
  const userId = String(user?.id || '');
  if (!userId) throw new Error('Supabase did not return a QA user identifier.');

  try {
    const entitlementRows = await service(config, '/rest/v1/entitlements', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        account_id: userId,
        product_id: PAID_PRODUCT_ID,
        state: 'active',
      }),
    });
    const supportRows = await service(config, '/rest/v1/support_requests', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        account_id: userId,
        email: APPROVED_RECIPIENT,
        category: 'product',
        subject: 'Controlled Production lifecycle QA',
        message: 'Owner-approved bounded lifecycle delivery proof. No customer support action is required.',
      }),
    });
    const request = supportRows?.[0];
    if (!entitlementRows?.[0]?.id || !request?.id) {
      throw new Error('The bounded QA fixture was not persisted completely.');
    }

    const supportResult = {
      user: {
        id: userId,
        email: APPROVED_RECIPIENT,
        emailConfirmedAt: user.email_confirmed_at || user.confirmed_at,
      },
      request,
    };
    const intent = createSupportCaseReceivedEmailIntent({ supportResult });
    const state = await enqueueSupportCaseReceivedEmail({ supportResult });
    if (!state?.enabled) throw new Error('The Production lifecycle ledger is disabled.');

    const providerAdapter = createResendLaunchEmailAdapter();
    const dispatched = await dispatchSupportCaseReceivedEmail({
      state,
      providerAdapter,
      suppressionState: 'none',
    });
    return {
      accountId: userId,
      entitlementId: entitlementRows[0].id,
      supportRequestId: request.id,
      outboxId: state.outbox.id,
      customerReference: intent.customerReference,
      dispatchAction: dispatched.action,
    };
  } catch (error) {
    console.error('Lifecycle QA fixture requires reviewed recovery.', {
      accountId: userId,
      code: error?.code || 'LIFECYCLE_QA_PROVISION_FAILED',
    });
    throw error;
  }
}


async function cleanupFixture(config) {
  const fixture = await existingFixture(config);
  if (!fixture?.account_id) {
    const error = new Error('The bounded Production QA fixture does not exist.');
    error.code = 'LIFECYCLE_QA_FIXTURE_MISSING';
    throw error;
  }

  const outboxRows = await service(
    config,
    `/rest/v1/notification_outbox?recipient_email_normalized=eq.${encodeURIComponent(APPROVED_RECIPIENT)}&template_id=eq.support_case_received&select=id,status,provider_message_ref,accepted_at,delivered_at&order=created_at.desc&limit=2`,
  );
  if (!Array.isArray(outboxRows) || outboxRows.length !== 1 || outboxRows[0].status !== 'delivered') {
    const error = new Error('Cleanup requires exactly one independently delivered lifecycle email.');
    error.code = 'LIFECYCLE_QA_DELIVERY_NOT_PROVEN';
    throw error;
  }

  const accountId = fixture.account_id;
  await service(config, `/rest/v1/entitlements?account_id=eq.${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  });
  await service(config, `/rest/v1/support_requests?account_id=eq.${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  });
  await service(config, `/auth/v1/admin/users/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  });

  return {
    accountId,
    retainedOutboxId: outboxRows[0].id,
    providerMessageReference: outboxRows[0].provider_message_ref,
    acceptedAt: outboxRows[0].accepted_at,
    deliveredAt: outboxRows[0].delivered_at,
    cleanupAction: 'fixture_removed_delivery_evidence_retained',
  };
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (!enabled()) {
    return sendJson(response, 404, {
      error: 'Lifecycle QA route is disabled.',
      code: 'LIFECYCLE_QA_ROUTE_DISABLED',
    });
  }
  if (!['POST', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'POST, DELETE');
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }
  if (!authorized(request)) {
    return sendJson(response, 401, {
      error: 'Scheduler authorization is required.',
      code: 'SCHEDULER_AUTHORIZATION_REQUIRED',
    });
  }

  try {
    const config = readSupabaseServerConfig(process.env, { requireSecret: true });
    const result = request.method === 'DELETE'
      ? await cleanupFixture(config)
      : await createFixture(config);
    return sendJson(response, request.method === 'DELETE' ? 200 : 202, { ok: true, ...result });
  } catch (error) {
    console.error('Bounded Production lifecycle QA failed.', {
      code: error?.code || 'LIFECYCLE_QA_FAILED',
      status: Number.isInteger(error?.status) ? error.status : null,
    });
    return sendJson(response, 503, {
      error: 'Bounded Production lifecycle QA requires review.',
      code: error?.code || 'LIFECYCLE_QA_FAILED',
    });
  }
}
