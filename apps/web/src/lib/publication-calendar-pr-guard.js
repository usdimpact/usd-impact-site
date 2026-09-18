const CATALYST_PREFIX = 'apps/web/src/content/catalyst-briefs/';
const SUPPORTED_SERIES = new Set(['CPI', 'PPI', 'EMPSIT']);

function scalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  if (!match) return '';
  const raw = match[1].trim();
  if (raw.startsWith('"')) {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'string' ? parsed : '';
    } catch {
      return '';
    }
  }
  return raw;
}

export function parseGuardedCatalystSource(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 262144) {
    throw new Error('HOLD_SOURCE_BOUNDS');
  }
  const parts = raw.split(/^---\s*$/m);
  if (parts.length < 3) throw new Error('HOLD_SOURCE_FRONTMATTER');
  const frontmatter = parts[1];
  const phase = scalar(frontmatter, 'phase');
  const event = scalar(frontmatter, 'event');
  const status = scalar(frontmatter, 'status');
  const statusLabel = scalar(frontmatter, 'statusLabel');
  const calendarMatch = frontmatter.match(/^calendar:\s*(.+?)\s*$/m);
  let calendar = null;
  if (calendarMatch) {
    const value = calendarMatch[1].trim();
    if (value !== 'null') {
      try {
        calendar = JSON.parse(value);
      } catch {
        throw new Error('HOLD_CALENDAR_SCHEMA');
      }
      if (!calendar || Array.isArray(calendar) || typeof calendar !== 'object') {
        throw new Error('HOLD_CALENDAR_SCHEMA');
      }
    }
  }
  return Object.freeze({ phase, event, status, statusLabel, calendar });
}

export function mentionsSupportedBlsSeriesLabel(event) {
  const value = String(event ?? '');
  return /\bBLS\b/i.test(value)
    && /(Consumer Price Index|Producer Price Index|Employment Situation)/i.test(value);
}

export function canonicalPreviewReleaseAt(calendar) {
  if (!calendar || typeof calendar !== 'object' || Array.isArray(calendar)) {
    throw new Error('HOLD_MISSING_CALENDAR_RECORD');
  }
  if (calendar.publisher !== 'BLS' || !SUPPORTED_SERIES.has(calendar.series)
    || calendar.releaseStage !== 'initial'
    || calendar.timeZone !== 'America/New_York'
    || !/^20\d{2}-\d{2}$/.test(String(calendar.referencePeriod ?? ''))
    || !/^20\d{2}-\d{2}-\d{2}$/.test(String(calendar.eventDate ?? ''))
    || !/^\d{2}:\d{2}$/.test(String(calendar.releaseTime ?? ''))
    || typeof calendar.releaseAt !== 'string') {
    throw new Error('HOLD_CALENDAR_SCHEMA');
  }
  const releaseMs = Date.parse(calendar.releaseAt);
  if (!Number.isFinite(releaseMs) || new Date(releaseMs).toISOString() !== calendar.releaseAt) {
    throw new Error('HOLD_CALENDAR_INSTANT');
  }
  return releaseMs;
}

export function classifyPublicationCalendarChanges(changes, {
  nowMs = Date.now(),
  guardWindowMs = 60 * 60 * 1000,
} = {}) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0
    || !Number.isSafeInteger(guardWindowMs) || guardWindowMs < 0 || guardWindowMs > 6 * 60 * 60 * 1000) {
    throw new Error('HOLD_GUARD_CONFIGURATION');
  }
  let relevantCount = 0;
  let earliestBlockAt = null;
  for (const change of Array.isArray(changes) ? changes : []) {
    if (!change || change.status === 'removed' || typeof change.path !== 'string'
      || !change.path.startsWith(CATALYST_PREFIX) || !change.path.endsWith('.md')) continue;
    let source;
    try {
      source = parseGuardedCatalystSource(change.content);
    } catch (error) {
      return Object.freeze({
        decision: 'BLOCK',
        reason: error?.message ?? 'HOLD_SOURCE_INVALID',
        path: change.path,
        relevantCount,
        blockAt: null,
        releaseAt: null,
      });
    }
    if (source.phase !== 'preview') continue;
    const hasSupportedHint = mentionsSupportedBlsSeriesLabel(source.event);
    if (!source.calendar && !hasSupportedHint) continue;
    relevantCount += 1;
    if (!source.calendar && hasSupportedHint) {
      return Object.freeze({
        decision: 'BLOCK',
        reason: 'HOLD_MISSING_CALENDAR_RECORD',
        path: change.path,
        relevantCount,
        blockAt: null,
        releaseAt: null,
      });
    }
    let releaseMs;
    try {
      releaseMs = canonicalPreviewReleaseAt(source.calendar);
    } catch (error) {
      return Object.freeze({
        decision: 'BLOCK',
        reason: error?.message ?? 'HOLD_CALENDAR_INVALID',
        path: change.path,
        relevantCount,
        blockAt: null,
        releaseAt: null,
      });
    }
    const blockAt = releaseMs - guardWindowMs;
    if (earliestBlockAt === null || blockAt < earliestBlockAt) earliestBlockAt = blockAt;
    if (nowMs >= blockAt) {
      return Object.freeze({
        decision: 'BLOCK',
        reason: nowMs >= releaseMs ? 'HOLD_PREVIEW_EXPIRED' : 'HOLD_FRESHNESS_SAFETY_WINDOW',
        path: change.path,
        relevantCount,
        blockAt: new Date(blockAt).toISOString(),
        releaseAt: new Date(releaseMs).toISOString(),
      });
    }
  }
  return Object.freeze({
    decision: 'PASS',
    reason: relevantCount ? 'PASS_PREVIEW_FRESH' : 'PASS_NOT_APPLICABLE',
    path: null,
    relevantCount,
    blockAt: earliestBlockAt === null ? null : new Date(earliestBlockAt).toISOString(),
    releaseAt: null,
  });
}

export function shouldAutoClosePublicationPr(pr, result, {
  automationBranchPrefix = 'automation/catalyst-brief-',
} = {}) {
  return Boolean(
    pr
    && result?.decision === 'BLOCK'
    && typeof pr.headRef === 'string'
    && pr.headRef.startsWith(automationBranchPrefix)
  );
}
