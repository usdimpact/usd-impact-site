// Search presentation only. Never use this list to grant or deny account access.
export const SEARCH_UTILITY_PATHS = Object.freeze([
  '/account',
  '/account/access-required',
  '/account/notifications',
  '/account/passkeys',
  '/account/sign-in',
  '/auth/confirm',
  '/auth/session-ready',
  '/checkout',
  '/research/access-required',
  '/research/account',
]);

const utilityPaths = new Set(SEARCH_UTILITY_PATHS);

/** Accept a URL pathname, not a URL or query string. Does not modify the request. */
export function isSearchUtilityPath(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')
      || pathname.startsWith('//') || /[?#\\]/.test(pathname)) return false;
  return utilityPaths.has(pathname.replace(/\/+$/, '') || '/');
}
