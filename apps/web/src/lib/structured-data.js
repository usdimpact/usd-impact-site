const SITE_ORIGIN = 'https://www.usd-impact.com';

export const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

export function absoluteSiteUrl(pathname = '/') {
  return new URL(pathname, `${SITE_ORIGIN}/`).toString();
}

export function organizationStructuredData() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'KELA LEADS S.R.L.',
    alternateName: 'USD Impact',
    url: SITE_ORIGIN,
    logo: {
      '@type': 'ImageObject',
      url: absoluteSiteUrl('/assets/logo/USDImpact_Icon_Color_192.png'),
      width: 192,
      height: 192,
    },
  };
}

export function websiteStructuredData() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: 'USD Impact',
    url: SITE_ORIGIN,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

function articleBase({ type, headline, description, pathname, datePublished, dateModified }) {
  if (!headline || !description || !pathname) {
    throw new Error('Structured article data requires headline, description, and pathname.');
  }
  const url = absoluteSiteUrl(pathname);
  return {
    '@type': type,
    '@id': `${url}#article`,
    headline,
    description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function newsArticleStructuredData(input) {
  if (!input?.datePublished) throw new Error('NewsArticle structured data requires datePublished.');
  return articleBase({ ...input, type: 'NewsArticle' });
}

export function articleStructuredData(input) {
  return articleBase({ ...input, type: 'Article' });
}

export function structuredDataGraph(nodes = []) {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationStructuredData(), websiteStructuredData(), ...nodes],
  };
}

export function serializeStructuredData(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}
