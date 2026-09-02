import {
  exportOwnAccount,
  getVerifiedSupabaseUser,
  readAccountAccessState,
  requestOwnAccountDeletion,
  safeSupabaseError,
  sendJson,
} from '../src/lib/supabase-server.js';
import {
  clearPkceCookie,
  clearSessionCookies,
  exchangePasswordlessCode,
  readPkceVerifier,
  readSessionAccessToken,
  readSessionRefreshToken,
  refreshPasswordlessSession,
  revokePasswordlessSession,
  safeNextPath,
  sessionReadyLocation,
  sendPasswordlessEmail,
  setSessionCookies,
} from '../src/lib/supabase-auth.js';
import { enqueueAccountDeletionRequestedEmail } from '../src/lib/account-deletion-email.js';
import {
  runDueAccountDeletionFinalizer,
  validCronAuthorization,
} from '../src/lib/account-deletion-finalizer.js';
import { handleCommerceReadinessRequest } from '../src/lib/commerce-readiness-handler.js';
import { handleDailyCardReviewRequest } from '../src/lib/daily-card-progress-handler.js';
import { handleKnowledgeSearchRequest } from '../src/lib/knowledge-search-handler.js';
import { handleLifecycleQaRequest } from '../src/lib/lifecycle-qa-handler.js';
import { handlePasskeyRequest } from '../src/lib/passkey-handler.js';
import { enqueuePrivacyExportAcknowledgementEmail } from '../src/lib/privacy-export-email.js';
import { handlePushSubscriptionRequest } from '../src/lib/push-subscription-handler.js';
import {
  createSupportCaseReceivedEmailIntent,
  enqueueSupportCaseReceivedEmail,
} from '../src/lib/support-case-email.js';
import { createOwnSupportRequest } from '../src/lib/support-request.js';
import { handleVideoProgressRequest } from '../src/lib/video-progress-handler.js';

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function parseBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) return JSON.parse(request.body.toString());
  return {};
}

function requestUrl(request) {
  return new URL(request.url || '/api/account', 'https://usd-impact.invalid');
}

function action(request) {
  return requestUrl(request).searchParams.get('action')?.trim().toLowerCase() || '';
}

function methodNotAllowed(response, allowed) {
  response.setHeader('Allow', allowed);
  return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
}

function requireSameSiteJson(request, response) {
  if (header(request, 'sec-fetch-site') === 'cross-site') {
    sendJson(response, 403, { error: 'Cross-site requests are not allowed.', code: 'CROSS_SITE_REQUEST' });
    return false;
  }
  if (!header(request, 'content-type').includes('application/json')) {
    sendJson(response, 415, { error: 'Content type must be application/json.', code: 'INVALID_CONTENT_TYPE' });
    return false;
  }
  return true;
}

function redirect(response, location, status = 303) {
  response.statusCode = status;
  response.setHeader('Location', location);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end();
}

function logConfirmationFailure(error) {
  console.error('Supabase passwordless confirmation failed.', {
    name: error instanceof Error ? error.name : 'UnknownError',
    status: Number.isInteger(error?.status) ? error.status : null,
    code: typeof error?.code === 'string' ? error.code : null,
    message: error instanceof Error ? error.message : 'Unknown confirmation error.',
  });
}

async function recordSupportCaseEmailIntent(result) {
  let caseReference = null;
  try {
    const intent = createSupportCaseReceivedEmailIntent({ supportResult: result });
    caseReference = intent.customerReference;
    await enqueueSupportCaseReceivedEmail({ supportResult: result });
  } catch (error) {
    console.error('Support acknowledgement email intent could not be recorded.', {
      code: typeof error?.code === 'string'
        ? error.code
        : 'SUPPORT_CASE_EMAIL_INTENT_FAILED',
    });
  }
  return caseReference;
}

async function recordPrivacyExportEmailIntent({ exportResult, accessToken }) {
  try {
    const verifiedUser = await getVerifiedSupabaseUser(accessToken);
    return await enqueuePrivacyExportAcknowledgementEmail({
      exportResult,
      verifiedUser,
    });
  } catch (error) {
    console.error('Privacy export acknowledgement email intent could not be recorded.', {
      code: typeof error?.code === 'string'
        ? error.code
        : 'PRIVACY_EXPORT_EMAIL_INTENT_FAILED',
    });
    return null;
  }
}

async function recordAccountDeletionEmailIntent(result) {
  try {
    return await enqueueAccountDeletionRequestedEmail({ deletionResult: result });
  } catch (error) {
    console.error('Account deletion email intent could not be recorded.', {
      code: typeof error?.code === 'string'
        ? error.code
        : 'ACCOUNT_DELETION_EMAIL_INTENT_FAILED',
    });
    return null;
  }
}

async function handleLogin(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!requireSameSiteJson(request, response)) return;

  let payload;
  try {
    payload = parseBody(request);
  } catch {
    return sendJson(response, 400, { error: 'Invalid request body.', code: 'INVALID_REQUEST_BODY' });
  }

  try {
    await sendPasswordlessEmail({
      email: payload.email,
      next: payload.next,
      request,
      response,
    });
    return sendJson(response, 202, {
      ok: true,
      message: 'If the address can receive a sign-in email, a link has been sent.',
    });
  } catch (error) {
    const safe = safeSupabaseError(error);
    if (safe.status === 400 && safe.payload.code === 'INVALID_EMAIL') {
      return sendJson(response, 400, safe.payload);
    }
    if (safe.status < 500) {
      return sendJson(response, 202, {
        ok: true,
        message: 'If the address can receive a sign-in email, a link has been sent.',
      });
    }
    return sendJson(response, safe.status, safe.payload);
  }
}

async function handleConfirm(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');

  const url = requestUrl(request);
  const next = safeNextPath(url.searchParams.get('next'));
  const codeVerifier = readPkceVerifier(request);

  try {
    const session = await exchangePasswordlessCode({
      authCode: url.searchParams.get('code'),
      codeVerifier,
    });
    clearPkceCookie(response, request);
    setSessionCookies(response, request, session);
    return redirect(response, sessionReadyLocation(next));
  } catch (error) {
    logConfirmationFailure(error);
    clearPkceCookie(response, request);
    const safe = safeSupabaseError(error);
    const target = new URL('/account/sign-in/', 'https://usd-impact.invalid');
    target.searchParams.set('next', next);
    target.searchParams.set('error', safe.status >= 500 ? 'service_unavailable' : 'invalid_link');
    return redirect(response, `${target.pathname}${target.search}`);
  }
}

async function handleRefresh(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!requireSameSiteJson(request, response)) return;

  const refreshToken = readSessionRefreshToken(request);
  if (!refreshToken) {
    clearSessionCookies(response, request);
    return sendJson(response, 401, { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' });
  }

  try {
    const session = await refreshPasswordlessSession({ refreshToken });
    setSessionCookies(response, request, session);
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    clearSessionCookies(response, request);
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}

async function handleLogout(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!requireSameSiteJson(request, response)) return;

  const accessToken = readSessionAccessToken(request);
  clearSessionCookies(response, request);

  try {
    await revokePasswordlessSession({ accessToken });
  } catch (error) {
    console.error(error);
  }

  return sendJson(response, 200, { ok: true });
}

async function handleAccess(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');

  const accessToken = readSessionAccessToken(request);
  if (!accessToken) {
    return sendJson(response, 401, { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' });
  }

  try {
    const state = await readAccountAccessState({ accessToken });
    return sendJson(response, 200, {
      account: {
        id: state.user.id,
        email: state.user.email,
        status: state.profile?.status ?? 'missing',
      },
      paidAccess: {
        allowed: state.allowed,
        reason: state.reason,
        productId: state.entitlement?.productId ?? null,
        state: state.entitlement?.state ?? null,
      },
    });
  } catch (error) {
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}

async function handleSupport(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!requireSameSiteJson(request, response)) return;

  const accessToken = readSessionAccessToken(request);
  if (!accessToken) {
    return sendJson(response, 401, { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' });
  }

  let payload;
  try {
    payload = parseBody(request);
  } catch {
    return sendJson(response, 400, { error: 'Invalid request body.', code: 'INVALID_REQUEST_BODY' });
  }

  try {
    const result = await createOwnSupportRequest({
      accessToken,
      category: payload.category,
      subject: payload.subject,
      message: payload.message,
    });
    const caseReference = await recordSupportCaseEmailIntent(result);
    return sendJson(response, 202, {
      ok: true,
      status: result.request.status,
      caseReference,
      message: 'Your support request has been recorded.',
    });
  } catch (error) {
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}

async function handleExport(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!requireSameSiteJson(request, response)) return;

  const accessToken = readSessionAccessToken(request);
  if (!accessToken) {
    return sendJson(response, 401, { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' });
  }

  try {
    const exported = await exportOwnAccount({ accessToken });
    await recordPrivacyExportEmailIntent({ exportResult: exported, accessToken });
    response.setHeader('Content-Disposition', 'attachment; filename="usd-impact-account-export.json"');
    return sendJson(response, 200, exported);
  } catch (error) {
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}

async function handleDelete(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!requireSameSiteJson(request, response)) return;

  const accessToken = readSessionAccessToken(request);
  if (!accessToken) {
    return sendJson(response, 401, { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' });
  }

  try {
    const result = await requestOwnAccountDeletion({ accessToken });
    await recordAccountDeletionEmailIntent(result);
    return sendJson(response, 202, {
      ok: true,
      status: result.profile?.status ?? 'deletion_pending',
      deletionRequestedAt: result.profile?.deletion_requested_at ?? null,
      deletionDueAt: result.profile?.deletion_due_at ?? null,
    });
  } catch (error) {
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}

export async function handleAccountDeletionFinalizer(request, response) {
  if (process.env.ACCOUNT_DELETION_FINALIZER_ROUTE_ENABLED !== 'true') {
    return sendJson(response, 404, {
      error: 'Account deletion finalizer route is disabled.',
      code: 'ACCOUNT_DELETION_FINALIZER_ROUTE_DISABLED',
    });
  }
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
  if (!validCronAuthorization(request)) {
    return sendJson(response, 401, {
      error: 'Scheduler authorization is required.',
      code: 'SCHEDULER_AUTHORIZATION_REQUIRED',
    });
  }

  try {
    const result = await runDueAccountDeletionFinalizer();
    const failures = result.failed + result.recoveryFailed;
    return sendJson(response, failures > 0 ? 503 : 200, {
      ok: failures === 0,
      ...result,
    });
  } catch (error) {
    console.error('Account deletion finalizer route failed.', {
      code: typeof error?.code === 'string'
        ? error.code
        : 'ACCOUNT_DELETION_FINALIZER_ROUTE_FAILED',
    });
    return sendJson(response, 503, {
      error: 'Account deletion finalization is temporarily unavailable.',
      code: typeof error?.code === 'string'
        ? error.code
        : 'ACCOUNT_DELETION_FINALIZER_ROUTE_FAILED',
    });
  }
}

const handlers = Object.freeze({
  login: handleLogin,
  confirm: handleConfirm,
  refresh: handleRefresh,
  logout: handleLogout,
  access: handleAccess,
  support: handleSupport,
  export: handleExport,
  delete: handleDelete,
  passkey: handlePasskeyRequest,
  'deletion-finalizer': handleAccountDeletionFinalizer,
  'commerce-readiness': handleCommerceReadinessRequest,
  'video-progress': handleVideoProgressRequest,
  'push-subscription': handlePushSubscriptionRequest,
  'daily-card-review': handleDailyCardReviewRequest,
  'knowledge-search': handleKnowledgeSearchRequest,
  'lifecycle-qa': handleLifecycleQaRequest,
});

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const selected = handlers[action(request)];
  if (!selected) {
    return sendJson(response, 404, { error: 'Account action not found.', code: 'ACCOUNT_ACTION_NOT_FOUND' });
  }
  return selected(request, response);
}
