import { ServerResponse } from 'node:http';
import { createPublicationServingPolicy, SERVING_NO_STORE } from './publication-serving-policy.js';

// Not registered as a route. The caller must supply authenticated server-only
// adapters and an approved renderer. This module never creates admissions.
const claims = new WeakSet();
const ARTICLE = /^\/news\/(?:\d{4}-\d{2}-\d{2}|catalysts\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const ROUTES = Object.freeze({ homepage: '/', 'news-current': '/news',
  'news-archive': '/news/archive', 'news-composite': '/news', feed: '/news/feed.xml',
  'latest-json': '/news/latest.json', sitemap: '/sitemap-0.xml' });
const MIME = Object.freeze({ article: 'text/html; charset=utf-8', homepage: 'text/html; charset=utf-8',
  'news-current': 'text/html; charset=utf-8', 'news-archive': 'text/html; charset=utf-8',
  'news-composite': 'text/html; charset=utf-8', feed: 'application/rss+xml; charset=utf-8',
  'latest-json': 'application/json; charset=utf-8', sitemap: 'application/xml; charset=utf-8' });
const MAX_OUTPUT_BYTES = 1_000_000;
const SAFE_HEADERS = Object.freeze({ ...SERVING_NO_STORE, 'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" });
class BoundaryHold extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.httpStatus = status; }
}
const denied = (code, status = 503) => { throw new BoundaryHold(code, status); };
const requireThat = (condition, code, status) => { if (!condition) denied(code, status); };
const ready = (request, response) => !request.aborted && !response.destroyed
  && !response.writableEnded && !response.headersSent;
const defaultRequestTarget = (request) => request.url;

/** Owns a previously uncommitted native Node HTTP response, not framework routing.
 * Renderers receive only filtered, frozen content, never req/res or raw sources.
 * Authenticating authority/history, initial admission and public-host enforcement
 * remain integration prerequisites. All callback dependencies are trusted code.
 * resolveRequestTarget exists only for a trusted internal route adapter that has
 * already authenticated the original public path; request headers are never used
 * directly here to manufacture a different route.
 */
export function createRecordedPublicationHandler({ surface, path: expectedPath, loadSources,
  loadAuthority, readHistory, render, resolveRequestTarget = defaultRequestTarget,
  now = Date.now, timeoutMs = 10_000 } = {}) {
  return async function handleRecordedPublication(request, response) {
    if (!(response instanceof ServerResponse) || response.req !== request) {
      return Object.freeze({ decision: 'HOLD_RESPONSE_UNSUPPORTED', responseDispatched: false, publicationAuthorized: false });
    }
    if (claims.has(response)) {
      return Object.freeze({ decision: 'HOLD_RESPONSE_ALREADY_CLAIMED', responseDispatched: false, publicationAuthorized: false });
    }
    claims.add(response);
    if (!ready(request, response)) {
      // A previous writer may already have exposed bytes; do not claim prevention.
      const headersAlreadySent = response.headersSent;
      if (!response.writableEnded && !response.destroyed) response.destroy();
      return Object.freeze({ decision: 'HOLD_RESPONSE_ALREADY_STARTED', headersAlreadySent,
        responseDispatched: false, publicationAuthorized: false });
    }
    const method = request.method;
    const abort = new AbortController();
    let timer;
    let onClose;
    let state;
    try {
      requireThat(Object.hasOwn(MIME, surface) && (surface === 'article'
        ? ARTICLE.test(expectedPath ?? '') : ROUTES[surface] === expectedPath), 'HOLD_ROUTE_CONFIGURATION');
      requireThat(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 30_000, 'HOLD_TIMEOUT_CONFIGURATION');
      requireThat(typeof resolveRequestTarget === 'function', 'HOLD_ROUTE_CONFIGURATION');
      requireThat(['GET', 'HEAD'].includes(method), 'HOLD_METHOD_NOT_ALLOWED', 405);
      // Exact origin-form routing only. Query values cannot override the route,
      // clock, surface, host, authority, evidence or source selection.
      const target = resolveRequestTarget(request);
      requireThat(typeof target === 'string' && target.length <= 4096
        && target.startsWith('/') && !target.startsWith('//')
        && !/[\x00-\x20\x7f\\#]/.test(target), 'HOLD_ROUTE_NOT_FOUND', 404);
      const pathname = target.split('?', 1)[0];
      requireThat(pathname === expectedPath, 'HOLD_ROUTE_NOT_FOUND', 404);
      requireThat([loadSources, loadAuthority, readHistory, render, now].every((fn) => typeof fn === 'function'),
        'HOLD_ADAPTER_NOT_CONFIGURED');
      const assertActive = () => requireThat(!abort.signal.aborted, 'HOLD_PREPARATION_ABORTED');
      const policy = createPublicationServingPolicy({ now,
        loadAuthority: () => { assertActive(); return loadAuthority({ signal: abort.signal }); },
        readHistory: (query) => { assertActive(); return readHistory(query, { signal: abort.signal }); },
      });
      function policyView(ticket, requestedSurface) {
        const result = policy.project(ticket, { surface: requestedSurface, method: 'GET' });
        requireThat(result.decision === 'PROJECTED_RECORDED_ONLY', 'HOLD_FINAL_POLICY');
        return result.view.items;
      }
      function project(ticket) {
        if (surface === 'news-composite') {
          return Object.freeze({
            currentItems: policyView(ticket, 'news-current'),
            archiveItems: policyView(ticket, 'news-archive'),
          });
        }
        const projected = policyView(ticket, surface);
        const items = surface === 'article' ? projected.filter((item) => item.slug === expectedPath) : projected;
        requireThat(surface !== 'article' || items.length === 1, 'HOLD_NOT_ADMITTED', 404);
        return Object.freeze({ items: Object.freeze(items) });
      }
      async function prepare() {
        const loaded = await loadSources({ signal: abort.signal });
        assertActive();
        requireThat(Array.isArray(loaded) && loaded.length <= 500
          && loaded.every((item) => typeof item === 'string')
          && loaded.reduce((sum, item) => sum + Buffer.byteLength(item), 0) <= 4_000_000, 'HOLD_SOURCE_INVALID');
        const sources = Object.freeze(loaded.slice());
        let ticket = await policy.inspect(sources);
        requireThat(ticket.state === 'INSPECTED', 'HOLD_AUTHORITY_UNAVAILABLE');
        // At most one re-render when a recorded item leaves a current projection.
        // Authority/history drift is never retried or treated as equivalent.
        for (let attempt = 0; attempt < 2; attempt++) {
          requireThat(!abort.signal.aborted, 'HOLD_PREPARATION_TIMEOUT');
          const view = project(ticket); const fingerprint = JSON.stringify(view);
          const text = method === 'HEAD' ? '' : await render(view, {
            surface, path: expectedPath, signal: abort.signal,
          });
          requireThat(typeof text === 'string' && Buffer.byteLength(text) <= MAX_OUTPUT_BYTES, 'HOLD_RENDER_INVALID');
          const bytes = Buffer.from(text, 'utf8');
          requireThat(!abort.signal.aborted, 'HOLD_PREPARATION_TIMEOUT');
          const refreshed = await policy.inspect(sources);
          requireThat(refreshed.state === 'INSPECTED', 'HOLD_AUTHORITY_UNAVAILABLE');
          const prior = project(ticket); const fresh = project(refreshed);
          if (JSON.stringify(prior) !== fingerprint || JSON.stringify(fresh) !== fingerprint) {
            ticket = refreshed;
            continue;
          }
          return { bytes, status: 200, contentType: MIME[surface],
            verify: () => {
              requireThat(!abort.signal.aborted, 'HOLD_PREPARATION_TIMEOUT');
              requireThat(JSON.stringify(project(ticket)) === fingerprint
                && JSON.stringify(project(refreshed)) === fingerprint, 'HOLD_PROJECTION_CHANGED');
            } };
        }
        denied('HOLD_PROJECTION_CHANGED');
      }
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          abort.abort(); reject(new BoundaryHold('HOLD_PREPARATION_TIMEOUT'));
        }, timeoutMs);
      });
      const disconnected = new Promise((_, reject) => {
        onClose = () => { abort.abort(); reject(new BoundaryHold('HOLD_RESPONSE_UNAVAILABLE')); };
        response.once('close', onClose);
      });
      // No response writes occur inside prepare(), including after cancellation.
      state = await Promise.race([prepare(), timeout, disconnected]);
      requireThat(ready(request, response), 'HOLD_RESPONSE_UNAVAILABLE');
      // Own every header: do not inherit a stale ETag, redirect, excerpt, preload,
      // Content-Length, Set-Cookie or cache instruction from an earlier renderer.
      for (const name of response.getHeaderNames()) response.removeHeader(name);
      const headers = { ...SAFE_HEADERS, 'Content-Type': state.contentType,
        ...(method === 'GET' ? { 'Content-Length': String(state.bytes.length) } : {}) };
      state.verify();
      // Final in-process dispatch decision. No await, user callback or streaming
      // output after validation. This does not prove remote delivery time.
      response.writeHead(state.status, headers);
      response.end(method === 'HEAD' ? undefined : state.bytes);
      return Object.freeze({ decision: 'DISPATCHED_RECORDED_RESPONSE', responseDispatched: true,
        status: state.status, publicationAuthorized: false });
    } catch (error) {
      const code = error instanceof BoundaryHold ? error.code : 'HOLD_RESPONSE_FAILURE';
      if (!ready(request, response)) {
        if (!response.writableEnded && !response.destroyed) response.destroy();
        return Object.freeze({ decision: code, responseDispatched: false, publicationAuthorized: false });
      }
      const status = error instanceof BoundaryHold && [404, 405].includes(error.httpStatus) ? error.httpStatus : 503;
      const message = status === 404 ? 'Not found.\n' : status === 405 ? 'Method not allowed.\n' : 'Publication unavailable.\n';
      for (const name of response.getHeaderNames()) response.removeHeader(name);
      response.writeHead(status, { ...SAFE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow', ...(status === 405 ? { Allow: 'GET, HEAD' } : {}),
        ...(method === 'HEAD' ? {} : { 'Content-Length': String(Buffer.byteLength(message)) }) });
      response.end(method === 'HEAD' ? undefined : message);
      return Object.freeze({ decision: code, responseDispatched: true, status, publicationAuthorized: false });
    } finally {
      clearTimeout(timer);
      if (onClose) response.removeListener('close', onClose);
      abort.abort();
    }
  };
}
