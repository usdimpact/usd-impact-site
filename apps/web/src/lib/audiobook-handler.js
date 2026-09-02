import {
  readAccountAccessState,
  safeSupabaseError,
} from './supabase-server.js';
import {
  requestOrigin,
  resolveSessionWithRefresh,
  safeNextPath,
} from './supabase-auth.js';
import {
  buildPaidAccessRequiredRedirect,
  buildPaidSignInRedirect,
  normalizePaidAccessReason,
} from './paid-route.js';
import {
  AUDIOBOOK_MEMBER_PATH,
  createSignedAudiobookTrackUrl,
  getPrivateAudiobookTrack,
  privateAudiobookTrackHref,
  privateAudiobookTracks,
} from './private-audiobook.js';

const ROUTE_PARAM = '__audio_path';
const AUDIOBOOK_FLAG = '__audiobook';
const TRACK_PREFIX = 'track/';

function requestUrl(request) {
  return new URL(request.url || '/api/guided-edition', 'https://usd-impact.invalid');
}

function originalRequestUrl(request) {
  const internalUrl = requestUrl(request);
  const rawRoute = String(internalUrl.searchParams.get(ROUTE_PARAM) || '').trim();
  internalUrl.searchParams.delete(ROUTE_PARAM);
  internalUrl.searchParams.delete(AUDIOBOOK_FLAG);
  let decodedRoute = '';
  try {
    decodedRoute = rawRoute ? decodeURIComponent(rawRoute).replace(/^\/+|\/+$/g, '') : '';
  } catch {
    throw new Error('Invalid audiobook route.');
  }
  const candidate = decodedRoute ? `${AUDIOBOOK_MEMBER_PATH}${decodedRoute}/` : AUDIOBOOK_MEMBER_PATH;
  const safePath = safeNextPath(candidate, AUDIOBOOK_MEMBER_PATH);
  const parsed = new URL(safePath, 'https://usd-impact.invalid');
  if (!parsed.pathname.startsWith(AUDIOBOOK_MEMBER_PATH)) throw new Error('Invalid audiobook route.');
  const query = internalUrl.searchParams.toString();
  const target = `${parsed.pathname}${parsed.search}${query ? `${parsed.search ? '&' : '?'}${query}` : ''}`;
  return new URL(target, requestOrigin(request));
}

function routeTrack(protectedUrl) {
  const remainder = protectedUrl.pathname.slice(AUDIOBOOK_MEMBER_PATH.length).replace(/\/+$/, '');
  if (!remainder) return null;
  if (!remainder.startsWith(TRACK_PREFIX)) return false;
  const slug = remainder.slice(TRACK_PREFIX.length);
  if (slug.includes('/') || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return false;
  return getPrivateAudiobookTrack(slug) || false;
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

export function renderProtectedAudiobook() {
  const tracks = privateAudiobookTracks.map((track, index) => `<li><button type="button" data-track data-index="${index}" data-url="${escapeHtml(privateAudiobookTrackHref(track))}" data-title="${escapeHtml(track.title)}"${index === 0 ? ' aria-current="true"' : ''}><span>${String(index + 1).padStart(2, '0')}</span> ${escapeHtml(track.title)} <time>${escapeHtml(track.duration)}</time></button></li>`).join('');
  const first = privateAudiobookTracks[0];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Read the Dollar First English Audiobook | USD Impact</title><style>:root{--navy:#071a33;--gold:#c9a35b;--paper:#f5f7fa;--ink:#101923;--line:#d7dde5}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,system-ui,sans-serif}header,footer{background:var(--navy);color:#fff;padding:22px}.wrap{max-width:1080px;margin:auto}.hero{background:#0b2443;color:#fff;padding:54px 22px}main{padding:34px 22px 64px}.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:28px;margin-bottom:22px}audio{width:100%;margin:16px 0}button,select{font:inherit}button{cursor:pointer}.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.controls label{margin-left:auto}ol{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0;list-style:none}li button{width:100%;min-height:58px;text-align:left;border:1px solid var(--line);border-radius:10px;background:#f8fafc;padding:10px}li button[aria-current=true]{border-color:var(--gold);background:#fff8e8}time{float:right;color:#5a6472}.note{color:#5a6472}.compliance{font-size:.9rem;color:#5a6472}@media(max-width:720px){ol{grid-template-columns:1fr}.controls label{margin-left:0}}</style></head><body><header><div class="wrap"><strong>USD Impact</strong></div></header><section class="hero"><div class="wrap"><p>Protected Library Pass audiobook</p><h1>Read the Dollar First</h1><p>The complete 20-track English edition. Your listening position is stored only in this browser.</p></div></section><main class="wrap" data-player data-key="usd-impact-library-pass-audiobook-progress"><section class="card"><h2>Now listening</h2><p class="note">AI-generated speech with human quality review.</p><strong data-title>${escapeHtml(first.title)}</strong><audio data-audio src="${escapeHtml(privateAudiobookTrackHref(first))}" preload="metadata" controls>Audio playback is not supported.</audio><div class="controls"><button type="button" data-prev disabled>Previous chapter</button><button type="button" data-next>Next chapter</button><label>Speed <select data-speed><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label></div><p class="note" data-status role="status" aria-live="polite">Your listening position is saved on this device.</p></section><section class="card"><h2>Chapters</h2><ol>${tracks}</ol></section><p class="compliance"><strong>Educational and informational only.</strong> Not investment, financial, legal, tax or trading advice; not a trading signal or recommendation. Market relationships are regime-dependent and may change.</p></main><footer><div class="wrap">USD Impact · Protected learning library</div></footer><script>(()=>{const root=document.querySelector('[data-player]');if(!root)return;const audio=root.querySelector('[data-audio]'),title=root.querySelector('[data-title]'),prev=root.querySelector('[data-prev]'),next=root.querySelector('[data-next]'),speed=root.querySelector('[data-speed]'),status=root.querySelector('[data-status]'),tracks=[...root.querySelectorAll('[data-track]')],key=root.dataset.key;let index=0,pending=0,last=-1;const clamp=n=>Math.max(0,Math.min(n,tracks.length-1));const save=()=>{const second=Math.floor(audio.currentTime||0);if(second===last)return;last=second;try{localStorage.setItem(key,JSON.stringify({index,time:second}))}catch{}};const update=()=>{tracks.forEach((track,i)=>{if(i===index)track.setAttribute('aria-current','true');else track.removeAttribute('aria-current')});prev.disabled=index===0;next.disabled=index===tracks.length-1};const load=(i,{play=false,resume=0}={})=>{index=clamp(i);const track=tracks[index];pending=Math.max(0,resume);last=-1;audio.src=track.dataset.url;audio.load();title.textContent=track.dataset.title;update();if(!resume)save();if(play)audio.play().catch(()=>status.textContent='Press play to begin this chapter.')};try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&Number.isFinite(saved.index)&&Number.isFinite(saved.time)){index=clamp(saved.index);pending=Math.max(0,saved.time)}}catch{}tracks.forEach((track,i)=>track.addEventListener('click',()=>load(i,{play:true})));prev.addEventListener('click',()=>load(index-1,{play:true}));next.addEventListener('click',()=>load(index+1,{play:true}));speed.addEventListener('change',()=>audio.playbackRate=Number(speed.value)||1);audio.addEventListener('loadedmetadata',()=>{if(pending>0&&Number.isFinite(audio.duration)){audio.currentTime=Math.min(pending,Math.max(0,audio.duration-1));status.textContent='Your saved listening position is ready.'}pending=0});audio.addEventListener('timeupdate',save);audio.addEventListener('pause',save);audio.addEventListener('ended',()=>{if(index<tracks.length-1)load(index+1,{play:true})});audio.addEventListener('error',()=>status.textContent='This track is temporarily unavailable. Select it again to retry.');load(index,{resume:pending})})();</script></body></html>`;
}

export async function handleAudiobookRequest(request, response, {
  readAccessState = readAccountAccessState,
  resolveSession = resolveSessionWithRefresh,
  createSignedUrl = createSignedAudiobookTrackUrl,
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

  let resolved;
  try {
    resolved = await resolveSession({
      request,
      response,
      environment,
      verifyAccessToken: (accessToken) => readAccessState({ accessToken }),
    });
  } catch (error) {
    const safe = safeSupabaseError(error);
    if (safe.status === 401) return redirect(response, buildPaidSignInRedirect(protectedUrl));
    return redirect(response, buildPaidAccessRequiredRedirect(protectedUrl, 'denied'));
  }
  if (!resolved) return redirect(response, buildPaidSignInRedirect(protectedUrl));
  const state = resolved.value;
  if (state?.allowed !== true) {
    return redirect(response, buildPaidAccessRequiredRedirect(protectedUrl, normalizePaidAccessReason(state?.reason)));
  }

  const track = routeTrack(protectedUrl);
  if (track === false) {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Protected page not found.');
  }
  if (track) {
    if (request.method === 'HEAD') {
      response.statusCode = 200;
      return response.end();
    }
    try {
      const signedUrl = await createSignedUrl({ slug: track.slug, environment });
      const destination = new URL(signedUrl);
      if (destination.protocol !== 'https:') throw new Error('Invalid signed audiobook URL.');
      return redirect(response, destination.toString(), 302);
    } catch {
      response.statusCode = 503;
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return response.end('This audiobook track is temporarily unavailable.');
    }
  }

  const body = renderProtectedAudiobook();
  response.statusCode = 200;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  return response.end(request.method === 'HEAD' ? '' : body);
}
