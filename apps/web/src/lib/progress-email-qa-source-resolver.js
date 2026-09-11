import { createVercelProtectedPreviewFetch } from './vercel-protected-preview-fetch.js';
import { verifyProgressEmailQaSourceArtifact } from './progress-email-qa-source-artifact.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ARTIFACT_BYTES = 512_000;

export class ProgressEmailQaSourceResolverError extends Error {
  constructor(message, code = 'PROGRESS_EMAIL_QA_SOURCE_RESOLUTION_FAILED', status = 503) {
    super(message);
    this.name = 'ProgressEmailQaSourceResolverError';
    this.code = code;
    this.status = status;
  }
}

function requireWeekEnding(value) {
  const weekEnding = String(value ?? '').trim();
  const parsed = Date.parse(`${weekEnding}T00:00:00.000Z`);
  if (!DATE_PATTERN.test(weekEnding) || !Number.isFinite(parsed)) {
    throw new ProgressEmailQaSourceResolverError(
      'Progress QA source week is invalid.',
      'INVALID_PROGRESS_EMAIL_QA_SOURCE_WEEK',
      400,
    );
  }
  return weekEnding;
}

function artifactUrl({ weekEnding, environment }) {
  let base;
  try {
    base = new URL(String(environment.PROGRESS_EMAIL_BASE_URL ?? '').trim());
  } catch {
    throw new ProgressEmailQaSourceResolverError(
      'PROGRESS_EMAIL_BASE_URL is invalid.',
      'INVALID_PROGRESS_EMAIL_QA_SOURCE_BASE_URL',
    );
  }
  if (base.protocol !== 'https:' || base.username || base.password) {
    throw new ProgressEmailQaSourceResolverError(
      'PROGRESS_EMAIL_BASE_URL is outside the approved Preview boundary.',
      'INVALID_PROGRESS_EMAIL_QA_SOURCE_BASE_URL',
    );
  }
  base.pathname = `/newsletter/progress/${weekEnding}.json`;
  base.search = '';
  base.hash = '';
  return base.toString();
}

async function readArtifactResponse(response) {
  if (!response?.ok) {
    throw new ProgressEmailQaSourceResolverError(
      `Progress QA source artifact request failed with status ${response?.status ?? 'unknown'}.`,
      'PROGRESS_EMAIL_QA_SOURCE_HTTP_FAILED',
    );
  }
  const text = await response.text();
  if (!text || Buffer.byteLength(text, 'utf8') > MAX_ARTIFACT_BYTES) {
    throw new ProgressEmailQaSourceResolverError(
      'Progress QA source artifact is empty or exceeds the approved size boundary.',
      'PROGRESS_EMAIL_QA_SOURCE_SIZE_INVALID',
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ProgressEmailQaSourceResolverError(
      'Progress QA source artifact is not valid JSON.',
      'PROGRESS_EMAIL_QA_SOURCE_JSON_INVALID',
    );
  }
}

export async function resolveProgressEmailQaSources({
  weekEnding,
  environment = process.env,
  fetchImpl = fetch,
} = {}) {
  const week = requireWeekEnding(weekEnding);
  if (String(environment.VERCEL_ENV ?? '').trim().toLowerCase() !== 'preview') {
    throw new ProgressEmailQaSourceResolverError(
      'Progress QA source resolution is available only in Preview.',
      'PROGRESS_EMAIL_QA_SOURCE_PREVIEW_ONLY',
      404,
    );
  }

  const protectedFetch = createVercelProtectedPreviewFetch({ environment, fetchImpl });
  let response;
  try {
    response = await protectedFetch(artifactUrl({ weekEnding: week, environment }), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (error instanceof ProgressEmailQaSourceResolverError) throw error;
    const wrapped = new ProgressEmailQaSourceResolverError(
      'Progress QA source artifact could not be fetched from the protected Preview deployment.',
      'PROGRESS_EMAIL_QA_SOURCE_FETCH_FAILED',
    );
    wrapped.cause = error;
    throw wrapped;
  }

  let artifact;
  try {
    artifact = verifyProgressEmailQaSourceArtifact(await readArtifactResponse(response));
  } catch (error) {
    if (error instanceof ProgressEmailQaSourceResolverError) throw error;
    const wrapped = new ProgressEmailQaSourceResolverError(
      'Progress QA source artifact failed integrity validation.',
      'PROGRESS_EMAIL_QA_SOURCE_INTEGRITY_FAILED',
    );
    wrapped.cause = error;
    throw wrapped;
  }
  if (artifact.payload.weekEnding !== week) {
    throw new ProgressEmailQaSourceResolverError(
      'Progress QA source artifact does not match the requested Weekly period.',
      'PROGRESS_EMAIL_QA_SOURCE_WEEK_MISMATCH',
    );
  }

  return Object.freeze({
    weeklyReports: artifact.payload.sourceReports,
    currentWeeklyReport: artifact.payload.currentWeeklyReport,
    artifactChecksum: artifact.checksum,
  });
}
