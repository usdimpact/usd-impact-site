// UI-40 review-only Spanish destinations. These are not release authorizations.
// Both route generation and sitemap/canonical checks consume the same allowlist.
export const SPANISH_PUBLIC_REVIEW_SECTIONS = Object.freeze(['news', 'score', 'reports', 'video-library']);
export const SPANISH_PUBLIC_REVIEW_PATHS = Object.freeze(SPANISH_PUBLIC_REVIEW_SECTIONS.map((s) => `/es/${s}`));
export const SPANISH_PUBLIC_REVIEW_PAIRS = Object.freeze({
  '/news': '/es/news/',
  '/score': '/es/score/',
  '/reports': '/es/reports/',
  '/video-library': '/es/video-library/',
});
export function spanishPublicReviewEnabled(vercelEnv) {
  return String(vercelEnv ?? '') === 'preview';
}
export function isSpanishPublicReviewPath(pathname) {
  const normalized = String(pathname ?? '/').replace(/\/+$/, '') || '/';
  return SPANISH_PUBLIC_REVIEW_PATHS.includes(normalized);
}
