import { createHash } from 'node:crypto';
import { parsePublicationCalendarSource } from './publication-calendar-source.js';

// Dormant policy core. No default provider, admission writer, route or deployment hook.
// Only protected server adapters may supply authority/history. Request JSON is not evidence.
export const SERVING_SCOPE = Object.freeze({
  repository: 'usdimpact/usd-impact-site',
  projectId: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7',
  teamId: 'team_1LuMlacGuM198mRjoID4O3Ct',
});
export const SERVING_NO_STORE = Object.freeze({
  'Cache-Control': 'private, no-store',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
});
const HEX = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const DEPLOYMENT = /^dpl_[A-Za-z0-9]{8,80}$/;
const ROUTE = /^\/news\/(?:\d{4}-\d{2}-\d{2}|catalysts\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const SURFACES = new Set(['article', 'homepage', 'news-current', 'news-archive', 'feed', 'latest-json', 'sitemap']);
const CURRENT = new Set(['homepage', 'news-current', 'feed', 'latest-json']);
const MAX_SNAPSHOT_MS = 15_000;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const fail = (code) => { const error = new Error(code); error.policyCode = code; throw error; };
const requireThat = (condition, code) => { if (!condition) fail(code); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function copy(value) {
  const encoded = JSON.stringify(value);
  requireThat(typeof encoded === 'string' && Buffer.byteLength(encoded) <= 2_000_000, 'HOLD_INVALID_EVIDENCE');
  return freeze(JSON.parse(encoded));
}
function instant(value) {
  requireThat(typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), 'HOLD_INVALID_TIME');
  const time = Date.parse(value);
  requireThat(Number.isFinite(time) && new Date(time).toISOString() === value, 'HOLD_INVALID_TIME');
  return time;
}
function scope(value) {
  requireThat(value && Object.entries(SERVING_SCOPE).every(([key, expected]) => value[key] === expected), 'HOLD_SCOPE_MISMATCH');
}
function baseline(value) {
  requireThat(value && SHA.test(value.commitSha) && DEPLOYMENT.test(value.deploymentId)
    && HEX.test(value.inventorySha256), 'HOLD_LEGACY_BASELINE_UNVERIFIED');
  return { commitSha: value.commitSha, deploymentId: value.deploymentId, inventorySha256: value.inventorySha256 };
}
function authority(value, now) {
  scope(value);
  requireThat(value.schema === 'publication-serving-authority/v1' && value.target === 'production'
    && value.exposure === 'public-approved', 'HOLD_PUBLIC_CONTEXT_UNVERIFIED');
  requireThat(DEPLOYMENT.test(value.deploymentId) && SHA.test(value.commitSha)
    && HEX.test(value.artifactSha256) && typeof value.historyRevision === 'string'
    && /^[a-zA-Z0-9_-]{1,120}$/.test(value.historyRevision), 'HOLD_INVALID_AUTHORITY');
  const observed = instant(value.observedAt); const expires = instant(value.validUntil);
  requireThat(observed <= now && now < expires && expires - observed <= MAX_SNAPSHOT_MS,
    'HOLD_AUTHORITY_EXPIRED');
  requireThat(Array.isArray(value.entries) && value.entries.length <= 500, 'HOLD_MANIFEST_INVALID');
  const seen = new Set();
  const entries = value.entries.map((item) => {
    requireThat(item && ROUTE.test(item.path) && HEX.test(item.sourceSha256) && !seen.has(item.path), 'HOLD_MANIFEST_INVALID');
    seen.add(item.path); return { path: item.path, sourceSha256: item.sourceSha256 };
  }).sort((a, b) => a.path.localeCompare(b.path));
  requireThat(value.manifestSha256 === hash(JSON.stringify(entries)), 'HOLD_MANIFEST_INVALID');
  return freeze({ ...SERVING_SCOPE, deploymentId: value.deploymentId, commitSha: value.commitSha,
    artifactSha256: value.artifactSha256, manifestSha256: value.manifestSha256,
    historyRevision: value.historyRevision, entries,
    legacyBaseline: value.legacyBaseline === null ? null : baseline(value.legacyBaseline),
    validUntil: value.validUntil });
}
function sameAuthority(a, b) {
  // A refresh may shorten validity, but must not silently extend an existing ticket.
  return same({ ...a, validUntil: null }, { ...b, validUntil: null });
}
function publication(source) {
  requireThat(typeof source === 'string' && Buffer.byteLength(source) <= 256_000, 'HOLD_SOURCE_INVALID');
  const payload = parsePublicationCalendarSource(source);
  requireThat(payload.status === 'published', 'HOLD_NOT_PUBLISHED');
  requireThat(ROUTE.test(payload.slug), 'HOLD_ROUTE_INVALID');
  const brief = payload.slug.startsWith('/news/catalysts/');
  requireThat(payload.category === (brief ? 'USD Impact Catalyst Brief' : 'Daily USD Impact'), 'HOLD_ROUTE_INVALID');
  if (!brief) requireThat(payload.slug === `/news/${payload.date}`, 'HOLD_ROUTE_INVALID');
  return freeze({ path: payload.slug, sourceSha256: hash(source), payload, brief });
}
function previewDeadline(item) {
  const rows = item.brief ? [item.payload] : item.payload.catalysts;
  requireThat(Array.isArray(rows) && rows.length <= 10, 'HOLD_HISTORY_INVALID');
  const times = [];
  for (const row of rows) {
    requireThat(row && row.calendar && typeof row.calendar === 'object', 'HOLD_HISTORY_INVALID');
    requireThat(row.calendar.publisher === 'BLS' && ['CPI', 'PPI', 'EMPSIT'].includes(row.calendar.series)
      && row.calendar.releaseStage === 'initial', 'HOLD_HISTORY_INVALID');
    const released = instant(row.calendar.releaseAt);
    if (!item.brief || row.phase === 'preview') {
      if (item.brief) requireThat(row.statusLabel === 'scheduled-confirmed', 'HOLD_HISTORY_INVALID');
      times.push(released);
    } else requireThat(row.phase === 'outcome' && row.statusLabel === 'released', 'HOLD_HISTORY_INVALID');
  }
  return times.length ? Math.min(...times) : null;
}
function historyDecision(record, item, current, now) {
  if (record === null) return { decision: 'HOLD_NOT_ADMITTED' };
  requireThat(record && record.schema === 'publication-admission/v1', 'HOLD_HISTORY_INVALID');
  scope(record);
  requireThat(record.path === item.path && record.sourceSha256 === item.sourceSha256, 'HOLD_CONTENT_MISMATCH');
  if (record.state === 'revoked') return { decision: 'HOLD_REVOKED' };
  if (record.state === 'pending') return { decision: 'HOLD_ADMISSION_PENDING' };
  requireThat(record.state === 'admitted', 'HOLD_HISTORY_INVALID');
  if (record.basis === 'legacy-baseline') {
    requireThat(current.legacyBaseline !== null && same(baseline(record.baseline), current.legacyBaseline),
      'HOLD_LEGACY_BASELINE_UNVERIFIED');
    requireThat(instant(record.observedAt) <= now && record.admittedAt === null
      && record.calendarVerified === false, 'HOLD_HISTORY_INVALID');
    return { decision: 'SERVE_LEGACY_ARCHIVE', current: false, calendarVerified: false, previewDeadline: null };
  }
  const hasEvents = item.brief || (Array.isArray(item.payload.catalysts) && item.payload.catalysts.length > 0);
  requireThat(record.basis === (hasEvents ? 'calendar-verified' : 'no-calendar-entries')
    && record.calendarVerified === hasEvents
    && DEPLOYMENT.test(record.deploymentId) && SHA.test(record.commitSha)
    && HEX.test(record.artifactSha256) && HEX.test(record.evidenceSha256), 'HOLD_HISTORY_INVALID');
  const checked = instant(record.calendarCheckedAt); const admitted = instant(record.admittedAt);
  const validUntil = instant(record.calendarValidUntil); const deadline = previewDeadline(item);
  if (item.brief && item.payload.phase === 'outcome') {
    requireThat(admitted >= instant(item.payload.calendar.releaseAt), 'HOLD_HISTORY_INVALID');
  }
  requireThat(checked <= admitted && admitted <= now && admitted < validUntil
    && validUntil - checked <= 15 * 60_000, 'HOLD_HISTORY_INVALID');
  requireThat(record.previewDeadline === (deadline === null ? null : new Date(deadline).toISOString())
    && (deadline === null || admitted < deadline), 'HOLD_HISTORY_INVALID');
  return { decision: 'SERVE_RECORDED_PUBLICATION', current: deadline === null || now < deadline,
    calendarVerified: hasEvents, previewDeadline: deadline };
}

/**
 * A dormant read-only policy, NOT a provider authenticator or admission transaction.
 * loadAuthority/readHistory must be trusted server-only adapters, never request data.
 * No adapter is implemented or selected here. Missing adapters deny all inspection.
 * No method can create, finalize, sign, persist or promote an admission.
 */
export function createPublicationServingPolicy({ loadAuthority, readHistory, now = Date.now } = {}) {
  const tickets = new WeakMap(); let highestTime = -1; let lastAuthority = null;
  let inspectionSequence = 0; let authorityEpoch = 0;
  function invalidateAuthority() {
    authorityEpoch++;
    lastAuthority = null;
  }
  function clock() {
    const value = now();
    requireThat(Number.isSafeInteger(value) && value >= 0 && value >= highestTime, 'HOLD_INVALID_CLOCK');
    highestTime = value; return value;
  }
  async function inspect(sources) {
    // Fence every await: a superseded read must neither restore stale authority
    // nor clear the newer inspection's successful result when it fails late.
    const sequence = ++inspectionSequence;
    const latest = () => requireThat(sequence === inspectionSequence, 'HOLD_INSPECTION_SUPERSEDED');
    try {
      requireThat(typeof loadAuthority === 'function' && typeof readHistory === 'function', 'HOLD_ADAPTER_NOT_CONFIGURED');
      requireThat(Array.isArray(sources) && sources.length <= 500
        && sources.every((source) => typeof source === 'string')
        && sources.reduce((size, source) => size + Buffer.byteLength(source), 0) <= 4_000_000, 'HOLD_SOURCE_INVALID');
      const sourceSnapshot = sources.slice();
      const started = clock();
      const firstAuthority = await loadAuthority(); latest();
      const a = authority(copy(firstAuthority), clock());
      const candidates = []; const audit = []; const paths = new Set();
      for (const source of sourceSnapshot) {
        try {
          const item = publication(source);
          requireThat(!paths.has(item.path), 'HOLD_DUPLICATE_PATH'); paths.add(item.path);
          requireThat(a.entries.some((row) => row.path === item.path && row.sourceSha256 === item.sourceSha256), 'HOLD_CONTENT_MISMATCH');
          candidates.push(item);
        } catch (error) {
          if (error.policyCode === 'HOLD_DUPLICATE_PATH') throw error;
          audit.push({ decision: error.policyCode ?? 'HOLD_SOURCE_INVALID' });
        }
      }
      const keys = candidates.map(({ path, sourceSha256 }) => ({ path, sourceSha256 }));
      const history = await readHistory(freeze({ revision: a.historyRevision, entries: keys })); latest();
      const snapshot = copy(history);
      requireThat(snapshot && snapshot.revision === a.historyRevision && Array.isArray(snapshot.records)
        && snapshot.records.length === keys.length, 'HOLD_HISTORY_SNAPSHOT_INVALID');
      const unique = new Set(); const outcomes = [];
      for (const item of candidates) {
        const matching = snapshot.records.filter((row) => row?.path === item.path && row.sourceSha256 === item.sourceSha256);
        requireThat(matching.length === 1 && !unique.has(item.path), 'HOLD_HISTORY_SNAPSHOT_INVALID'); unique.add(item.path);
        let decision;
        try { decision = historyDecision(matching[0].record, item, a, clock()); }
        catch (error) { decision = { decision: error.policyCode ?? 'HOLD_HISTORY_INVALID' }; }
        outcomes.push(freeze({ ...item, ...decision }));
        audit.push({ sourceSha256: item.sourceSha256, decision: decision.decision });
      }
      const finalAuthority = await loadAuthority(); latest();
      const b = authority(copy(finalAuthority), clock());
      requireThat(sameAuthority(a, b), 'HOLD_AUTHORITY_DRIFT');
      const expiry = Math.min(instant(a.validUntil), instant(b.validUntil), started + MAX_SNAPSHOT_MS);
      requireThat(clock() < expiry, 'HOLD_AUTHORITY_EXPIRED');
      // Epochs are monotonic: an invalidated ticket cannot become valid again
      // after recovery or an A-to-B-to-A change of otherwise identical fields.
      if (lastAuthority && (!sameAuthority(lastAuthority, b)
          || expiry < instant(lastAuthority.validUntil))) authorityEpoch++;
      lastAuthority = freeze({ ...b, validUntil: new Date(expiry).toISOString() });
      const ticket = Object.freeze({ state: 'INSPECTED', publicationAuthorized: false, enforcementActive: false });
      tickets.set(ticket, { outcomes, audit: freeze(audit), authority: b, expiry, epoch: authorityEpoch });
      return ticket;
    } catch (error) {
      const superseded = sequence !== inspectionSequence;
      // Only the newest inspection can update shared authority. Its failure
      // permanently invalidates prior tickets, but a fresh inspection can recover.
      if (!superseded) invalidateAuthority();
      return Object.freeze({ state: 'HOLD', decision: superseded ? 'HOLD_INSPECTION_SUPERSEDED'
        : error.policyCode ?? 'HOLD_ADAPTER_UNAVAILABLE',
        publicationAuthorized: false, enforcementActive: false });
    }
  }
  function project(ticket, { surface = 'article', method = 'GET' } = {}) {
    try {
      requireThat(['GET', 'HEAD'].includes(method), 'HOLD_METHOD_NOT_ALLOWED');
      requireThat(SURFACES.has(surface), 'HOLD_SURFACE_UNSUPPORTED');
      requireThat(ticket && tickets.has(ticket), 'HOLD_UNTRUSTED_TICKET');
      const data = tickets.get(ticket); const time = clock();
      requireThat(lastAuthority && data.epoch === authorityEpoch
        && sameAuthority(data.authority, lastAuthority), 'HOLD_AUTHORITY_DRIFT');
      requireThat(time < data.expiry && time < instant(lastAuthority.validUntil), 'HOLD_AUTHORITY_EXPIRED');
      const selected = data.outcomes.filter((item) => item.decision.startsWith('SERVE_'))
        .map((item) => ({ ...item, current: item.current && (item.previewDeadline === null || time < item.previewDeadline) }))
        .filter((item) => !CURRENT.has(surface) || item.current);
      return freeze({ decision: 'PROJECTED_RECORDED_ONLY',
        view: { items: method === 'HEAD' ? [] : selected.map((item) => ({ ...item.payload,
          publicationPresentation: item.current ? 'current' : 'archive', calendarVerified: item.calendarVerified })) },
        // Internal diagnostics contain no held title, slug, event, date, excerpt or article body.
        audit: data.audit, headers: { ...SERVING_NO_STORE },
        publicationAuthorized: false, enforcementActive: false });
    } catch (error) {
      return freeze({ decision: error.policyCode ?? 'HOLD_POLICY_ERROR', view: { items: [] },
        headers: { ...SERVING_NO_STORE }, publicationAuthorized: false, enforcementActive: false });
    }
  }
  return Object.freeze({ inspect, project });
}
