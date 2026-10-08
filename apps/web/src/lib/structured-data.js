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
    inLanguage: ['en', 'es'],
  };
}

export function webPageStructuredData({ url, title, description, inLanguage = 'en' } = {}) {
  if (!url || !title || !description) {
    throw new Error('WebPage structured data requires url, title, and description.');
  }
  return {
    '@type': 'WebPage',
    '@id': url,
    url,
    name: title,
    description,
    inLanguage,
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORGANIZATION_ID },
  };
}

function articleBase({ type, headline, description, pathname, datePublished, dateModified, image }) {
  if (!headline || !description || !pathname) {
    throw new Error('Structured article data requires headline, description, and pathname.');
  }
  const url = absoluteSiteUrl(pathname);
  const articleImage = image || absoluteSiteUrl('/assets/logo/USDImpact_Horizontal_Color_NoTagline_2048.png');
  return {
    '@type': type,
    '@id': `${url}#article`,
    headline,
    description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: articleImage,
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

export function structuredDataGraph(nodes = [], options = {}) {
  const locale = options.locale === 'es' ? 'es' : 'en';
  const localizedNodes = nodes.map((node) => (
    node
    && typeof node === 'object'
    && ['Article', 'NewsArticle'].includes(node['@type'])
    && !node.inLanguage
      ? { ...node, inLanguage: locale }
      : node
  ));
  const pageNode = options.url
    ? [webPageStructuredData({
        url: options.url,
        title: options.title,
        description: options.description,
        inLanguage: locale,
      })]
    : [];

  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationStructuredData(),
      websiteStructuredData(),
      ...pageNode,
      ...localizedNodes,
    ],
  };
}

export function serializeStructuredData(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}
