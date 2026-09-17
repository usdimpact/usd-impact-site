const DEFAULT_ORIGIN = 'https://www.usd-impact.com';

function dataOf(entry) {
  if (!entry || typeof entry !== 'object') return {};
  return entry.data && typeof entry.data === 'object' ? entry.data : entry;
}

function absoluteUrl(value, origin = DEFAULT_ORIGIN) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    return new URL(value.trim(), origin).href;
  } catch {
    return '';
  }
}

function normalizeSourceList(items, origin) {
  return Array.isArray(items)
    ? items.map((item) => ({ ...item, url: absoluteUrl(item?.url, origin) })).filter((item) => item.url)
    : [];
}

function canonicalUrl(data, fallbackPath, origin) {
  return absoluteUrl(data.slug || fallbackPath, origin);
}

export function adaptDailyPublication(entry, options = {}) {
  const data = dataOf(entry);
  const origin = options.origin || DEFAULT_ORIGIN;
  const date = data.date || data.lastReviewed || '';
  return {
    type: 'daily',
    title: data.title || '',
    date,
    status: data.status || '',
    url: canonicalUrl(data, date ? `/news/${date}` : '', origin),
    summary: data.summary || '',
    marketRegime: data.marketRegime || '',
    highlights: Array.isArray(data.highlights) ? data.highlights : [],
    catalysts: Array.isArray(data.catalysts) ? data.catalysts : [],
    sources: normalizeSourceList(data.sources, origin),
    complianceNote: data.complianceNote || '',
  };
}

export function adaptWeeklyPublication(entry, options = {}) {
  const data = dataOf(entry);
  const origin = options.origin || DEFAULT_ORIGIN;
  return {
    type: 'weekly',
    title: data.title || '',
    periodStart: data.periodStart || '',
    periodEnd: data.periodEnd || '',
    status: data.status || '',
    url: canonicalUrl(data, data.periodEnd ? `/reports/weekly/${data.periodEnd}` : '', origin),
    summary: data.summary || '',
    score: data.score || null,
    themes: Array.isArray(data.themes) ? data.themes : [],
    catalysts: Array.isArray(data.catalysts) ? data.catalysts : [],
    sourceEditions: normalizeSourceList(data.sourceEditions, origin),
    complianceNote: data.complianceNote || '',
  };
}

export function adaptCatalystPublication(entry, options = {}) {
  const data = dataOf(entry);
  const origin = options.origin || DEFAULT_ORIGIN;
  const fallback = data.eventKey ? `/news/catalysts/${data.eventKey}` : '';
  return {
    type: 'catalyst',
    title: data.title || '',
    event: data.event || '',
    eventDate: data.eventDate || '',
    phase: data.phase || '',
    status: data.status || '',
    statusLabel: data.statusLabel || '',
    url: canonicalUrl(data, fallback, origin),
    summary: data.summary || '',
    assets: Array.isArray(data.assets) ? data.assets : [],
    verifiedFacts: Array.isArray(data.verifiedFacts) ? data.verifiedFacts : [],
    transmissionChannels: Array.isArray(data.transmissionChannels) ? data.transmissionChannels : [],
    whatToWatch: Array.isArray(data.whatToWatch) ? data.whatToWatch : [],
    sources: normalizeSourceList(data.sources, origin),
    complianceNote: data.complianceNote || '',
  };
}

export function adaptReportPublication(entry, options = {}) {
  const data = dataOf(entry);
  const origin = options.origin || DEFAULT_ORIGIN;
  const themes = Array.isArray(data.themes) ? data.themes : [];
  const keyPoints = Array.isArray(data.keyPoints) ? data.keyPoints : themes;
  const sourceEditions = normalizeSourceList(data.sourceEditions, origin);
  const explicitSources = normalizeSourceList(data.sources, origin);
  const scoreEvidence = data.score?.sourceUrl ? [{ title: 'USD Impact Score archive', url: absoluteUrl(data.score.sourceUrl, origin) }] : [];

  return {
    type: 'report',
    title: data.title || '',
    date: data.periodEnd || data.date || data.lastReviewed || '',
    status: data.status || '',
    url: canonicalUrl(data, '', origin),
    summary: data.summary || '',
    keyPoints,
    themes,
    evidence: [...explicitSources, ...sourceEditions, ...scoreEvidence].filter((item) => item.url),
    complianceNote: data.complianceNote || '',
  };
}

export function adaptPublicationForSocial(sourceType, entry, options = {}) {
  if (sourceType === 'daily') return adaptDailyPublication(entry, options);
  if (sourceType === 'weekly') return adaptWeeklyPublication(entry, options);
  if (sourceType === 'catalyst') return adaptCatalystPublication(entry, options);
  if (sourceType === 'report') return adaptReportPublication(entry, options);
  throw new Error(`Unsupported social source type: ${sourceType}`);
}

export const socialSourceAdapterConstants = Object.freeze({ defaultOrigin: DEFAULT_ORIGIN });
