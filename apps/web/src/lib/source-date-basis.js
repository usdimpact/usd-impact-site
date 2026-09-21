export const SOURCE_DATE_BASIS = Object.freeze({
  PUBLISHED: 'published',
  LAST_UPDATED: 'last-updated',
  CURRENT_RELEASE: 'current-release',
  DOCUMENT_INDEX: 'document-index',
});

// This rolling index has separately dated documents, not one release date.
const TREASURY_REFUNDING_INDEX_PATH = '/policy-issues/financing-the-government/quarterly-refunding/most-recent-quarterly-refunding-documents';
const FEDERAL_RESERVE_POSTINGS_INDEX_PATH = '/recentpostings.htm';

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
  const indexHostname = hostname.replace(/\.$/, '');
  if (indexHostname === 'home.treasury.gov' || indexHostname === 'federalreserve.gov') {
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '').toLowerCase();
    } catch {
      return SOURCE_DATE_BASIS.PUBLISHED;
    }
    if ((indexHostname === 'home.treasury.gov' && pathname === TREASURY_REFUNDING_INDEX_PATH)
      || (indexHostname === 'federalreserve.gov' && pathname === FEDERAL_RESERVE_POSTINGS_INDEX_PATH)) {
      return SOURCE_DATE_BASIS.DOCUMENT_INDEX;
    }
  }
  if (hostname === 'federalreserve.gov') {
    return LIVING_FEDERAL_RESERVE_PATHS.some((pattern) => pattern.test(url.pathname))
      ? SOURCE_DATE_BASIS.LAST_UPDATED
      : SOURCE_DATE_BASIS.PUBLISHED;
  }
  if (hostname === 'bls.gov' && /^\/cpi\/?$/i.test(url.pathname)) {
    return SOURCE_DATE_BASIS.CURRENT_RELEASE;
  }
  if (hostname === 'eia.gov' && /^\/petroleum\/supply\/weekly\/index\.php$/i.test(url.pathname)) {
    return SOURCE_DATE_BASIS.CURRENT_RELEASE;
  }
  return SOURCE_DATE_BASIS.PUBLISHED;
}

export function isLivingSourceUrl(value) {
  const basis = sourceDateBasisForUrl(value);
  // A document index must never become a blanket historical-date exemption.
  return basis === SOURCE_DATE_BASIS.LAST_UPDATED || basis === SOURCE_DATE_BASIS.CURRENT_RELEASE;
}

export function sourceDateAttributionIssue(value) {
  if (sourceDateBasisForUrl(value) !== SOURCE_DATE_BASIS.DOCUMENT_INDEX) return null;
  // The current bundle cannot bind an index date to independently verified item
  // evidence. Hold new candidates; leave published archives untouched.
  const hostname = new URL(String(value)).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const label = hostname === 'federalreserve.gov' ? 'Federal Reserve Recent Postings' : 'Treasury refunding';
  return `${label} index requires a directly linked dated document; cite that document with its own verified date, or omit the unsupported source and claim. Do not borrow a date from another index item.`;
}
