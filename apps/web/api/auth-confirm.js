import { safeSupabaseError } from '../src/lib/supabase-server.js';
import {
  clearPkceCookie,
  exchangePasswordlessCode,
  readPkceVerifier,
  safeNextPath,
  setSessionCookies,
} from '../src/lib/supabase-auth.js';

function redirect(response, location, status = 303) {
  response.statusCode = status;
  response.setHeader('Location', location);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end();
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.statusCode = 405;
    response.setHeader('Allow', 'GET');
    response.end('Method not allowed.');
    return;
  }

  const url = new URL(request.url, 'https://usd-impact.invalid');
  const next = safeNextPath(url.searchParams.get('next'));
  const codeVerifier = readPkceVerifier(request);

  try {
    const session = await exchangePasswordlessCode({
      authCode: url.searchParams.get('code'),
      codeVerifier,
    });
    clearPkceCookie(response, request);
    setSessionCookies(response, request, session);
    return redirect(response, next);
  } catch (error) {
    clearPkceCookie(response, request);
    const safe = safeSupabaseError(error);
    const target = new URL('/account/sign-in/', 'https://usd-impact.invalid');
    target.searchParams.set('error', safe.status >= 500 ? 'service_unavailable' : 'invalid_link');
    return redirect(response, `${target.pathname}${target.search}`);
  }
}
