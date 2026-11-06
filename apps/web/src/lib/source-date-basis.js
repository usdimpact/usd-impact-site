export const SOURCE_DATE_BASIS = Object.freeze({
  PUBLISHED: 'published',
  LAST_UPDATED: 'last-updated',
  CURRENT_RELEASE: 'current-release',
  DOCUMENT_INDEX: 'document-index',
  ROLLING_REPORT: 'rolling-report',
});

// This rolling index has separately dated documents, not one release date.
const TREASURY_REFUNDING_INDEX_PATH = '/policy-issues/financing-the-government/quarterly-refunding/most-recent-quarterly-refunding-documents';
// Reused Treasury schedule PDF: archived Daily articles already cite multiple publication
// dates for this same URL. Query strings do not identify immutable document versions.
const TREASURY_TENTATIVE_AUCTION_SCHEDULE_PATH = '/system/files/221/tentative-auction-schedule.pdf';
const FEDERAL_RESERVE_POSTINGS_INDEX_PATH = '/recentpostings.htm';
const FEDERAL_RESERVE_NEWS_INDEX_PATH = '/newsevents.htm';
const FEDERAL_RESERVE_FOMC_PRESS_INDEX_PATH = /^\/newsevents\/pressreleases\/\d{4}-press-fomc\.htm$/;
// The annual BLS page aggregates monthly sections with separate Last Modified dates.
const BLS_ANNUAL_CALENDAR_PATH = /^\/schedule\/\d{4}\/home\.htm$/;
// Month-specific BLS calendar URLs are mutable and historical editions disagree
// about their Last Modified date. Block as discovery-only until independently
// verified source-specific date evidence can be bound to the edition.
const BLS_MONTHLY_CALENDAR_PATH = /^\/schedule\/\d{4}\/(?:0?[1-9]|1[0-2])_sched(?:_list)?\.htm$/;
// The CPS standing calendar lists future event dates but is not a dated news release.
// Its page Last Modified date is distinct from the events it lists.
const BLS_CPS_RELEASE_CALENDAR_PATH = '/cps/publications/release-calendar.htm';
// Reused full-report pointer; new citations must identify a dated release.
const EIA_WEEKLY_REPORT_POINTER_PATH = '/petroleum/supply/weekly/pdf/wpsrall.pdf';
// Individual WPSR tableNN.pdf URLs are also mutable weekly pointers, not
// dated snapshots. An arbitrary publishedAt must not turn a rolling PDF into
// a release-specific citation (Nov 4 generated Daily #1110 cited table14.pdf).
const EIA_WEEKLY_TABLE_POINTER_PATTERN = /^\/petroleum\/supply\/weekly\/pdf\/table[0-9]+\.pdf$/;
// Reusable WPSR schedule: event rows change over time, but the page exposes no
// page-level publication or Last Updated date suitable for publishedAt.
const EIA_WEEKLY_SCHEDULE_PATH = '/petroleum/supply/weekly/schedule.php';

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
  if (indexHostname === 'home.treasury.gov' || indexHostname === 'federalreserve.gov' || indexHostname === 'eia.gov' || indexHostname === 'bls.gov') {
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '').toLowerCase();
    } catch {
      return SOURCE_DATE_BASIS.PUBLISHED;
    }
    if (indexHostname === 'home.treasury.gov' && pathname === TREASURY_TENTATIVE_AUCTION_SCHEDULE_PATH) {
      return SOURCE_DATE_BASIS.ROLLING_REPORT;
    }
    if (indexHostname === 'eia.gov'
      && (pathname === EIA_WEEKLY_REPORT_POINTER_PATH || EIA_WEEKLY_TABLE_POINTER_PATTERN.test(pathname))) {
      return SOURCE_DATE_BASIS.ROLLING_REPORT;
    }
    if ((indexHostname === 'home.treasury.gov' && pathname === TREASURY_REFUNDING_INDEX_PATH)
      || (indexHostname === 'federalreserve.gov' && ([FEDERAL_RESERVE_POSTINGS_INDEX_PATH, FEDERAL_RESERVE_NEWS_INDEX_PATH].includes(pathname) || FEDERAL_RESERVE_FOMC_PRESS_INDEX_PATH.test(pathname)))
      || (indexHostname === 'bls.gov' && (BLS_ANNUAL_CALENDAR_PATH.test(pathname) || BLS_MONTHLY_CALENDAR_PATH.test(pathname) || pathname === BLS_CPS_RELEASE_CALENDAR_PATH))
      || (indexHostname === 'eia.gov' && pathname === EIA_WEEKLY_SCHEDULE_PATH)) {
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
  if (hostname === 'eia.gov' && /^\/petroleum\/supply\/weekly(?:\/(?:index\.php)?)?$/i.test(url.pathname)) {
    return SOURCE_DATE_BASIS.CURRENT_RELEASE;
  }
  if (hostname === 'bea.gov' && /^\/data\/personal-consumption-expenditures-price-index\/?$/i.test(url.pathname)) {
    return SOURCE_DATE_BASIS.CURRENT_RELEASE;
  }
  return SOURCE_DATE_BASIS.PUBLISHED;
}

export function isLivingSourceUrl(value) {
  const basis = sourceDateBasisForUrl(value);
  // Neither a document index nor a rolling report grants a date-check exemption.
  return basis === SOURCE_DATE_BASIS.LAST_UPDATED || basis === SOURCE_DATE_BASIS.CURRENT_RELEASE;
}

export function sourceDateAttributionIssue(value) {
  const basis = sourceDateBasisForUrl(value);
  if (basis === SOURCE_DATE_BASIS.ROLLING_REPORT) {
    let hostname = '';
    try {
      hostname = new URL(String(value)).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    } catch {
      // Invalid URLs will fail the ordinary HTTPS and URL checks.
    }
    if (hostname === 'home.treasury.gov') {
      return 'Treasury tentative auction schedule PDF is a mutable document pointer with conflicting historical publication dates. Cite a verified dated auction announcement or version-specific official document instead; do not copy an earlier release date, use access dates, or modify query parameters to bypass source verification. If no such source exists, omit the unsupported source and claim.';
    }
    return 'EIA weekly petroleum rolling report requires a verified dated archive document; cite that release-specific page or report with its own Release Date, not the data-week ending date, next release date or access date. Do not construct an archive URL or copy an older date merely to pass validation; omit the unsupported source and claim if the dated document cannot be verified.';
  }
  if (basis !== SOURCE_DATE_BASIS.DOCUMENT_INDEX) return null;
  // The current bundle cannot bind an index date to independently verified item
  // evidence. Hold new candidates; leave published archives untouched.
  const url = new URL(String(value));
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '').toLowerCase();
  if (hostname === 'eia.gov' && pathname === EIA_WEEKLY_SCHEDULE_PATH) {
    return 'EIA Weekly Petroleum Status Report schedule is a reusable schedule page without a page-level publication or Last Updated date. Use the current WPSR landing page when it directly supports the next-release claim and its displayed current Release Date as publishedAt, or cite a dated release-specific EIA document. Never assign an event date from the schedule table, an access date, or a prior historical date to the reusable schedule page; if no dated source supports the claim, omit the unsupported source and claim.';
  }
  if (hostname === 'bls.gov') {
    if (pathname === BLS_CPS_RELEASE_CALENDAR_PATH) {
      return 'BLS CPS release calendar is a reusable schedule index, not a news release. Its Last Modified date is different from the dates of listed events. Use a verified dated BLS news release or the relevant month-specific schedule with its own displayed Last Modified date; never assign an event date, edition date or access date as the publication date of the CPS calendar. If no eligible dated source supports the claim, omit the source and unsupported claim. Do not modify archived citations.';
    }
    if (BLS_MONTHLY_CALENDAR_PATH.test(pathname)) {
      return 'BLS month-specific release schedule is a mutable calendar with conflicting historical Last Modified dates. Use for event discovery only; cite a verified dated BLS release or official document supporting the claim. Never borrow a historical citation date, event date, edition date, or access date to satisfy source validation; omit the unsupported source and claim.';
    }
    return 'BLS annual release calendar aggregates separately updated monthly sections. Cite the relevant month-specific schedule with its own verified Last Modified date, or a directly linked dated release. Verify the event date separately; never use an access date, edition date, event date or another month section date as the annual page publication date. If no such source is verifiable, omit the unsupported source and claim.';
  }
  const label = hostname === 'federalreserve.gov'
    ? (pathname === FEDERAL_RESERVE_NEWS_INDEX_PATH
        ? 'Federal Reserve News and Events'
        : FEDERAL_RESERVE_FOMC_PRESS_INDEX_PATH.test(pathname)
          ? 'Federal Reserve annual FOMC press-release'
          : 'Federal Reserve Recent Postings')
    : 'Treasury refunding';
  return `${label} index requires a directly linked dated document; cite that document with its own verified date, or omit the unsupported source and claim. Do not borrow a date from another index item.`;
}
