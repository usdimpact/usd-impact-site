const SUPPORTED_SOURCE_TYPES = new Set(['daily', 'weekly', 'catalyst', 'report']);
const ALLOWED_SOURCE_STATUSES = new Set(['published']);

const CTA_BY_TYPE = Object.freeze({
  daily: 'Full verified context → Daily USD Impact',
  weekly: 'Read the complete Weekly Score',
  catalyst: 'Read the verified Catalyst Brief',
  report: 'Read the full report',
});

const DISCLOSURE = 'Educational only. Not investment advice, a recommendation, forecast, or trading signal.';

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compactText(value, maxLength = 220) {
  const text = asText(value).replace(/\s+/g, ' ');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function slug(value) {
  return asText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

function collectSourceUrls(source) {
  const urls = new Set();
  const add = (value) => {
    const text = asText(value);
    if (!text) return;
    try {
      const parsed = new URL(text, 'https://www.usd-impact.com');
      if (parsed.protocol === 'https:') urls.add(parsed.href);
    } catch {
      // Invalid URLs are intentionally ignored and handled by the evidence gate.
    }
  };

  add(source.url);
  for (const item of asArray(source.sources)) add(item?.url);
  for (const item of asArray(source.sourceEditions)) add(item?.url);
  for (const item of asArray(source.evidence)) add(item?.url);
  return [...urls];
}

function sourceDate(source) {
  return asText(source.date || source.periodEnd || source.eventDate || source.lastReviewed || source.generatedAt).slice(0, 10);
}

function makeCommon(source, sourceType) {
  const date = sourceDate(source);
  const title = asText(source.title);
  const sourceUrls = collectSourceUrls(source);
  const status = asText(source.status);
  const failures = [];

  if (!SUPPORTED_SOURCE_TYPES.has(sourceType)) failures.push(`unsupported source type: ${sourceType}`);
  if (!title) failures.push('source title is required');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) failures.push('a source date in YYYY-MM-DD form is required');
  if (!ALLOWED_SOURCE_STATUSES.has(status)) failures.push(`source status must be published, found: ${status || 'missing'}`);
  if (sourceUrls.length === 0) failures.push('at least one HTTPS source or governed USD Impact URL is required');

  return {
    date,
    title,
    sourceUrls,
    status,
    failures,
    candidateId: `social-${sourceType}-${date || 'undated'}-${slug(title)}`,
    cta: CTA_BY_TYPE[sourceType],
    ctaHref: asText(source.url),
  };
}

function estimateSeconds(segments) {
  const words = segments
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(8, Math.round((words / 145) * 60));
}

function generatedPacketBase(source, sourceType, common) {
  return {
    schemaVersion: 1,
    candidateId: common.candidateId,
    source: {
      type: sourceType,
      title: common.title,
      date: common.date,
      status: common.status,
      url: asText(source.url),
      evidenceUrls: common.sourceUrls,
    },
    brand: {
      brandKit: 'USD Impact — Production',
      format: '1080x1920',
      presenter: 'none',
      captionsRequired: true,
      captionedVariantRequiredForPublish: true,
    },
    compliance: {
      disclosure: DISCLOSURE,
      prohibited: ['personalized recommendation', 'buy/sell instruction', 'guaranteed outcome', 'unsupported forecast'],
    },
  };
}

function dailyPacket(source, common) {
  const highlights = asArray(source.highlights).slice(0, 3);
  if (highlights.length === 0) common.failures.push('Daily source requires at least one highlight');

  const summary = compactText(source.summary, 260);
  if (!summary) common.failures.push('Daily source requires a summary');

  const lead = highlights[0] || {};
  const narration = [
    `USD Impact Today. ${summary}`,
    lead.headline ? compactText(`${lead.headline}. ${lead.whyItMatters || lead.development}`, 260) : '',
    source.marketRegime ? `Regime context: ${compactText(source.marketRegime, 120)}.` : '',
    'Read the driver before the story.',
  ].filter(Boolean);

  return {
    outputs: {
      reel: {
        family: 'USD Impact Today',
        hook: lead.headline ? compactText(lead.headline, 90) : compactText(common.title, 90),
        narrationSegments: narration,
        estimatedSeconds: estimateSeconds(narration),
        endFrame: `${common.cta} · Educational only`,
      },
      carousel: {
        slides: [
          { role: 'cover', text: 'USD IMPACT TODAY' },
          { role: 'summary', text: summary },
          ...highlights.map((item) => ({
            role: 'highlight',
            text: compactText(`${item.headline}: ${item.whyItMatters || item.development}`, 240),
          })),
          { role: 'cta', text: common.cta },
        ],
      },
      stories: highlights.map((item) => ({
        headline: compactText(item.headline, 90),
        text: compactText(item.whyItMatters || item.development, 180),
      })),
      quiz: null,
    },
  };
}

function weeklyPacket(source, common) {
  const themes = asArray(source.themes).slice(0, 4);
  if (themes.length === 0) common.failures.push('Weekly source requires themes');
  if (!source.score || typeof source.score.value !== 'number') common.failures.push('Weekly source requires a numeric score');

  const scoreLine = source.score && typeof source.score.value === 'number'
    ? `Weekly Score: ${source.score.value}. Regime: ${compactText(source.score.regime, 80)}.`
    : '';
  const narration = [
    scoreLine,
    ...themes.slice(0, 3).map((theme) => compactText(`${theme.title}. ${theme.summary}`, 230)),
    'Use the score as a structured regime check, not as a standalone trading signal.',
  ].filter(Boolean);

  return {
    outputs: {
      reel: {
        family: 'Weekly Score',
        hook: scoreLine || compactText(common.title, 90),
        narrationSegments: narration,
        estimatedSeconds: estimateSeconds(narration),
        endFrame: `${common.cta} · Educational only`,
      },
      carousel: {
        slides: [
          { role: 'cover', text: 'WEEKLY SCORE' },
          source.score ? { role: 'score', text: `${source.score.value} · ${compactText(source.score.regime, 100)}` } : null,
          ...themes.map((theme) => ({ role: 'theme', text: compactText(`${theme.title}: ${theme.summary}`, 240) })),
          { role: 'cta', text: common.cta },
        ].filter(Boolean),
      },
      stories: themes.slice(0, 3).map((theme) => ({ headline: compactText(theme.title, 90), text: compactText(theme.summary, 180) })),
      quiz: null,
    },
  };
}

function catalystPacket(source, common) {
  const facts = asArray(source.verifiedFacts).slice(0, 4);
  const channels = asArray(source.transmissionChannels).slice(0, 4);
  const watch = asArray(source.whatToWatch).slice(0, 4);
  if (facts.length < 2) common.failures.push('Catalyst source requires at least two verified facts');
  if (channels.length < 2) common.failures.push('Catalyst source requires at least two transmission channels');
  if (watch.length < 1) common.failures.push('Catalyst source requires what-to-watch items');

  const phase = asText(source.phase);
  if (!['preview', 'outcome'].includes(phase)) common.failures.push('Catalyst phase must be preview or outcome');

  const family = phase === 'outcome' ? 'Catalyst Result' : 'Catalyst Ahead';
  const narration = [
    `${family}: ${compactText(source.event || common.title, 120)}.`,
    ...facts.slice(0, 2).map((fact) => compactText(fact.statement, 220)),
    ...channels.slice(0, 2).map((channel) => compactText(`${channel.channel}: ${channel.conditionalImpact}`, 220)),
    watch[0] ? `What to watch: ${compactText(watch[0], 180)}` : '',
  ].filter(Boolean);

  return {
    outputs: {
      reel: {
        family,
        hook: `${family.toUpperCase()} · ${compactText(source.event || common.title, 80)}`,
        narrationSegments: narration,
        estimatedSeconds: estimateSeconds(narration),
        endFrame: `${common.cta} · Educational only`,
      },
      carousel: {
        slides: [
          { role: 'cover', text: family.toUpperCase() },
          ...facts.map((fact) => ({ role: 'verified-fact', text: compactText(fact.statement, 230) })),
          ...channels.map((channel) => ({ role: 'transmission', text: compactText(`${channel.channel}: ${channel.conditionalImpact}`, 230) })),
          { role: 'watch', text: watch.length ? compactText(`What to watch: ${watch.join(' · ')}`, 250) : 'What to watch: verify the next official update.' },
          { role: 'cta', text: common.cta },
        ],
      },
      stories: facts.slice(0, 3).map((fact) => ({ headline: family, text: compactText(fact.statement, 180) })),
      quiz: null,
    },
  };
}

function reportPacket(source, common) {
  const points = asArray(source.keyPoints || source.themes).slice(0, 5).map((item) => (
    typeof item === 'string' ? item : `${item?.title || ''}${item?.summary ? `: ${item.summary}` : ''}`
  )).filter(Boolean);
  if (points.length < 2) common.failures.push('Report source requires at least two key points or themes');
  const summary = compactText(source.summary, 300);
  if (!summary) common.failures.push('Report source requires a summary');

  const narration = [summary, ...points.slice(0, 3).map((point) => compactText(point, 220))].filter(Boolean);
  return {
    outputs: {
      reel: {
        family: 'Report / Deep Dive',
        hook: compactText(common.title, 90),
        narrationSegments: narration,
        estimatedSeconds: estimateSeconds(narration),
        endFrame: `${common.cta} · Educational only`,
      },
      carousel: {
        slides: [
          { role: 'cover', text: compactText(common.title, 120) },
          { role: 'summary', text: summary },
          ...points.map((point) => ({ role: 'key-point', text: compactText(point, 240) })),
          { role: 'cta', text: common.cta },
        ],
      },
      stories: points.slice(0, 3).map((point) => ({ headline: 'REPORT', text: compactText(point, 180) })),
      quiz: null,
    },
  };
}

export function generateSocialCandidate(source, sourceType) {
  if (!source || typeof source !== 'object') {
    return {
      schemaVersion: 1,
      state: 'blocked',
      failures: ['source must be an object'],
      outputs: null,
    };
  }

  const type = asText(sourceType || source.type).toLowerCase();
  const common = makeCommon(source, type);
  const base = generatedPacketBase(source, type, common);
  let generated = { outputs: null };

  if (type === 'daily') generated = dailyPacket(source, common);
  else if (type === 'weekly') generated = weeklyPacket(source, common);
  else if (type === 'catalyst') generated = catalystPacket(source, common);
  else if (type === 'report') generated = reportPacket(source, common);

  return {
    ...base,
    state: common.failures.length === 0 ? 'draft' : 'blocked',
    failures: [...common.failures],
    ...generated,
    qa: {
      evidencePresent: common.sourceUrls.length > 0,
      publishedSource: common.status === 'published',
      humanReviewRequired: true,
      publishable: false,
      nextState: common.failures.length === 0 ? 'needs-editorial-review' : 'blocked',
    },
  };
}

export const socialCandidateConstants = Object.freeze({
  supportedSourceTypes: [...SUPPORTED_SOURCE_TYPES],
  disclosure: DISCLOSURE,
  ctaByType: CTA_BY_TYPE,
});
