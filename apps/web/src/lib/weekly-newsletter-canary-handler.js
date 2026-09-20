import {
  CANARY_CHECKSUM, CANARY_DATABASE, CANARY_ORIGIN, CANARY_WEEK,
  WeeklyCanaryError, canaryRecipient, executeWeeklyCanary,
} from './weekly-newsletter-canary.js';
import { readSessionAccessToken } from './supabase-auth.js';
import { getVerifiedSupabaseUser, readSupabaseServerConfig, requestHeader } from './supabase-server.js';
import { createMarketingOptInResendAdapter } from './marketing-opt-in-resend-adapter.js';
import { createWeeklyNewsletterResendAdapter } from './weekly-newsletter-resend-adapter.js';
import { prepareMarketingOptInRequest } from './marketing-opt-in-readiness.js';
import { deliverMarketingOptInConfirmation } from './marketing-opt-in-delivery.js';
import { readMarketingEmailPreferences, inspectMarketingEmailUnsubscribe } from './marketing-email-preferences.js';
import { createMarketingEmailUnsubscribeToken } from './marketing-email-preference-token.js';
import { evaluateWeeklyNewsletterCandidate } from './weekly-newsletter-candidate.js';
import {
  loadWeeklyNewsletterEditionArtifact, enqueueWeeklyNewsletterOutbox, deliverWeeklyNewsletterOutbox,
} from './weekly-newsletter-dispatch.js';

async function boundedFetch(input, options = {}) {
  const url = new URL(String(input));
  if (![CANARY_DATABASE, CANARY_ORIGIN, 'https://api.resend.com'].includes(url.origin)
      || url.username || url.password) throw new WeeklyCanaryError('CANARY_DESTINATION_REJECTED');
  return fetch(url.toString(), { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) });
}

async function readRows(environment, query) {
  const config = readSupabaseServerConfig(environment, { requireSecret: true });
  const response = await boundedFetch(`${CANARY_DATABASE}/rest/v1/notification_outbox?${query}`, {
    headers: { Accept: 'application/json', apikey: config.secretKey, Authorization: `Bearer ${config.secretKey}` },
  });
  if (!response.ok) throw new WeeklyCanaryError('CANARY_STATE_UNAVAILABLE');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new WeeklyCanaryError('CANARY_STATE_INVALID');
  return rows;
}

const runtimePorts = Object.freeze({
  validateConfiguration(environment) {
    readSupabaseServerConfig(environment, { requireSecret: true });
    // Construction only; neither adapter sends until its explicit send method is called.
    createMarketingOptInResendAdapter({ environment, fetchImpl: boundedFetch });
    createWeeklyNewsletterResendAdapter({ environment, fetchImpl: boundedFetch });
  },
  loadSource: () => loadWeeklyNewsletterEditionArtifact({
    weekEnding: CANARY_WEEK, expectedChecksum: CANARY_CHECKSUM, baseUrl: CANARY_ORIGIN, fetchImpl: boundedFetch,
  }),
  readPreferences: (input) => readMarketingEmailPreferences({ ...input, fetchImpl: boundedFetch }),
  async readState({ email, environment }) {
    const prefix = `recipient_email_normalized=eq.${encodeURIComponent(email)}&select=status&limit=2`;
    const [weekly, confirmations] = await Promise.all([
      readRows(environment, `${prefix}&template_id=eq.weekly_newsletter`),
      readRows(environment, `${prefix}&template_id=eq.marketing_opt_in_confirmation&payload->>purpose=eq.weekly_newsletter`),
    ]);
    return { weekly, confirmations };
  },
  evaluateCandidate: evaluateWeeklyNewsletterCandidate,
  async verifyUnsubscribe({ grant, environment }) {
    const token = createMarketingEmailUnsubscribeToken({
      consentIdempotencyKey: grant.idempotency_key, purpose: 'weekly_newsletter', secret: environment.MARKETING_OPT_IN_SECRET,
    });
    // Inspect is read-only. Actual append-only withdrawal remains an explicit user action.
    const inspected = await inspectMarketingEmailUnsubscribe({ token, environment, fetchImpl: boundedFetch });
    if (inspected?.active !== true) throw new WeeklyCanaryError('CANARY_UNSUBSCRIBE_PREFLIGHT_FAILED');
  },
  prepareOptIn: (input) => prepareMarketingOptInRequest({ ...input, fetchImpl: boundedFetch }),
  deliverOptIn: (input) => deliverMarketingOptInConfirmation({ ...input, databaseFetch: boundedFetch, providerFetch: boundedFetch }),
  enqueue: (input) => enqueueWeeklyNewsletterOutbox({ ...input, fetchImpl: boundedFetch }),
  deliverWeekly: (input) => deliverWeeklyNewsletterOutbox({
    ...input, databaseFetch: boundedFetch, artifactFetch: boundedFetch, providerFetch: boundedFetch,
  }),
});

function respond(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.end(JSON.stringify(payload));
}

function parseAction(request) {
  if (request.method === 'GET') return { operation: 'inspect', confirmed: false };
  if (requestHeader(request, 'origin') !== CANARY_ORIGIN
      || requestHeader(request, 'sec-fetch-site') === 'cross-site') {
    throw new WeeklyCanaryError('CANARY_CROSS_SITE_REJECTED', 403);
  }
  if (requestHeader(request, 'content-type').split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new WeeklyCanaryError('CANARY_CONTENT_TYPE_INVALID', 415);
  }
  let body;
  try {
    const raw = request.body;
    const serialized = Buffer.isBuffer(raw) ? raw.toString('utf8') : typeof raw === 'string' ? raw : JSON.stringify(raw);
    if (typeof serialized !== 'string' || Buffer.byteLength(serialized) > 1024) throw new Error();
    body = JSON.parse(serialized);
  } catch { throw new WeeklyCanaryError('CANARY_BODY_INVALID', 400); }
  if (!body || Array.isArray(body) || typeof body !== 'object'
      || Object.keys(body).some((key) => !['operation', 'confirm'].includes(key))
      || !['request-confirmation', 'send-weekly'].includes(body.operation)
      || body.confirm !== true) throw new WeeklyCanaryError('CANARY_BODY_INVALID', 400);
  return { operation: body.operation, confirmed: true };
}

export async function handleWeeklyNewsletterCanary(request, response, {
  environment = process.env, ports = runtimePorts, getUser = getVerifiedSupabaseUser,
  readToken = readSessionAccessToken, now = () => new Date(),
} = {}) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return respond(response, 405, { code: 'METHOD_NOT_ALLOWED' });
  }
  try {
    // Reject wrong environment/database before sending a session credential to Auth.
    const recipient = canaryRecipient(environment);
    if (environment.SUPABASE_URL !== CANARY_DATABASE) throw new WeeklyCanaryError('CANARY_DATABASE_MISMATCH');
    const action = parseAction(request);
    const token = readToken(request);
    if (!token) throw new WeeklyCanaryError('AUTHENTICATION_REQUIRED', 401);
    let user;
    try { user = await getUser(token, { environment, fetchImpl: boundedFetch }); }
    catch (error) {
      if (error?.status === 401) throw new WeeklyCanaryError('AUTHENTICATION_REQUIRED', 401);
      throw error;
    }
    if (String(user?.email ?? '').toLowerCase() !== recipient) throw new WeeklyCanaryError('CANARY_NOT_AUTHORIZED', 403);
    const result = await executeWeeklyCanary({ ...action, user, environment, ports, now: now() });
    return respond(response, 200, result);
  } catch (error) {
    // Do not return dependency messages, credentials, recipient identities, or signed links.
    const known = error instanceof WeeklyCanaryError;
    return respond(response, known ? error.status : 503, {
      code: known ? error.code : 'CANARY_DEPENDENCY_UNAVAILABLE',
      error: 'The controlled test could not proceed. No automatic retry will be attempted.',
    });
  }
}
