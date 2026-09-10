export const PUBLIC_CANONICAL_ORIGIN = 'https://www.usd-impact.com';

/**
 * Build the public self-canonical from a request URL's pathname only.
 * Request origin, query parameters, and fragments are deliberately ignored.
 */
export function canonicalUrlForRequest(requestUrl) {
  if (!(requestUrl instanceof URL)) throw new TypeError('Expected a URL instance.');
  const { pathname } = requestUrl;
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) {
    throw new TypeError('Expected an absolute URL pathname.');
  }
  const canonicalPath = pathname === '/' ? '/' : (pathname.replace(/\/+$/, '') || '/');
  return `${PUBLIC_CANONICAL_ORIGIN}${canonicalPath}`;
}
