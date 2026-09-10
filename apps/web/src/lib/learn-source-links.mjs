/**
 * References for two existing public Learn pages only.
 * Import only from the Learn detail renderer, not the shared card catalog.
 * No network I/O, content mutation, sourcePath access, or dispatch capability.
 */
const EMPTY = Object.freeze([]);
const ALLOWED_URLS = new Set([
  'https://www.federalreserve.gov/data/tips-yield-curve-and-inflation-compensation.htm',
  'https://www.treasurydirect.gov/marketable-securities/tips/',
  'https://www.ice.com/products/194/US-Dollar-Index-Futures',
  'https://www.federalreserve.gov/econres/notes/feds-notes/revisions-to-the-federal-reserve-dollar-indexes-20190115.html',
  'https://www.federalreserve.gov/releases/h10/Summary/',
]);

/** Reject unreviewed URLs and markup; Astro must also escape displayed text. */
export function validateLearnSourceLinks(entries) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 3) {
    throw new TypeError('Expected one to three reviewed references.');
  }
  const seen = new Set();
  return Object.freeze(entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
        || Object.keys(entry).sort().join(',') !== 'label,scope,url') {
      throw new TypeError('Unexpected reference fields.');
    }
    const { label, scope, url } = entry;
    for (const value of [label, scope]) {
      if (typeof value !== 'string' || !value.trim() || value.length > 240
          || /[<>\u0000-\u001f\u007f]/.test(value)) {
        throw new TypeError('Expected bounded plain reference text.');
      }
    }
    if (typeof url !== 'string' || !ALLOWED_URLS.has(url) || seen.has(url)) {
      throw new TypeError('Reference URL is unreviewed or duplicated.');
    }
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password
        || parsed.search || parsed.hash) throw new TypeError('Unsafe reference URL.');
    seen.add(url);
    return Object.freeze({ label, scope, url });
  }));
}

const REFERENCES = new Map([
  ['card-real-yield', Object.freeze({
    slug: 'real-yield',
    sourceLinks: validateLearnSourceLinks([
      {
        label: 'Federal Reserve: TIPS yields and inflation compensation',
        url: 'https://www.federalreserve.gov/data/tips-yield-curve-and-inflation-compensation.htm',
        scope: 'Real-yield measures and inflation compensation. This is a revisable research series, not an official statistical release.',
      },
      {
        label: 'TreasuryDirect: TIPS mechanics',
        url: 'https://www.treasurydirect.gov/marketable-securities/tips/',
        scope: 'Fixed interest rates and inflation-adjusted principal; not a promise about a secondary-market purchase or realized return.',
      },
    ]),
  })],
  ['card-dxy-broad-purpose', Object.freeze({
    slug: 'dxy-vs-broad-usd-what-each-index-answers',
    sourceLinks: validateLearnSourceLinks([
      {
        label: 'ICE: U.S. Dollar Index reference basket',
        url: 'https://www.ice.com/products/194/US-Dollar-Index-Futures',
        scope: 'The component-currency description on ICE\'s product page; not a recommendation to trade futures.',
      },
      {
        label: 'Federal Reserve: dollar-index methodology, January 2019',
        url: 'https://www.federalreserve.gov/econres/notes/feds-notes/revisions-to-the-federal-reserve-dollar-indexes-20190115.html',
        scope: 'Trade-based index construction. Historical composition and weights in this note are not a current weight snapshot.',
      },
      {
        label: 'Federal Reserve H.10: nominal and real dollar indexes',
        url: 'https://www.federalreserve.gov/releases/h10/Summary/',
        scope: 'Series definitions and access to the published indexes; no current index values are reproduced here.',
      },
    ]),
  })],
]);

/** Return nothing for unknown, private, unpublished, or mismatched identities. */
export function getLearnSourceLinks(card) {
  if (!card || typeof card !== 'object' || card.access !== 'open'
      || card.status !== 'ready-for-build') return EMPTY;
  const record = REFERENCES.get(card.id);
  if (!record || record.slug !== card.slug) return EMPTY;
  return record.sourceLinks;
}
