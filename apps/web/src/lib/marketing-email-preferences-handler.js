import {
  MarketingEmailPreferencesError,
  inspectMarketingEmailUnsubscribe,
  readMarketingEmailPreferences,
  withdrawMarketingEmailPurpose,
} from './marketing-email-preferences.js';
import {
  MarketingEmailPreferenceTokenError,
  verifyMarketingEmailUnsubscribeToken,
} from './marketing-email-preference-token.js';
import {
  getVerifiedSupabaseUser,
  readBearerToken,
  requestHeader,
} from './supabase-server.js';

const PURPOSE_LABELS = Object.freeze({
  weekly_newsletter: 'Weekly USD Impact email',
  learning_progress_updates: 'USD Impact learning progress updates',
});

function sendJson(response, status, body, extraHeaders = {}) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(JSON.stringify(body));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sendHtml(response, status, { heading, body, form = '' }) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  );
  response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${escapeHtml(heading)} | USD Impact</title></head><body style="margin:0;background:#f5f6f8;color:#161a1f;font-family:Arial,Helvetica,sans-serif;"><main style="min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;"><section style="width:min(620px,100%);background:#fff;border:1px solid #e6e9ed;border-radius:16px;padding:36px;box-sizing:border-box;"><p style="margin:0 0 12px;color:#8a6b32;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">USD Impact</p><h1 style="margin:0 0 18px;color:#071a33;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.2;">${escapeHtml(heading)}</h1><p style="margin:0 0 24px;color:#5a6472;font-size:17px;line-height:1.65;">${escapeHtml(body)}</p>${form}</section></main></body></html>`);
}

function requestUrl(request) {
  return new URL(request.url || '/email/unsubscribe', 'https://usd-impact.invalid');
}

function parseFormBody(request) {
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) {
    return Object.fromEntries(new URLSearchParams(request.body.toString()));
  }
  return {};
}

function tokenFromRequest(request) {
  const urlToken = requestUrl(request).searchParams.get('token');
  if (urlToken) return urlToken;
  return String(parseFormBody(request).token ?? '').trim();
}

function explicitUnsubscribe(request) {
  const body = parseFormBody(request);
  return body['List-Unsubscribe'] === 'One-Click'
    || body.confirm === true
    || body.confirm === 'true';
}

function safeError(request, response, error) {
  const status = Number.isInteger(error?.status) ? error.status : 503;
  const code = error?.code || 'MARKETING_EMAIL_PREFERENCES_FAILED';
  const acceptsHtml = requestHeader(request, 'accept').toLowerCase().includes('text/html');
  if (acceptsHtml) {
    return sendHtml(response, status, {
      heading: status >= 500 ? 'Email preferences unavailable' : 'Preference link unavailable',
      body: status >= 500
        ? 'The email preference service is temporarily unavailable. Please try again later.'
        : 'This email preference link is invalid or no longer matches an active subscription.',
    });
  }
  return sendJson(response, status, {
    error: status >= 500
      ? 'Email preferences are temporarily unavailable.'
      : 'This email preference request could not be completed.',
    code,
  });
}

async function handleReadPreferences(
  request,
  response,
  {
    readPreferences = readMarketingEmailPreferences,
    getVerifiedUser = getVerifiedSupabaseUser,
    environment = process.env,
  } = {},
) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET' });
  }
  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return sendJson(response, 401, {
      error: 'Authentication is required to view email preferences.',
      code: 'AUTHENTICATION_REQUIRED',
    });
  }

  try {
    const user = await getVerifiedUser(accessToken, { environment });
    const preferences = await readPreferences({ email: user.email, environment });
    return sendJson(response, 200, {
      weeklyNewsletter: { subscribed: preferences.weeklyNewsletter.active },
      learningProgressUpdates: { subscribed: preferences.learningProgressUpdates.active },
      locale: 'en',
      subscribeEndpoint: '/api/email-subscribe',
    });
  } catch (error) {
    return safeError(request, response, error);
  }
}

async function handleUnsubscribe(
  request,
  response,
  {
    inspect = inspectMarketingEmailUnsubscribe,
    withdraw = withdrawMarketingEmailPurpose,
    environment = process.env,
  } = {},
) {
  if (!['GET', 'POST'].includes(request.method)) {
    return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET, POST' });
  }

  const token = tokenFromRequest(request);
  if (!token) {
    return safeError(request, response, new MarketingEmailPreferenceTokenError(
      'Unsubscribe token is missing.',
      'INVALID_MARKETING_EMAIL_UNSUBSCRIBE_TOKEN',
      400,
    ));
  }

  if (request.method === 'GET') {
    try {
      const verified = verifyMarketingEmailUnsubscribeToken({
        token,
        secret: environment.MARKETING_OPT_IN_SECRET,
      });
      const state = await inspect({ token, environment });
      const label = PURPOSE_LABELS[verified.purpose] || 'USD Impact email';
      if (!state.active) {
        return sendHtml(response, 200, {
          heading: 'Email preference already updated',
          body: `${label} is already stopped. Other requested or required USD Impact communications are unaffected.`,
        });
      }
      const action = `/email/unsubscribe?token=${encodeURIComponent(token)}`;
      return sendHtml(response, 200, {
        heading: `Stop ${label}?`,
        body: `This action affects only ${label}. Required account, security, purchase, refund, privacy, and support communications remain separate.`,
        form: `<form method="post" action="${escapeHtml(action)}"><input type="hidden" name="List-Unsubscribe" value="One-Click"><button type="submit" style="border:0;border-radius:10px;background:#071a33;color:#fff;cursor:pointer;font-size:16px;font-weight:700;padding:14px 22px;">Confirm unsubscribe</button></form>`,
      });
    } catch (error) {
      return safeError(request, response, error);
    }
  }

  const contentType = requestHeader(request, 'content-type').toLowerCase();
  if (
    !contentType.includes('application/x-www-form-urlencoded')
    && !contentType.includes('application/json')
  ) {
    return sendJson(response, 415, { error: 'Unsupported content type.', code: 'INVALID_CONTENT_TYPE' });
  }
  if (!explicitUnsubscribe(request)) {
    return sendJson(response, 400, {
      error: 'Explicit unsubscribe confirmation is required.',
      code: 'UNSUBSCRIBE_CONFIRMATION_REQUIRED',
    });
  }

  try {
    const result = await withdraw({ token, environment });
    if (requestHeader(request, 'accept').toLowerCase().includes('text/html')) {
      const label = PURPOSE_LABELS[result.purpose] || 'USD Impact email';
      return sendHtml(response, 200, {
        heading: 'Email preference updated',
        body: `${label} is now stopped. Other requested or required USD Impact communications are unaffected.`,
      });
    }
    response.statusCode = 200;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end();
    return undefined;
  } catch (error) {
    return safeError(request, response, error);
  }
}

export async function handleMarketingEmailPreferencesRequest(
  request,
  response,
  action,
  options = {},
) {
  if (action === 'marketing-email-preferences') {
    return handleReadPreferences(request, response, options);
  }
  if (action === 'marketing-email-unsubscribe') {
    return handleUnsubscribe(request, response, options);
  }
  return sendJson(response, 404, {
    error: 'Email preference action not found.',
    code: 'EMAIL_PREFERENCE_ACTION_NOT_FOUND',
  });
}

export { MarketingEmailPreferencesError };
