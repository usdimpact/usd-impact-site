// DEVELOPMENT SYNTHETIC REHEARSAL ONLY.
// Not imported by site routes, Vercel functions, middleware or real commerce.
// No real customer account, provider record, Supabase connection or provider data.
export const SYNTHETIC_RESEARCH_PRODUCT_ID = 'research-membership';
export const SYNTHETIC_REPORT_BODY_PREFIX = '<!-- SYNTHETIC_RESEARCH_REPORT_TEST_ONLY -->';

const ACCESS_STATES = new Set(['active', 'cancel_scheduled']);
const SHA40 = /^[a-f0-9]{40}$/;
const VALID_ROUTE = /^\/research\/member\/reports\/(weekly|monthly)\/(\d{4}-\d{2}-\d{2})\/?$/;
const PRIVATE_HEADERS = Object.freeze({
  'Cache-Control': 'private, no-store',
  'Vary': 'Cookie',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none'",
  'Content-Type': 'text/plain; charset=utf-8',
});

function reply(statusCode, body = '', extraHeaders = {}) {
  return Object.freeze({
    statusCode,
    headers: Object.freeze({ ...PRIVATE_HEADERS, ...extraHeaders }),
    body,
    releaseAuthorized: false,
    syntheticRehearsal: true,
  });
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const n = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value;
}

export function parseSyntheticPrivateReportPath(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length > 1024) return null;
  // URL normalization must not convert traversal or encoded separators to a valid route.
  const rawWithoutQuery = rawUrl.split(/[?#]/, 1)[0];
  if (rawWithoutQuery.includes('..') || rawWithoutQuery.includes('\\') ||
      rawWithoutQuery.includes('%')) return null;
  let pathname;
  try {
    const url = new URL(rawUrl, 'https://synthetic.example.invalid');
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    pathname = url.pathname;
  } catch { return null; }
  const match = pathname.match(VALID_ROUTE);
  if (!match || !validDate(match[2])) return null;
  return Object.freeze({ reportType: match[1], periodEnd: match[2] });
}

function timestamp(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : null;
}

export function syntheticAccountAuthorized(value, nowMs) {
  if (!Number.isFinite(nowMs) || value?.allowed !== true ||
      typeof value.user?.id !== 'string' || value.user.id.length === 0 ||
      value.profile?.status !== 'active') return false;
  const e = value.entitlement;
  if (!e || e.productId !== SYNTHETIC_RESEARCH_PRODUCT_ID ||
      e.accountId !== value.user.id || !ACCESS_STATES.has(e.state)) return false;
  if (e.startsAt != null) {
    const start = timestamp(e.startsAt);
    if (start == null || nowMs < start) return false;
  }
  if (e.endsAt != null) {
    const end = timestamp(e.endsAt);
    if (end == null || nowMs >= end) return false;
  }
  return true;
}

export function isSyntheticApprovedReportAsset(asset, reportType, periodEnd) {
  if (!asset || asset.syntheticFixture !== true ||
      asset.productId !== SYNTHETIC_RESEARCH_PRODUCT_ID ||
      asset.reportType !== reportType || asset.periodEnd !== periodEnd ||
      asset.rightsApproval !== 'synthetic-test-only-not-legal-approval' ||
      asset.approvedForMemberDelivery !== true || asset.originPublic !== false ||
      asset.rightsScope !== 'member' ||
      asset.privateObjectUrl != null || asset.providerSourceUrl != null ||
      asset.contentType !== 'text/html; charset=utf-8' ||
      !SHA40.test(asset.sourceCommit || '') ||
      typeof asset.body !== 'string' ||
      !asset.body.startsWith(SYNTHETIC_REPORT_BODY_PREFIX) ||
      Buffer.byteLength(asset.body, 'utf8') > 10_000) return false;
  return true;
}

export async function simulateResearchPrivateReportDelivery({
  request,
  environment = {},
  simulationMode = null,
  resolveSession,
  readAccess,
  readPrivateAsset,
  nowMs = Date.now(),
} = {}) {
  // This function is not a Production handler; no real account/service is wired.
  // These gates keep accidental reuse outside a Development rehearsal fail-closed.
  if (simulationMode !== 'synthetic-rehearsal' ||
      environment.VERCEL_ENV !== 'development' ||
      process.env.VERCEL_ENV === 'production') return reply(503);
  const method = request?.method;
  if (method !== 'GET' && method !== 'HEAD') {
    return reply(405, '', { Allow: 'GET, HEAD' });
  }
  const path = parseSyntheticPrivateReportPath(request?.url);
  if (!path) return reply(404);
  if (!Number.isFinite(nowMs) ||
      typeof resolveSession !== 'function' ||
      typeof readAccess !== 'function' ||
      typeof readPrivateAsset !== 'function') return reply(503);
  let resolved;
  try {
    // Models the exact verified-session -> readAccountAccessState service
    // dependency order. The token here exists only inside a synthetic test stub.
    resolved = await resolveSession({
      request,
      environment,
      response: { setHeader() {}, getHeader() { return undefined; } },
      verifyAccessToken: (accessToken) => readAccess({
        accessToken,
        productId: SYNTHETIC_RESEARCH_PRODUCT_ID,
        environment,
        nowMs,
      }),
    });
  } catch { return reply(503); }

  if (!resolved) return reply(401);
  if (!syntheticAccountAuthorized(resolved.value, nowMs)) return reply(403);

  let asset;
  try {
    asset = await readPrivateAsset({
      reportType: path.reportType,
      periodEnd: path.periodEnd,
      productId: SYNTHETIC_RESEARCH_PRODUCT_ID,
    });
  } catch { return reply(503); }
  if (asset == null) return reply(404);
  if (!isSyntheticApprovedReportAsset(asset, path.reportType, path.periodEnd)) {
    return reply(503);
  }
  return reply(
    200,
    method === 'HEAD' ? '' : asset.body,
    { 'Content-Type': 'text/html; charset=utf-8' },
  );
}
