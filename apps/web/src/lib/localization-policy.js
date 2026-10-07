export const DEFAULT_LOCALE = 'en';

export const SUPPORTED_LOCALES = Object.freeze(['en', 'es']);

export const LOCALE_POLICY = Object.freeze({
  en: Object.freeze({
    locale: 'en',
    sourceLocale: 'en',
    pathPrefix: '',
    publicationEnabled: true,
    audience: 'current English edition',
  }),
  es: Object.freeze({
    locale: 'es',
    sourceLocale: 'en',
    pathPrefix: '/es',
    publicationEnabled: false,
    audience: 'neutral international Spanish / Retail LATAM',
  }),
});

const ENGLISH_AUDIOBOOK_PROGRESS_KEY = 'usd-impact-library-pass-audiobook-progress';

function cleanLocale(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function resolveSupportedLocale(value) {
  const locale = cleanLocale(value);
  return SUPPORTED_LOCALES.includes(locale) ? locale : null;
}

export function normalizeLocale(value, fallback = DEFAULT_LOCALE) {
  return resolveSupportedLocale(value) ?? resolveSupportedLocale(fallback) ?? DEFAULT_LOCALE;
}

export function getLocalePolicy(value) {
  const locale = resolveSupportedLocale(value);
  return locale ? LOCALE_POLICY[locale] : null;
}

export function isLocalePublicationEnabled(value) {
  return getLocalePolicy(value)?.publicationEnabled === true;
}

export function isPreviewLocaleImplementationEnabled(value, vercelEnv = process.env.VERCEL_ENV) {
  const policy = getLocalePolicy(value);
  return Boolean(policy) && policy.publicationEnabled !== true && String(vercelEnv ?? '').trim().toLowerCase() === 'preview';
}

function normalizePathname(value) {
  const raw = String(value ?? '/').trim() || '/';
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const withoutQuery = withLeadingSlash.split(/[?#]/, 1)[0] || '/';
  if (withoutQuery === '/') return '/';
  return withoutQuery.replace(/\/+$/, '') || '/';
}

export function isUnpublishedLocalePath(pathname) {
  const path = normalizePathname(pathname);

  return Object.values(LOCALE_POLICY).some((policy) => (
    policy.publicationEnabled !== true
    && policy.pathPrefix
    && (path === policy.pathPrefix || path.startsWith(`${policy.pathPrefix}/`))
  ));
}

export function audiobookProgressStorageKey(value = DEFAULT_LOCALE) {
  const locale = resolveSupportedLocale(value);

  if (!locale) {
    throw new TypeError(`Unsupported locale: ${String(value ?? '')}`);
  }

  if (locale === 'en') return ENGLISH_AUDIOBOOK_PROGRESS_KEY;
  return `${ENGLISH_AUDIOBOOK_PROGRESS_KEY}:${locale}`;
}
