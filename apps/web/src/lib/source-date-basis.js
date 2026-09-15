export const SOURCE_DATE_BASIS = Object.freeze({
  PUBLISHED: 'published',
  LAST_UPDATED: 'last-updated',
  CURRENT_RELEASE: 'current-release',
});

const LIVING_FEDERAL_RESERVE_PATHS = [
  /^\/newsevents\/calendar\.htm$/i,
  /^\/newsevents\/\d{4}-[a-z]+\.htm$/i,
  /^\/monetarypolicy\/fomccalendars\.htm$/i,
  /^\/monetarypolicy\.htm$/i,
];

export function sourceDateBasisForUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    return SOURCE_DATE_BASIS.PUBLISHED;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (hostname === 'federalreserve.gov') {
    return LIVING_FEDERAL_RESERVE_PATHS.some((pattern) => pattern.test(url.pathname))
      ? SOURCE_DATE_BASIS.LAST_UPDATED
      : SOURCE_DATE_BASIS.PUBLISHED;
  }
  if (hostname === 'bls.gov' && /^\/cpi\/?$/i.test(url.pathname)) {
    return SOURCE_DATE_BASIS.CURRENT_RELEASE;
  }
  return SOURCE_DATE_BASIS.PUBLISHED;
}

export function isLivingSourceUrl(value) {
  return sourceDateBasisForUrl(value) !== SOURCE_DATE_BASIS.PUBLISHED;
}
