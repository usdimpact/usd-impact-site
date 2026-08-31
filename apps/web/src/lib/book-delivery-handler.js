import {
  readAccountAccessState,
  safeSupabaseError,
} from './supabase-server.js';
import {
  readSessionAccessToken,
  requestOrigin,
  safeNextPath,
} from './supabase-auth.js';
import {
  buildPaidAccessRequiredRedirect,
  buildPaidSignInRedirect,
  normalizePaidAccessReason,
} from './paid-route.js';
import {
  BOOK_DOWNLOAD_PATH,
  BOOK_MEMBER_PATH,
  createSignedBookUrl,
  privateBookDocument,
} from './private-book.js';

const ROUTE_PARAM = '__book_path';
const BOOK_FLAG = '__book';

function requestUrl(request) {
  return new URL(request.url || '/api/guided-edition', 'https://usd-impact.invalid');
}

function originalRequestUrl(request) {
  const internalUrl = requestUrl(request);
  const rawRoute = String(internalUrl.searchParams.get(ROUTE_PARAM) || '').trim();
  internalUrl.searchParams.delete(ROUTE_PARAM);
  internalUrl.searchParams.delete(BOOK_FLAG);
  let decodedRoute = '';
  try {
    decodedRoute = rawRoute ? decodeURIComponent(rawRoute).replace(/^\/+|\/+$/g, '') : '';
  } catch {
    throw new Error('Invalid book route.');
  }
  const candidate = decodedRoute ? `${BOOK_MEMBER_PATH}${decodedRoute}/` : BOOK_MEMBER_PATH;
  const safePath = safeNextPath(candidate, BOOK_MEMBER_PATH);
  const parsed = new URL(safePath, 'https://usd-impact.invalid');
  if (!parsed.pathname.startsWith(BOOK_MEMBER_PATH)) throw new Error('Invalid book route.');
  const query = internalUrl.searchParams.toString();
  const target = `${parsed.pathname}${parsed.search}${query ? `${parsed.search ? '&' : '?'}${query}` : ''}`;
  return new URL(target, requestOrigin(request));
}

function redirect(response, destination, status = 302) {
  response.statusCode = status;
  response.setHeader('Location', destination instanceof URL
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : String(destination));
  response.end();
}

function methodNotAllowed(response) {
  response.statusCode = 405;
  response.setHeader('Allow', 'GET, HEAD');
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.end('Method not allowed.');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderProtectedBook() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Read the Dollar First Digital Reader | USD Impact</title><style>:root{--navy:#071a33;--gold:#c9a35b;--paper:#f5f7fa;--ink:#101923;--line:#d7dde5}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,system-ui,sans-serif}header,footer{background:var(--navy);color:#fff;padding:22px}.wrap{max-width:820px;margin:auto}.hero{background:#0b2443;color:#fff;padding:54px 22px}main{padding:34px 22px 64px}.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:28px;margin-bottom:22px}.button{display:inline-block;background:var(--gold);color:#071a33;border-radius:999px;padding:14px 22px;text-decoration:none;font-weight:700}.meta{color:#5a6472}.hash{overflow-wrap:anywhere;font-family:ui-monospace,monospace;font-size:.85rem}.notice{border-left:4px solid var(--gold);padding-left:16px}.compliance{font-size:.9rem;color:#5a6472}</style></head><body><header><div class="wrap"><strong>USD Impact</strong></div></header><section class="hero"><div class="wrap"><p>Protected Library Pass digital reader</p><h1>${escapeHtml(privateBookDocument.title)}</h1><p>Edition ${escapeHtml(privateBookDocument.edition)} · ${escapeHtml(privateBookDocument.build)}</p></div></section><main class="wrap"><section class="card"><h2>Your private book file</h2><p>This file is available only to an eligible signed-in Library Pass account. The download link expires after five minutes and can be requested again from this page.</p><p><a class="button" href="${BOOK_DOWNLOAD_PATH}" rel="nofollow">Open private PDF</a></p><p class="meta">File size: ${privateBookDocument.size.toLocaleString('en-US')} bytes</p><p class="hash"><strong>SHA-256:</strong> ${escapeHtml(privateBookDocument.sha256)}</p></section><section class="card notice"><h2>Accessibility limitation</h2><p>${escapeHtml(privateBookDocument.accessibility)} This limitation is accepted only for the private Development proof and does not represent publication approval.</p></section><p class="compliance"><strong>Educational and informational only.</strong> Not investment, financial, legal, tax or trading advice; not a trading signal or recommendation. Market relationships are regime-dependent and may change.</p></main><footer><div class="wrap">USD Impact · Protected learning library</div></footer></body></html>`;
}

export async function handleBookDeliveryRequest(request, response, {
  readAccessState = readAccountAccessState,
  createSignedUrl = createSignedBookUrl,
  environment = process.env,
} = {}) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Vary', 'Cookie, Authorization');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('Referrer-Policy', 'no-referrer');
  if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed(response);

  let protectedUrl;
  try {
    protectedUrl = originalRequestUrl(request);
  } catch {
    response.statusCode = 400;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Invalid protected route.');
  }

  const accessToken = readSessionAccessToken(request);
  if (!accessToken) return redirect(response, buildPaidSignInRedirect(protectedUrl));
  let state;
  try {
    state = await readAccessState({ accessToken });
  } catch (error) {
    const safe = safeSupabaseError(error);
    if (safe.status === 401) return redirect(response, buildPaidSignInRedirect(protectedUrl));
    return redirect(response, buildPaidAccessRequiredRedirect(protectedUrl, 'denied'));
  }
  if (state?.allowed !== true) {
    return redirect(response, buildPaidAccessRequiredRedirect(protectedUrl, normalizePaidAccessReason(state?.reason)));
  }

  const route = protectedUrl.pathname.slice(BOOK_MEMBER_PATH.length).replace(/\/+$/, '');
  if (!route) {
    const body = renderProtectedBook();
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Content-Length', Buffer.byteLength(body));
    return response.end(request.method === 'HEAD' ? '' : body);
  }
  if (route !== 'download') {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Protected page not found.');
  }
  if (request.method === 'HEAD') {
    response.statusCode = 200;
    return response.end();
  }

  try {
    const signedUrl = await createSignedUrl({ environment });
    const destination = new URL(signedUrl);
    if (destination.protocol !== 'https:') throw new Error('Invalid signed book URL.');
    return redirect(response, destination.toString(), 302);
  } catch {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('The private book is temporarily unavailable.');
  }
}
