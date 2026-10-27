export const LEGACY_SCORE_PIPELINE_ORIGIN = 'https://usd-impact-pipeline.pages.dev';
export const BRANDED_SCORE_PIPELINE_ORIGIN = 'https://score.usd-impact.com';

const ALLOWED_SCORE_PIPELINE_ORIGINS = new Set([
  LEGACY_SCORE_PIPELINE_ORIGIN,
  BRANDED_SCORE_PIPELINE_ORIGIN,
]);

const PREVIEW_HOST_RE = /^[a-z0-9-]+\.usd-impact-pipeline\.pages\.dev$/;
function normalizeOrigin(value) {
  return value.replace(/\/+$/, '');
}

export function resolveScorePipelineOrigin(value, previewOrigin = '', environment = '') {
  const candidate = typeof value === 'string' && value.trim()
    ? normalizeOrigin(value.trim())
    : LEGACY_SCORE_PIPELINE_ORIGIN;

  // A Preview origin is allowed only when explicitly pinned by the build environment.
  const pinned = typeof previewOrigin === 'string' ? normalizeOrigin(previewOrigin.trim()) : '';
  let previewAllowed = false;
  try {
    const parsed = new URL(candidate);
    previewAllowed = environment === 'preview' && candidate === pinned && parsed.protocol === 'https:' &&
      !parsed.username && !parsed.password && !parsed.port &&
      candidate === parsed.origin &&
      parsed.pathname === '/' && !parsed.search && !parsed.hash &&
      PREVIEW_HOST_RE.test(parsed.hostname);
  } catch { /* Invalid origins are rejected below. */ }
  if (!ALLOWED_SCORE_PIPELINE_ORIGINS.has(candidate) && !previewAllowed) {
    throw new Error(
      `Unsupported Score pipeline origin: ${candidate}. `
      + `Allowed origins are ${[...ALLOWED_SCORE_PIPELINE_ORIGINS].join(', ')}.`,
    );
  }

  return candidate;
}

export function scorePipelineUrl(pathname, originValue, previewOrigin = '', environment = '') {
  const origin = resolveScorePipelineOrigin(originValue, previewOrigin, environment);
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${origin}${path}`;
}

export function scorePipelineArchiveUrl(weekEnding, originValue, previewOrigin = '', environment = '') {
  const date = typeof weekEnding === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(weekEnding)
    ? new Date(`${weekEnding}T00:00:00.000Z`)
    : null;
  if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== weekEnding) {
    throw new Error('Score archive week must be a valid ISO date (YYYY-MM-DD).');
  }
  const origin = resolveScorePipelineOrigin(originValue, previewOrigin, environment);
  return `${origin}/archive/${weekEnding}/weekly_input.json`;
}
