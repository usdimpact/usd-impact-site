import { readSessionAccessToken } from './supabase-auth.js';
import { readAccountAccessState } from './supabase-server.js';
import {
  RESEARCH_ACCESS_SURFACES,
  resolveResearchAccess,
} from './research-access-gate.js';
import { RESEARCH_MEMBERSHIP_PRODUCT_ID } from './research-membership-runtime.js';

const WEEKLY_REPORT_PREFIX = '/reports/weekly';
const KNOWN_RESEARCH_STATES = new Set([
  'pending',
  'active',
  'past_due',
  'cancel_scheduled',
  'cancelled',
  'refunded',
  'disputed',
  'charged_back',
]);

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

export async function decideWeeklyResearchPreviewRequest({
  request,
  environment = process.env,
  readAccessToken = readSessionAccessToken,
  readAccessState = readAccountAccessState,
} = {}) {
  const url = new URL(request.url);
  if (environment.VERCEL_ENV !== 'preview' || !isWeeklyResearchPreviewPath(url.pathname)) {
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
    return redirect(url, '/account/access-required/', 'denied');
  }

  const subscriptionState = state?.entitlement?.state;
  if (!KNOWN_RESEARCH_STATES.has(subscriptionState)) {
    return redirect(url, '/account/access-required/', 'denied');
  }

  const decision = resolveResearchAccess({
    surface: RESEARCH_ACCESS_SURFACES.WEEKLY_REPORT,
    subscriptionState,
  });

  if (decision.allowed) {
    return Object.freeze({ action: 'allow', reason: decision.reason, location: null });
  }

  return redirect(url, '/account/access-required/', 'denied');
}
