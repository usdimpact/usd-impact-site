import {
  readAccountAccessState,
  readGuidedLearningProgress,
  recordGuidedLearningProgress,
  safeSupabaseError,
  sendJson,
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
  GUIDED_EDITION_CHAPTERS,
  evaluateGuidedMastery,
  getGuidedChapterByContentId,
  getGuidedChapterBySlug,
  guidedResumeHref,
  normalizeGuidedProgressInput,
  normalizeGuidedProgressRecord,
  publicGuidedChapter,
} from '../src/lib/guided-edition.js';

const ROUTE_PARAM = '__paid_path';
const ROOT_PATH = '/guided-edition/';
const MAX_JSON_BYTES = 8192;

function requestUrl(request) {
  return new URL(request.url || '/api/guided-edition', 'https://usd-impact.invalid');
}

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function action(request) {
  return requestUrl(request).searchParams.get('action')?.trim().toLowerCase() || '';
}

function originalRequestUrl(request) {
  const internalUrl = requestUrl(request);
  const rawRoute = String(internalUrl.searchParams.get(ROUTE_PARAM) || '').trim();
  internalUrl.searchParams.delete(ROUTE_PARAM);
  internalUrl.searchParams.delete('action');

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

function methodNotAllowed(response, allowed, json = false) {
  response.setHeader('Allow', allowed);
  if (json) return sendJson(response, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  response.statusCode = 405;
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return response.end('Method not allowed.');
}

function parseJsonBody(request) {
  const contentLength = Number(header(request, 'content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    const error = new Error('Request body is too large.');
    error.status = 413;
    error.code = 'REQUEST_TOO_LARGE';
    throw error;
  }
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
  const raw = typeof request.body === 'string' || Buffer.isBuffer(request.body)
    ? request.body.toString()
    : '{}';
  if (Buffer.byteLength(raw) > MAX_JSON_BYTES) {
    const error = new Error('Request body is too large.');
    error.status = 413;
    error.code = 'REQUEST_TOO_LARGE';
    throw error;
  }
  return JSON.parse(raw);
}

function requireSameSiteJson(request, response) {
  if (header(request, 'sec-fetch-site') === 'cross-site') {
    sendJson(response, 403, { error: 'Cross-site requests are not allowed.', code: 'CROSS_SITE_REQUEST' });
    return false;
  }
  if (!header(request, 'content-type').toLowerCase().includes('application/json')) {
    sendJson(response, 415, { error: 'Content type must be application/json.', code: 'INVALID_CONTENT_TYPE' });
    return false;
  }
  return true;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function shell({ title, eyebrow, lead, content, script = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(title)} | USD Impact</title>
  <meta name="description" content="Protected Read the Dollar First Guided Interactive Edition.">
  <style>
    :root{color-scheme:light;--navy:#031426;--ink:#081a31;--gold:#d2a84f;--paper:#f4f6f9;--line:#d9e0e8;--muted:#536275;--good:#12633d}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper)}a{color:inherit}.skip{position:absolute;left:-9999px;top:8px;background:#fff;padding:12px;z-index:5}.skip:focus{left:8px}header,footer{background:#020d19;color:#fff}.nav,.container,.footer-inner{max-width:1120px;margin:0 auto}.nav{padding:20px 26px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{font-size:1.15rem;font-weight:850;text-decoration:none}.nav nav{display:flex;gap:20px;font-weight:650}.nav nav a{text-decoration:none}.hero{background:linear-gradient(135deg,#020e1c,#09233e);color:#fff;padding:64px 26px}.eyebrow{margin:0 0 14px;color:var(--gold);font-size:.83rem;font-weight:850;letter-spacing:.14em;text-transform:uppercase}h1{max-width:850px;margin:0;font-size:clamp(2.35rem,6vw,4.6rem);line-height:1.03;letter-spacing:-.035em}.lead{max-width:790px;margin:22px 0 0;font-size:clamp(1.08rem,2vw,1.3rem);line-height:1.6}main{padding:44px 26px 76px}.card,.reader-section,.mastery{background:#fff;border:1px solid var(--line);border-radius:18px;padding:30px;box-shadow:0 12px 32px rgba(6,24,45,.06)}.stack{display:grid;gap:22px}.reader-grid{display:grid;grid-template-columns:minmax(210px,280px) minmax(0,1fr);gap:28px;align-items:start}.reader-nav{position:sticky;top:20px}.reader-nav ul{padding-left:20px;line-height:1.8}.reader-content{display:grid;gap:24px}h2,h3{line-height:1.18}h2{margin:0 0 14px;font-size:clamp(1.65rem,3vw,2.25rem)}h3{margin:0 0 12px;font-size:1.35rem}p{line-height:1.7}.fixture{border-left:5px solid var(--gold)}.muted{color:var(--muted)}.progress-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}progress{width:min(100%,360px);height:16px}.button{appearance:none;display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 20px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);font:inherit;font-weight:800;text-decoration:none;cursor:pointer}.primary{background:var(--gold);border-color:var(--gold);color:#111}.button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #1474d4;outline-offset:3px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}fieldset{border:0;padding:0;margin:0}legend{font-size:1.15rem;font-weight:800;line-height:1.5;margin-bottom:14px}.option{display:block;padding:10px 0}.status{min-height:1.5em;font-weight:700}.status[data-state="success"]{color:var(--good)}footer{padding:30px 26px}.footer-inner{color:#d6deea;font-size:.9rem;line-height:1.6}@media(max-width:760px){.nav nav{display:none}.reader-grid{grid-template-columns:1fr}.reader-nav{position:static}.hero{padding:52px 20px}main{padding:30px 16px 60px}.card,.reader-section,.mastery{padding:24px 20px}}
  </style>
</head>
<body>
  <a class="skip" href="#main-content">Skip to content</a>
  <header><div class="nav"><a class="brand" href="/">USD Impact</a><nav aria-label="Primary navigation"><a href="/book/read-the-dollar-first/">Book</a><a href="/framework/">Framework</a><a href="/checklist/">Checklist</a><a href="/account/">Account</a></nav></div></header>
  <section class="hero"><div class="container"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="lead">${escapeHtml(lead)}</p></div></section>
  <main id="main-content"><div class="container">${content}</div></main>
  <footer><div class="footer-inner">USD Impact is an educational macro-finance framework. It is not investment, legal, tax, trading, or financial advice.</div></footer>
  ${script}
</body>
</html>`;
}

function renderLibrary(progressByContentId) {
  const cards = GUIDED_EDITION_CHAPTERS.map((chapter) => {
    const progress = progressByContentId.get(chapter.contentId);
    const href = guidedResumeHref(chapter, progress);
    return `<article class="card fixture">
      <p class="eyebrow">Implementation fixture · Chapter ${chapter.number}</p>
      <h2>${escapeHtml(chapter.title)}</h2>
      <p>${escapeHtml(chapter.description)}</p>
      <div class="progress-row"><progress max="100" value="${progress.progressPercent}" aria-label="Chapter progress"></progress><strong>${progress.progressPercent}%</strong></div>
      <p class="muted">${progress.completedAt ? 'Mastery complete.' : progress.attemptCount ? `${progress.attemptCount} mastery attempt${progress.attemptCount === 1 ? '' : 's'}.` : 'No mastery attempt yet.'}</p>
      <div class="actions"><a class="button primary" href="${escapeHtml(href)}">${progress.progressPercent > 0 ? 'Resume chapter' : 'Start chapter'}</a><a class="button" href="/account/">Account</a></div>
    </article>`;
  }).join('');
  return shell({
    title: 'Guided Interactive Edition',
    eyebrow: 'Protected learning library',
    lead: 'Resume your reading and mastery checks from any signed-in device.',
    content: `<div class="stack">${cards}</div>`,
  });
}

function renderChapter(chapter, progress) {
  const publicChapter = publicGuidedChapter(chapter);
  const navigation = publicChapter.sections.map((section) => `<li><a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a></li>`).join('');
  const sections = publicChapter.sections.map((section) => `<section id="${escapeHtml(section.id)}" class="reader-section" tabindex="-1">
    <h2>${escapeHtml(section.title)}</h2>
    ${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
    <button class="button save-place" type="button" data-position="${escapeHtml(section.id)}" data-progress="${section.progressPercent}">Save my place here</button>
  </section>`).join('');
  const options = publicChapter.mastery.options.map((option) => `<label class="option"><input type="radio" name="mastery-answer" value="${escapeHtml(option.id)}" required> ${escapeHtml(option.label)}</label>`).join('');
  const scriptData = JSON.stringify({ contentId: publicChapter.contentId }).replaceAll('<', '\\u003c');
  return shell({
    title: publicChapter.title,
    eyebrow: `Guided Interactive Edition · Chapter ${publicChapter.number}`,
    lead: publicChapter.description,
    content: `<div class="reader-grid">
      <aside class="card reader-nav" aria-label="Chapter navigation"><p class="eyebrow">Your progress</p><div class="progress-row"><progress id="chapter-progress" max="100" value="${progress.progressPercent}"></progress><strong id="chapter-percent">${progress.progressPercent}%</strong></div><nav aria-label="On this page"><ul>${navigation}</ul></nav><a href="/guided-edition/">Back to library</a></aside>
      <article class="reader-content">
        <section class="card fixture" aria-labelledby="fixture-heading"><h2 id="fixture-heading">Implementation fixture—not manuscript content</h2><p>This chapter validates secure routing, durable resume state, and server-scored mastery. Canonical book text has not been copied or altered.</p></section>
        ${sections}
        <section class="mastery" aria-labelledby="mastery-heading"><h2 id="mastery-heading">Mastery check</h2><form id="mastery-form"><fieldset><legend>${escapeHtml(publicChapter.mastery.prompt)}</legend>${options}</fieldset><button class="button primary" type="submit">Check my answer</button></form><p id="mastery-status" class="status" role="status" aria-live="polite"></p></section>
      </article>
    </div>`,
    script: `<script>const guidedChapter=${scriptData};const progress=document.getElementById('chapter-progress');const percent=document.getElementById('chapter-percent');const status=document.getElementById('mastery-status');const updateProgress=(value)=>{if(progress)progress.value=value;if(percent)percent.textContent=value+'%'};document.querySelectorAll('.save-place').forEach((button)=>button.addEventListener('click',async()=>{button.disabled=true;const response=await fetch('/api/guided-progress',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({contentId:guidedChapter.contentId,resumePosition:button.dataset.position,progressPercent:Number(button.dataset.progress)})});const body=await response.json().catch(()=>({}));button.disabled=false;if(!response.ok){status.textContent=body.error||'Your place could not be saved.';status.dataset.state='error';return}updateProgress(body.progress.progressPercent);status.textContent='Your place was saved.';status.dataset.state='success'}));document.getElementById('mastery-form')?.addEventListener('submit',async(event)=>{event.preventDefault();const selected=new FormData(event.currentTarget).get('mastery-answer');if(!selected)return;const submit=event.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;status.textContent='Checking your answer…';status.dataset.state='pending';const response=await fetch('/api/guided-mastery',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({contentId:guidedChapter.contentId,answers:{'chapter-1-access-proof':selected}})});const body=await response.json().catch(()=>({}));submit.disabled=false;if(!response.ok){status.textContent=body.error||'The mastery check could not be recorded.';status.dataset.state='error';return}updateProgress(body.progress.progressPercent);status.textContent=body.feedback;status.dataset.state=body.passed?'success':'error'});</script>`,
  });
}

async function requireApiAccess(request, response, readAccessState) {
  const accessToken = readSessionAccessToken(request);
  if (!accessToken) {
    sendJson(response, 401, { error: 'Authentication is required.', code: 'AUTHENTICATION_REQUIRED' });
    return null;
  }
  try {
    const state = await readAccessState({ accessToken });
    if (state?.allowed !== true) {
      sendJson(response, 403, {
        error: 'Active Guided Edition access is required.',
        code: 'GUIDED_ACCESS_REQUIRED',
        reason: normalizePaidAccessReason(state?.reason),
      });
      return null;
    }
    return { accessToken, state };
  } catch (error) {
    const safe = safeSupabaseError(error);
    sendJson(response, safe.status, safe.payload);
    return null;
  }
}

async function handleProgressApi(request, response, dependencies) {
  if (!['GET', 'PATCH'].includes(request.method)) return methodNotAllowed(response, 'GET, PATCH', true);
  if (request.method === 'PATCH' && !requireSameSiteJson(request, response)) return;
  const access = await requireApiAccess(request, response, dependencies.readAccessState);
  if (!access) return;

  try {
    let chapter;
    if (request.method === 'GET') {
      chapter = getGuidedChapterByContentId(requestUrl(request).searchParams.get('contentId'));
      if (!chapter) {
        return sendJson(response, 400, { error: 'Choose a valid Guided Edition chapter.', code: 'INVALID_GUIDED_CONTENT' });
      }
    } else {
      const normalized = normalizeGuidedProgressInput(parseJsonBody(request));
      chapter = normalized.chapter;
      const recorded = await dependencies.recordProgress({
        accountId: access.state.user.id,
        contentId: normalized.contentId,
        progressPercent: normalized.progressPercent,
        resumePosition: normalized.resumePosition,
        contentVersion: normalized.contentVersion,
      });
      return sendJson(response, 200, { ok: true, progress: normalizeGuidedProgressRecord(recorded, chapter.contentId) });
    }

    const row = await dependencies.readProgress({
      accessToken: access.accessToken,
      accountId: access.state.user.id,
      contentId: chapter.contentId,
    });
    return sendJson(response, 200, { progress: normalizeGuidedProgressRecord(row, chapter.contentId) });
  } catch (error) {
    if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
      return sendJson(response, error.status, { error: error.message, code: error.code || 'INVALID_REQUEST' });
    }
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}

async function handleMasteryApi(request, response, dependencies) {
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST', true);
  if (!requireSameSiteJson(request, response)) return;
  const access = await requireApiAccess(request, response, dependencies.readAccessState);
  if (!access) return;
  try {
    const result = evaluateGuidedMastery(parseJsonBody(request));
    const recorded = await dependencies.recordProgress({
      accountId: access.state.user.id,
      contentId: result.contentId,
      progressPercent: result.passed ? 100 : 90,
      resumePosition: result.resumePosition,
      contentVersion: result.contentVersion,
      masteryScore: result.score,
      attemptIncrement: result.attemptIncrement,
      masteryPassed: result.passed,
    });
    return sendJson(response, 200, {
      ok: true,
      passed: result.passed,
      score: result.score,
      feedback: result.feedback,
      progress: normalizeGuidedProgressRecord(recorded, result.contentId),
    });
  } catch (error) {
    if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
      return sendJson(response, error.status, { error: error.message, code: error.code || 'INVALID_REQUEST' });
    }
    const safe = safeSupabaseError(error);
    return sendJson(response, safe.status, safe.payload);
  }
}

export async function handleGuidedEditionRequest(request, response, overrides = {}) {
  const dependencies = {
    readAccessState: overrides.readAccessState || readAccountAccessState,
    readProgress: overrides.readProgress || readGuidedLearningProgress,
    recordProgress: overrides.recordProgress || recordGuidedLearningProgress,
  };
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Vary', 'Cookie, Authorization');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const requestedAction = action(request);
  if (requestedAction === 'progress') return handleProgressApi(request, response, dependencies);
  if (requestedAction === 'mastery') return handleMasteryApi(request, response, dependencies);
  if (requestedAction) return sendJson(response, 404, { error: 'Guided Edition action not found.', code: 'GUIDED_ACTION_NOT_FOUND' });
  if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed(response, 'GET, HEAD');

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
    state = await dependencies.readAccessState({ accessToken });
  } catch (error) {
    const safe = safeSupabaseError(error);
    if (safe.status === 401) return redirect(response, buildPaidSignInRedirect(protectedUrl));
    return redirect(response, buildPaidAccessRequiredRedirect(protectedUrl, 'denied'));
  }
  if (state?.allowed !== true) {
    return redirect(response, buildPaidAccessRequiredRedirect(protectedUrl, normalizePaidAccessReason(state?.reason)));
  }

  const route = protectedUrl.pathname.replace(/^\/guided-edition\/?/, '').replace(/\/+$/, '');
  const chapter = route ? getGuidedChapterBySlug(route) : null;
  if (route && !chapter) {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Protected page not found.');
  }

  let body;
  if (chapter) {
    let row = null;
    try {
      row = await dependencies.readProgress({ accessToken, accountId: state.user.id, contentId: chapter.contentId });
    } catch (error) {
      console.error('Guided Edition progress read failed.', error);
    }
    body = renderChapter(chapter, normalizeGuidedProgressRecord(row, chapter.contentId));
  } else {
    const pairs = await Promise.all(GUIDED_EDITION_CHAPTERS.map(async (item) => {
      try {
        const row = await dependencies.readProgress({ accessToken, accountId: state.user.id, contentId: item.contentId });
        return [item.contentId, normalizeGuidedProgressRecord(row, item.contentId)];
      } catch (error) {
        console.error('Guided Edition progress read failed.', error);
        return [item.contentId, normalizeGuidedProgressRecord(null, item.contentId)];
      }
    }));
    body = renderLibrary(new Map(pairs));
  }

  response.statusCode = 200;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  return response.end(request.method === 'HEAD' ? '' : body);
}

export default async function handler(request, response) {
  return handleGuidedEditionRequest(request, response);
}
