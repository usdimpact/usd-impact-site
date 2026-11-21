import { readSessionAccessToken } from './supabase-auth.js';
import { readAccountAccessState } from './supabase-server.js';
import {
  RESEARCH_ACCESS_SURFACES,
  resolveResearchAccess,
} from './research-access-gate.js';
import { RESEARCH_MEMBERSHIP_PRODUCT_ID } from './research-membership-runtime.js';

const WEEKLY_REPORT_PREFIX = '/reports/weekly';
const MONTHLY_REPORT_PREFIX = '/reports/monthly';
const WEEKLY_SCORE_PATH = '/score';
function normalizePathname(value) {
  const normalized = String(value || '/').replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return normalized || '/';
}

function requestTarget(url) {
  return `${url.pathname}${url.search}`;
}

function redirect(url, pathname, reason = null) {
  const destination = new URL(pathname, url);
  destination.searchParams.set('next', requestTarget(url));
  if (reason) destination.searchParams.set('reason', reason);
  return Object.freeze({ action: 'redirect', location: destination.toString(), reason });
}

export function isWeeklyResearchPreviewPath(pathname) {
  const normalized = normalizePathname(pathname);
  return normalized === WEEKLY_REPORT_PREFIX || normalized.startsWith(`${WEEKLY_REPORT_PREFIX}/`);
}

export function isMonthlyResearchPreviewPath(pathname) {
  const normalized = normalizePathname(pathname);
  return normalized === MONTHLY_REPORT_PREFIX || normalized.startsWith(`${MONTHLY_REPORT_PREFIX}/`);
}

export function isWeeklyScoreResearchPreviewPath(pathname) {
  return normalizePathname(pathname) === WEEKLY_SCORE_PATH;
}

export function researchPreviewSurfaceForPath(pathname) {
  if (isWeeklyResearchPreviewPath(pathname)) return RESEARCH_ACCESS_SURFACES.WEEKLY_REPORT;
  if (isMonthlyResearchPreviewPath(pathname)) return RESEARCH_ACCESS_SURFACES.MONTHLY_REPORT;
  if (isWeeklyScoreResearchPreviewPath(pathname)) return RESEARCH_ACCESS_SURFACES.WEEKLY_SCORE;
  return null;
}

export async function decideResearchPreviewRequest({
  request,
  environment = process.env,
  readAccessToken = readSessionAccessToken,
  readAccessState = readAccountAccessState,
} = {}) {
  const url = new URL(request.url);
  const surface = researchPreviewSurfaceForPath(url.pathname);
  if (environment.VERCEL_ENV !== 'preview' || !surface) {
    return Object.freeze({ action: 'allow', reason: 'preview-gate-inactive', location: null });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return Object.freeze({ action: 'allow', reason: 'method-out-of-scope', location: null });
  }

  const accessToken = readAccessToken(request);
  if (!accessToken) {
    return redirect(url, '/account/sign-in/', 'authentication-required');
  }

  let state;
  try {
    state = await readAccessState({
      accessToken,
      productId: RESEARCH_MEMBERSHIP_PRODUCT_ID,
      environment,
    });
  } catch {
    return redirect(url, '/research/access-required/', 'denied');
  }

  // Never authorize Preview access from an entitlement state alone.
  // readAccountAccessState verifies the bearer user, active profile and
  // entitlement dates, returning allowed=false on deletion or expiration.
  // Keep explicit profile/product checks as defense against inconsistent
  // account reads and accidental future changes to the state provider.
  const entitlement = state?.entitlement;
  if (
    state?.allowed !== true
    || state?.profile?.status !== 'active'
    || entitlement?.productId !== RESEARCH_MEMBERSHIP_PRODUCT_ID
    || entitlement?.state !== 'active'
  ) {
    return redirect(url, '/research/access-required/', 'denied');
  }

  // The subscription may be scheduled to cancel, but the entitlement remains
  // 'active' through its paid window; readAccountAccessState validated dates.
  const subscriptionState = entitlement.state;

  const decision = resolveResearchAccess({
    surface,
    subscriptionState,
  });

  if (decision.allowed) {
    return Object.freeze({ action: 'allow', reason: decision.reason, location: null });
  }

  return redirect(url, '/research/access-required/', 'denied');
}

export const decideWeeklyResearchPreviewRequest = decideResearchPreviewRequest;
