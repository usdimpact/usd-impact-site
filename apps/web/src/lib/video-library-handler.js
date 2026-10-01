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
import { getVideo } from '../data/video-library.js';
import {
  createCloudflareStreamToken,
  safeCloudflareStreamError,
} from './cloudflare-stream.js';
import {
  renderProtectedVideoCatalog,
  renderProtectedVideoLesson,
  renderVideoUnavailable,
  videoLibraryContentSecurityPolicy,
} from './video-library-page.js';
import {
  getStreamCustomerCode,
  getStreamUid,
} from './video-stream-map.js';

const ROUTE_PARAM = '__video_path';
const ROOT_PATH = '/guided-edition/video-library/';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requestUrl(request) {
  return new URL(request.url || '/api/video-library', 'https://usd-impact.invalid');
}

function originalRequestUrl(request) {
  const internalUrl = requestUrl(request);
  const rawRoute = String(internalUrl.searchParams.get(ROUTE_PARAM) || '').trim();
  internalUrl.searchParams.delete(ROUTE_PARAM);
  internalUrl.searchParams.delete('__video_library');
  const decodedRoute = rawRoute ? decodeURIComponent(rawRoute).replace(/^\/+|\/+$/g, '') : '';
  const candidate = decodedRoute ? `${ROOT_PATH}${decodedRoute}/` : ROOT_PATH;
  const safePath = safeNextPath(candidate, ROOT_PATH);
  const parsed = new URL(safePath, 'https://usd-impact.invalid');
  if (!parsed.pathname.startsWith(ROOT_PATH)) throw new Error('Invalid video library route.');
  const query = internalUrl.searchParams.toString();
  const target = `${parsed.pathname}${parsed.search}${query ? `${parsed.search ? '&' : '?'}${query}` : ''}`;
  return new URL(target, requestOrigin(request));
}

function routeSlug(protectedUrl) {
  const remainder = protectedUrl.pathname.slice(ROOT_PATH.length).replace(/\/+$/, '');
  if (!remainder) return null;
  if (remainder.includes('/') || !SLUG_PATTERN.test(remainder)) return false;
  return remainder;
}

function redirect(response, destination, status = 302) {
  response.statusCode = status;
  response.setHeader('Location', `${destination.pathname}${destination.search}${destination.hash}`);
  response.end();
}

function sendHtml(response, request, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  response.end(request.method === 'HEAD' ? '' : body);
}

function methodNotAllowed(response) {
  response.statusCode = 405;
  response.setHeader('Allow', 'GET, HEAD');
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.end('Method not allowed.');
}

export async function handleVideoLibraryRequest(
  request,
  response,
  {
    readAccessState = readAccountAccessState,
    resolveSession = resolveSessionWithRefresh,
    createToken = createCloudflareStreamToken,
    environment = process.env,
  } = {},
) {
  const customerCode = getStreamCustomerCode(environment);
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Vary', 'Cookie, Authorization');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', videoLibraryContentSecurityPolicy(customerCode));

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
    return redirect(
      response,
      buildPaidAccessRequiredRedirect(protectedUrl, normalizePaidAccessReason(state?.reason)),
    );
  }

  const slug = routeSlug(protectedUrl);
  if (slug === false) {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Protected page not found.');
  }

  if (!slug) return sendHtml(response, request, 200, renderProtectedVideoCatalog());

  const video = getVideo(slug);
  const videoUid = getStreamUid(slug);
  if (!video || !videoUid) {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return response.end('Protected page not found.');
  }

  if (request.method === 'HEAD') {
    response.statusCode = 200;
    return response.end();
  }

  try {
    const signedToken = await createToken({ videoUid, environment });
    return sendHtml(response, request, 200, renderProtectedVideoLesson({
      video,
      signedToken,
      customerCode,
    }));
  } catch (error) {
    safeCloudflareStreamError(error);
    return sendHtml(response, request, 503, renderVideoUnavailable({ video }));
  }
}
