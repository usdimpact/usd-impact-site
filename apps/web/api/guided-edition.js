import {
  readAccountAccessState,
  safeSupabaseError,
} from '../src/lib/supabase-server.js';
import {
  readSessionAccessToken,
  requestOrigin,
  safeNextPath,
} from '../src/lib/supabase-auth.js';
import {
  buildPaidAccessRequiredRedirect,
  buildPaidSignInRedirect,
  isPaidContentPath,
  normalizePaidAccessReason,
} from '../src/lib/paid-route.js';

const ROUTE_PARAM = '__paid_path';
const ROOT_PATH = '/guided-edition/';

function requestUrl(request) {
  return new URL(request.url || '/api/guided-edition', 'https://usd-impact.invalid');
}

function originalRequestUrl(request) {
  const internalUrl = requestUrl(request);
  const rawRoute = String(internalUrl.searchParams.get(ROUTE_PARAM) || '').trim();
  internalUrl.searchParams.delete(ROUTE_PARAM);

  const candidate = rawRoute
    ? `/guided-edition/${rawRoute.replace(/^\/+/, '')}`
    : ROOT_PATH;
  const safePath = safeNextPath(candidate, ROOT_PATH);
  const parsedPath = new URL(safePath, 'https://usd-impact.invalid');
  if (!isPaidContentPath(parsedPath.pathname)) {
    const error = new Error('The protected route is invalid.');
    error.status = 400;
    error.code = 'INVALID_PAID_ROUTE';
    throw error;
  }

  const query = internalUrl.searchParams.toString();
  const target = `${parsedPath.pathname}${parsedPath.search}${query ? `${parsedPath.search ? '&' : '?'}${query}` : ''}`;
  return new URL(target, requestOrigin(request));
}

function redirect(response, destination, status = 302) {
  response.statusCode = status;
  response.setHeader('Location', `${destination.pathname}${destination.search}${destination.hash}`);
  response.end();
}

function methodNotAllowed(response) {
  response.statusCode = 405;
  response.setHeader('Allow', 'GET, HEAD');
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.end('Method not allowed.');
}

function renderProtectedPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Guided Interactive Edition | USD Impact</title>
  <meta name="description" content="Secure account access to the Read the Dollar First Guided Interactive Edition.">
  <style>
    :root { color-scheme: light; --navy:#031426; --ink:#081a31; --gold:#d2a84f; --paper:#f4f6f9; --line:#d9e0e8; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:var(--paper); }
    a { color:inherit; }
    header { background:#020d19; color:#fff; border-bottom:1px solid #203044; }
    .nav { max-width:1180px; margin:0 auto; padding:22px 28px; display:flex; align-items:center; justify-content:space-between; gap:24px; }
    .brand { font-size:1.2rem; font-weight:800; text-decoration:none; }
    nav { display:flex; flex-wrap:wrap; gap:22px; font-weight:600; }
    nav a { text-decoration:none; }
    .hero { background:linear-gradient(135deg,#020e1c,#061b31); color:#fff; padding:92px 28px; }
    .container { max-width:1180px; margin:0 auto; }
    .eyebrow { margin:0 0 18px; color:var(--gold); font-size:.9rem; font-weight:800; letter-spacing:.16em; text-transform:uppercase; }
    h1 { max-width:900px; margin:0; font-size:clamp(2.7rem,7vw,5.2rem); line-height:1.02; letter-spacing:-.04em; }
    .lead { max-width:820px; margin:28px 0 0; font-size:clamp(1.12rem,2.2vw,1.45rem); line-height:1.6; }
    main { padding:62px 28px 90px; }
    .card { max-width:900px; margin:0 auto; padding:44px; background:#fff; border:1px solid var(--line); border-radius:22px; box-shadow:0 18px 45px rgba(6,24,45,.08); }
    h2 { margin:0 0 18px; font-size:2rem; }
    p { line-height:1.7; }
    .actions { display:flex; flex-wrap:wrap; gap:14px; margin-top:30px; }
    .button { display:inline-flex; align-items:center; min-height:48px; padding:0 22px; border-radius:999px; font-weight:800; text-decoration:none; border:1px solid var(--line); }
    .primary { background:var(--gold); border-color:var(--gold); color:#111; }
    footer { padding:34px 28px; background:#020d19; color:#d6deea; }
    .footer-inner { max-width:1180px; margin:0 auto; font-size:.92rem; line-height:1.6; }
    @media (max-width:760px) { nav { display:none; } .hero { padding:70px 22px; } main { padding:38px 18px 70px; } .card { padding:30px 24px; } }
  </style>
</head>
<body>
  <header>
    <div class="nav">
      <a class="brand" href="/">USD Impact</a>
      <nav aria-label="Primary navigation">
        <a href="/start-here/">Start Here</a>
        <a href="/daily-usd-impact/">Daily USD Impact</a>
        <a href="/weekly-usd-impact-score/">Weekly Score</a>
        <a href="/book/read-the-dollar-first/">Book</a>
        <a href="/framework/">Framework</a>
        <a href="/checklist/">Checklist</a>
        <a href="/account/">Account</a>
      </nav>
    </div>
  </header>
  <section class="hero">
    <div class="container">
      <p class="eyebrow">Read the Dollar First</p>
      <h1>Guided Interactive Edition.</h1>
      <p class="lead">Your verified account has active access to the protected digital reading experience.</p>
    </div>
  </section>
  <main>
    <section class="card" aria-labelledby="guided-edition-heading">
      <h2 id="guided-edition-heading">Access confirmed</h2>
      <p>This protected entry point is enforced by the durable Supabase entitlement attached to your account. The full guided reading interface will be delivered inside this protected route family.</p>
      <div class="actions">
        <a class="button primary" href="/account/">Open account</a>
        <a class="button" href="/book/read-the-dollar-first/">View book overview</a>
      </div>
    </section>
  </main>
  <footer><div class="footer-inner">USD Impact is an educational macro-finance framework. It is not investment, legal, tax, trading, or financial advice.</div></footer>
</body>
</html>`;
}

export async function handleGuidedEditionRequest(
  request,
  response,
  { readAccessState = readAccountAccessState } = {},
) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Vary', 'Cookie, Authorization');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return methodNotAllowed(response);
  }

  let protectedUrl;
  try {
    protectedUrl = originalRequestUrl(request);
  } catch {
    response.statusCode = 400;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Invalid protected route.');
  }

  const accessToken = readSessionAccessToken(request);
  if (!accessToken) {
    return redirect(response, buildPaidSignInRedirect(protectedUrl));
  }

  let state;
  try {
    state = await readAccessState({ accessToken });
  } catch (error) {
    const safe = safeSupabaseError(error);
    if (safe.status === 401) {
      return redirect(response, buildPaidSignInRedirect(protectedUrl));
    }
    return redirect(response, buildPaidAccessRequiredRedirect(protectedUrl, 'denied'));
  }

  if (state?.allowed !== true) {
    return redirect(
      response,
      buildPaidAccessRequiredRedirect(protectedUrl, normalizePaidAccessReason(state?.reason)),
    );
  }

  if (protectedUrl.pathname.replace(/\/+$/, '') !== '/guided-edition') {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Protected page not found.');
  }

  const body = renderProtectedPage();
  response.statusCode = 200;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  return response.end(request.method === 'HEAD' ? '' : body);
}

export default async function handler(request, response) {
  return handleGuidedEditionRequest(request, response);
}
