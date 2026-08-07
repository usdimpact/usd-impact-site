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
import {
  WEEKLY_SCORE_ASSET_SHA256,
  WEEKLY_SCORE_DOWNLOAD_NAME,
  WEEKLY_SCORE_DOWNLOAD_PATH,
  WEEKLY_SCORE_MEMBER_PATH,
  downloadWeeklyScoreMemberPackage,
} from '../src/lib/private-paid-assets.js';

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

function normalizeProtectedPath(pathname) {
  const normalized = String(pathname || ROOT_PATH).replace(/\/{2,}/g, '/');
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

function renderProtectedLayout({ title, description, eyebrow, heading, lead, content }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${title} | USD Impact</title>
  <meta name="description" content="${description}">
  <style>
    :root { color-scheme:light; --navy:#071a33; --midnight:#020a14; --ink:#161a1f; --slate:#5a6472; --silver:#c6ccd4; --gold:#c9a35b; --paper:#f4f6f9; --white:#fff; --line:#d9e0e8; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:var(--paper); }
    a { color:inherit; }
    header { background:var(--midnight); color:var(--white); border-bottom:1px solid #203044; }
    .nav { max-width:1180px; margin:0 auto; padding:22px 28px; display:flex; align-items:center; justify-content:space-between; gap:24px; }
    .brand { font-size:1.2rem; font-weight:800; text-decoration:none; }
    nav { display:flex; flex-wrap:wrap; gap:22px; font-weight:600; }
    nav a { text-decoration:none; }
    .hero { background:linear-gradient(135deg,var(--midnight),var(--navy)); color:var(--white); padding:88px 28px; }
    .container { max-width:1180px; margin:0 auto; }
    .eyebrow { margin:0 0 18px; color:var(--gold); font-size:.9rem; font-weight:800; letter-spacing:.16em; text-transform:uppercase; }
    h1 { max-width:980px; margin:0; font-family:Georgia,"Times New Roman",serif; font-size:clamp(2.7rem,7vw,5.2rem); line-height:1.02; letter-spacing:-.035em; }
    .lead { max-width:820px; margin:28px 0 0; font-size:clamp(1.12rem,2.2vw,1.45rem); line-height:1.6; }
    main { padding:62px 28px 90px; }
    .stack { display:grid; gap:24px; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:24px; }
    .card { padding:clamp(28px,5vw,44px); background:var(--white); border:1px solid var(--line); border-radius:22px; box-shadow:0 18px 45px rgba(6,24,45,.08); }
    .card.compact { padding:30px; }
    .card.gold-edge { border-top:5px solid var(--gold); }
    h2 { margin:0 0 18px; color:var(--navy); font-family:Georgia,"Times New Roman",serif; font-size:clamp(1.8rem,4vw,2.35rem); }
    h3 { margin:30px 0 10px; color:var(--navy); font-size:1.2rem; }
    p, li { line-height:1.7; }
    ul, ol { padding-left:1.35rem; }
    li + li { margin-top:8px; }
    .muted { color:var(--slate); }
    .status { display:inline-flex; margin:0 0 18px; padding:7px 12px; border:1px solid #dbc895; border-radius:999px; background:#fffbef; color:#59420b; font-size:.82rem; font-weight:800; letter-spacing:.05em; text-transform:uppercase; }
    .actions { display:flex; flex-wrap:wrap; gap:14px; margin-top:30px; }
    .button { display:inline-flex; align-items:center; min-height:48px; padding:0 22px; border-radius:999px; font-weight:800; text-decoration:none; border:1px solid var(--line); }
    .primary { background:var(--gold); border-color:var(--gold); color:#111; }
    .secondary { background:var(--white); color:var(--navy); border-color:#aeb7c3; }
    .regimes { width:100%; border-collapse:collapse; margin:22px 0; }
    .regimes th, .regimes td { padding:12px 14px; border:1px solid var(--line); text-align:left; }
    .regimes th { background:var(--navy); color:var(--white); }
    .note { margin-top:26px; padding:18px 20px; border-left:4px solid var(--gold); background:#fffbf2; }
    code { padding:.12em .35em; border-radius:5px; background:#edf0f4; font-size:.92em; }
    footer { padding:34px 28px; background:var(--midnight); color:#d6deea; }
    .footer-inner { max-width:1180px; margin:0 auto; font-size:.92rem; line-height:1.6; }
    @media (max-width:760px) { nav { display:none; } .hero { padding:70px 22px; } main { padding:38px 18px 70px; } .grid { grid-template-columns:1fr; } .card { padding:30px 24px; } }
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
      <p class="eyebrow">${eyebrow}</p>
      <h1>${heading}</h1>
      <p class="lead">${lead}</p>
    </div>
  </section>
  <main>
    <div class="container">${content}</div>
  </main>
  <footer><div class="footer-inner">Educational and informational only. USD Impact content and tools are not investment, financial, legal, tax, or trading advice; they are not forecasts, trading signals, or recommendations.</div></footer>
</body>
</html>`;
}

function renderMemberHub() {
  return renderProtectedLayout({
    title: 'Member library',
    description: 'Secure member access to the Guided Interactive Edition and included USD Impact tools.',
    eyebrow: 'Read the Dollar First',
    heading: 'Your member library.',
    lead: 'Your verified account has active access to the Guided Interactive Edition and its included private learning tools.',
    content: `
      <div class="stack">
        <section class="card gold-edge" aria-labelledby="member-access-heading">
          <span class="status">Access active</span>
          <h2 id="member-access-heading">Paid access confirmed</h2>
          <p>Your access is enforced by the durable purchase entitlement attached to your verified USD Impact account.</p>
        </section>
        <div class="grid" aria-label="Member resources">
          <section class="card compact">
            <p class="eyebrow">Core edition</p>
            <h2>Guided Interactive Edition</h2>
            <p>Follow the protected chapter-by-chapter learning sequence, knowledge checks, and progress workflow as each certified module is released.</p>
            <div class="actions"><a class="button secondary" href="/book/read-the-dollar-first/">View edition overview</a></div>
          </section>
          <section class="card compact gold-edge">
            <p class="eyebrow">Included private tool</p>
            <h2>Weekly Score v1.1</h2>
            <p>Install the validated TradingView Context Edition and use its score, attribution, breadth, four-pillar map, boundary distance, and model-context flags.</p>
            <div class="actions"><a class="button primary" href="${WEEKLY_SCORE_MEMBER_PATH}">Open setup &amp; weekly workflow</a></div>
          </section>
        </div>
        <section class="card compact">
          <h2>Need help?</h2>
          <p>Use the beginner instructions before contacting support. For account or installation help, email <a href="mailto:support@usd-impact.com">support@usd-impact.com</a> from the address linked to your purchase.</p>
          <div class="actions"><a class="button secondary" href="/account/">Manage account</a></div>
        </section>
      </div>`,
  });
}

function renderWeeklyScoreGuide() {
  return renderProtectedLayout({
    title: 'Weekly Score v1.1 member guide',
    description: 'Beginner setup and weekly-use instructions for the private USD Impact Weekly Score v1.1 TradingView tool.',
    eyebrow: 'Private member tool · v1.1',
    heading: 'Install it once. Read it weekly.',
    lead: 'A beginner-safe workflow for installing the frozen Context Edition, confirming it works, and reading completed-week dollar pressure without turning the model into a trading signal.',
    content: `
      <div class="stack">
        <section class="card gold-edge" aria-labelledby="download-heading">
          <span class="status">Final private release</span>
          <h2 id="download-heading">1. Download the member package</h2>
          <p>The ZIP contains the exact frozen Pine v1.1 release, methodology, QA evidence, validator, event guide, and a complete beginner manual. The validated score engine is unchanged.</p>
          <div class="actions">
            <a class="button primary" href="${WEEKLY_SCORE_DOWNLOAD_PATH}" download>Download Weekly Score v1.1</a>
            <a class="button secondary" href="/guided-edition/">Back to member library</a>
          </div>
          <p class="muted">Keep the package private. Do not publish, resell, sublicense, or share the Pine source or protected files.</p>
        </section>

        <section class="card" aria-labelledby="install-heading">
          <h2 id="install-heading">2. Install it in TradingView</h2>
          <ol>
            <li>Extract the downloaded ZIP to a normal folder.</li>
            <li>Sign in to TradingView, open <strong>Supercharts</strong>, and change the chart timeframe to <strong>1 week (1W)</strong>.</li>
            <li>Open <strong>Pine Editor</strong> and select <strong>Create new → Indicator</strong>. Do not paste over another saved script.</li>
            <li>Open <code>USD_Impact_Weekly_Score_TradingView_Context_Edition_v1.1.pine</code> from the package.</li>
            <li>Copy all <strong>753 lines</strong>, beginning with <code>//@version=6</code>.</li>
            <li>Return to the new blank Pine indicator, press <strong>Ctrl+A</strong>, paste, and press <strong>Ctrl+S</strong>.</li>
            <li>Save it as <strong>USD Impact Weekly Score — Context Edition v1.1</strong>.</li>
            <li>Click <strong>Add to chart</strong> once. Never select <strong>Publish script</strong>.</li>
          </ol>
          <div class="note"><strong>Upgrade popup?</strong> Close it first. Your indicator slots may already be occupied. Remove an unused or duplicate chart indicator and add USD Impact once. Automatic technical alerts may also be unavailable on some TradingView plans; the score itself still works.</div>
        </section>

        <section class="card" aria-labelledby="confirm-heading">
          <h2 id="confirm-heading">3. Confirm the installation</h2>
          <p>The installation is correct when you see one USD Impact panel with:</p>
          <ul>
            <li>the Weekly Score line;</li>
            <li><code>Mode: TV proxy v1.1</code>;</li>
            <li><code>Fixture QA: PASS</code>;</li>
            <li>eight component inputs; and</li>
            <li><code>Weekly Context — derived, not scored</code>.</li>
          </ul>
          <p>If the tables are crowded, drag the panel border upward or use <strong>Settings → Inputs</strong> to hide the component table while keeping the context dashboard visible.</p>
        </section>

        <section class="card" aria-labelledby="read-heading">
          <h2 id="read-heading">4. Read the score first</h2>
          <table class="regimes">
            <thead><tr><th>Score</th><th>Model regime</th></tr></thead>
            <tbody>
              <tr><td>+1.0 or higher</td><td>Strong dollar</td></tr>
              <tr><td>+0.3 to below +1.0</td><td>Firm dollar</td></tr>
              <tr><td>−0.3 to below +0.3</td><td>Neutral / transitional</td></tr>
              <tr><td>−1.0 to below −0.3</td><td>Soft dollar</td></tr>
              <tr><td>Below −1.0</td><td>Weak dollar</td></tr>
            </tbody>
          </table>
          <p>A positive score means firmer-dollar pressure inside the model. A negative score means softer-dollar pressure. It does not tell you to buy or sell an asset.</p>
          <h3>Then read the context in this order</h3>
          <ol>
            <li><strong>Weekly delta:</strong> how the score changed from the prior completed week.</li>
            <li><strong>Dominant driver:</strong> the largest absolute current contribution.</li>
            <li><strong>Largest mover:</strong> the component whose contribution changed most week over week.</li>
            <li><strong>Four-pillar map:</strong> Dollar, Rates, Risk / liquidity, and Real assets; together they sum to the score.</li>
            <li><strong>Breadth:</strong> firmer versus softer component counts—participation, not magnitude.</li>
            <li><strong>Nearest boundary:</strong> proximity to a fixed regime threshold, not a transition forecast.</li>
            <li><strong>Context flags:</strong> derived model states that prompt closer review.</li>
          </ol>
        </section>

        <section class="card" aria-labelledby="calendar-heading">
          <h2 id="calendar-heading">5. Configure the free events calendar</h2>
          <ol>
            <li>Open TradingView's <a href="https://www.tradingview.com/economic-calendar/" rel="noopener noreferrer">Economic Calendar</a>.</li>
            <li>Set your local timezone.</li>
            <li>Select <strong>United States</strong> only.</li>
            <li>Activate <strong>High importance</strong> only—the events with three importance bars.</li>
            <li>Leave <strong>All categories</strong> selected.</li>
          </ol>
          <p>The calendar tells you when information is scheduled. The score tells you what changed in completed-week market inputs. Timing alone does not prove causality.</p>
        </section>

        <section class="card" aria-labelledby="routine-heading">
          <h2 id="routine-heading">6. Use the five-minute weekly routine</h2>
          <h3>Before the week</h3>
          <ul>
            <li>Review U.S. high-importance events.</li>
            <li>Note FOMC, CPI/PCE, payroll, GDP, and ISM timing.</li>
            <li>Add authoritative OPEC+, Treasury, geopolitical, or major-earnings dates separately when relevant.</li>
          </ul>
          <h3>During the week</h3>
          <ul>
            <li>Observe events without changing the model inputs.</li>
            <li>Do not treat a developing weekly bar as the completed-week reading.</li>
            <li>Record official actual, consensus, and prior values where relevant.</li>
          </ul>
          <h3>After the completed week updates</h3>
          <ol>
            <li>Read Score, regime, and Weekly delta.</li>
            <li>Compare Dominant driver with Largest mover.</li>
            <li>Review the four pillars, breadth, nearest boundary, and context flags.</li>
            <li>Compare the change with the event log while separating correlation from causation.</li>
          </ol>
        </section>

        <section class="card" aria-labelledby="alerts-heading">
          <h2 id="alerts-heading">7. Optional alerts</h2>
          <p>If your TradingView account provides technical alerts, create one combined beginner alert:</p>
          <ol>
            <li>Click <strong>Alert</strong>.</li>
            <li>Select <strong>USD Impact Score TV</strong>.</li>
            <li>Select <strong>USD Impact elevated context flag</strong>.</li>
            <li>Keep the interval at <strong>Same as chart — 1 week</strong>.</li>
            <li>Set <strong>Trigger</strong> to <strong>Once per bar close</strong>.</li>
          </ol>
          <p>If TradingView shows <strong>0 technical alerts</strong>, close the upgrade prompt and skip this step. The indicator remains fully usable through the weekly manual routine.</p>
        </section>

        <section class="card compact" aria-labelledby="support-heading">
          <h2 id="support-heading">Support and use boundary</h2>
          <p>For installation or access help, email <a href="mailto:support@usd-impact.com">support@usd-impact.com</a> from the address linked to your purchase. Never send payment-card details.</p>
          <p class="muted">Member package SHA-256: <code>${WEEKLY_SCORE_ASSET_SHA256}</code></p>
          <p><strong>Educational and informational only.</strong> The Weekly Score, context dashboard, calendar workflow, markers, and alerts are not investment, financial, legal, tax, or trading advice; they are not forecasts, trading signals, or recommendations.</p>
        </section>
      </div>`,
  });
}

async function sendWeeklyScoreDownload(response, downloadAsset) {
  try {
    const asset = await downloadAsset();
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${WEEKLY_SCORE_DOWNLOAD_NAME}"`);
    response.setHeader('Content-Length', asset.size);
    response.setHeader('Digest', `sha-256=${Buffer.from(asset.sha256, 'hex').toString('base64')}`);
    return response.end(asset.bytes);
  } catch {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('The private member download is temporarily unavailable. Please try again later or contact support.');
  }
}

export async function handleGuidedEditionRequest(
  request,
  response,
  {
    readAccessState = readAccountAccessState,
    downloadAsset = downloadWeeklyScoreMemberPackage,
  } = {},
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

  const protectedPath = normalizeProtectedPath(protectedUrl.pathname);
  if (protectedPath === WEEKLY_SCORE_DOWNLOAD_PATH) {
    if (request.method === 'HEAD') {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/zip');
      response.setHeader('Content-Disposition', `attachment; filename="${WEEKLY_SCORE_DOWNLOAD_NAME}"`);
      return response.end();
    }
    return sendWeeklyScoreDownload(response, downloadAsset);
  }

  let body;
  if (protectedPath === ROOT_PATH) {
    body = renderMemberHub();
  } else if (protectedPath === WEEKLY_SCORE_MEMBER_PATH) {
    body = renderWeeklyScoreGuide();
  } else {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Protected page not found.');
  }

  response.statusCode = 200;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  return response.end(request.method === 'HEAD' ? '' : body);
}

export default async function handler(request, response) {
  return handleGuidedEditionRequest(request, response);
}
