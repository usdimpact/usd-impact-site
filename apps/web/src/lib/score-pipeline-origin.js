export const LEGACY_SCORE_PIPELINE_ORIGIN = 'https://usd-impact-pipeline.pages.dev';
export const BRANDED_SCORE_PIPELINE_ORIGIN = 'https://score.usd-impact.com';

const ALLOWED_SCORE_PIPELINE_ORIGINS = new Set([
  LEGACY_SCORE_PIPELINE_ORIGIN,
  BRANDED_SCORE_PIPELINE_ORIGIN,
]);

function normalizeOrigin(value) {
  return value.replace(/\/+$/, '');
}

export function resolveScorePipelineOrigin(value) {
  const candidate = typeof value === 'string' && value.trim()
    ? normalizeOrigin(value.trim())
    : LEGACY_SCORE_PIPELINE_ORIGIN;

  if (!ALLOWED_SCORE_PIPELINE_ORIGINS.has(candidate)) {
    throw new Error(
      `Unsupported Score pipeline origin: ${candidate}. `
      + `Allowed origins are ${[...ALLOWED_SCORE_PIPELINE_ORIGINS].join(', ')}.`,
    );
  }

  return candidate;
}

export function scorePipelineUrl(pathname, originValue) {
  const origin = resolveScorePipelineOrigin(originValue);
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${origin}${path}`;
}

export function scorePipelineArchiveUrl(weekEnding, originValue) {
  const date = typeof weekEnding === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(weekEnding)
    ? new Date(`${weekEnding}T00:00:00.000Z`)
    : null;
  if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== weekEnding) {
    throw new Error('Score archive week must be a valid ISO date (YYYY-MM-DD).');
  }
  return scorePipelineUrl(`/archive/${weekEnding}/weekly_input.json`, originValue);
}
