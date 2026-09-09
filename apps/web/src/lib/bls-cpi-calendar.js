import { blsMonthlyDefinition } from './publication-calendar-series.js';
import {
  CALENDAR_MAX_AGE_MS, CALENDAR_TIME_ZONE, CalendarHold, MONTHS, digest, hold,
  isCalendarDate, localReleaseInstant, referencePeriod,
} from './publication-calendar.js';

export const BLS_CPI_SCHEDULE = 'https://www.bls.gov/schedule/news_release/cpi.htm';
export const BLS_CPI_RELEASE = 'https://www.bls.gov/news.release/cpi.nr0.htm';
export const BLS_ADAPTER_VERSION = 'bls-national-monthly/html-v3';
// Truthful robot identity and public owner contact; never impersonate a browser.
export const BLS_CALENDAR_USER_AGENT = 'USDImpact-CalendarValidator/1.0 (+https://www.usd-impact.com/contact/)';
const MAX_SOURCE_BYTES = 512000;
const ALLOWED_URL = /^https:\/\/www\.bls\.gov\/(?:schedule\/news_release\/(?:cpi|ppi|empsit)\.htm|schedule\/20\d{2}\/(?:0[1-9]|1[0-2])_sched_list\.htm|news\.release\/(?:cpi|ppi|empsit)\.nr0\.htm)$/;

function visibleText(html) {
  return html.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, number) => {
      const point = number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
    })
    .replace(/&(nbsp|amp|quot|apos|ndash|mdash|rsquo|lt|gt);/gi, (_, name) => ({
      nbsp: ' ', amp: '&', quot: '"', apos: "'", ndash: '-', mdash: '-', rsquo: "'", lt: '<', gt: '>',
    })[name.toLowerCase()])
    .replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
}
function tableWithHeaders(html, expected) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  // BLS places the release table inside a layout table. Track table ownership;
  // flattening nested rows/cells would mix navigation with release metadata.
  const stack = [];
  const tables = [];
  const counts = { table: 0, tr: 0, cell: 0 };
  const malformed = () => hold('HOLD_SOURCE_SCHEMA', 'Malformed or ambiguous official table structure.');
  const tags = /<(\/?)(table|tr|th|td)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
  for (const token of clean.matchAll(tags)) {
    const closing = token[1] === '/';
    const tag = token[2].toLowerCase();
    const parent = stack.at(-1);
    if (/\/\s*>$/.test(token[0]) || (closing && !/^<\/(?:table|tr|th|td)\s*>$/i.test(token[0]))) malformed();
    if (!closing) {
      counts[tag === 'th' || tag === 'td' ? 'cell' : tag] += 1;
      if (counts.table > 30 || counts.tr > 1000 || counts.cell > 5000 || stack.length > 8) {
        hold('HOLD_SOURCE_SCHEMA', 'Official table exceeds the parser complexity bound.');
      }
    }
    if (tag === 'table') {
      if (!closing) {
        if (parent) {
          if (!parent.cell) malformed();
          parent.cell.nested = true;
          parent.nested = true;
        }
        stack.push({ rows: [], row: null, cell: null, nested: false, spans: false });
      } else {
        if (!parent || parent.row || parent.cell) malformed();
        tables.push(stack.pop());
      }
      continue;
    }
    if (!parent) malformed();
    if (tag === 'tr') {
      if (!closing) {
        if (parent.row || parent.cell) malformed();
        parent.row = [];
        parent.rows.push(parent.row);
      } else {
        if (!parent.row || parent.cell) malformed();
        parent.row = null;
      }
      continue;
    }
    if (!closing) {
      if (!parent.row || parent.cell) malformed();
      parent.cell = { tag, start: token.index + token[0].length, nested: false };
      if (/\b(?:rowspan|colspan)\s*=/i.test(token[0])) parent.spans = true;
    } else {
      if (!parent.cell || parent.cell.tag !== tag || !parent.row) malformed();
      parent.row.push(parent.cell.nested ? null : visibleText(clean.slice(parent.cell.start, token.index)));
      parent.cell = null;
    }
  }
  if (stack.length) malformed();
  const matches = tables.filter((table) => table.rows.length && JSON.stringify(table.rows[0]) === JSON.stringify(expected));
  if (matches.length !== 1 || matches[0].rows.length < 2) hold('HOLD_SOURCE_SCHEMA', 'Expected one unambiguous BLS schedule table.');
  const selected = matches[0];
  if (selected.nested || selected.spans || selected.rows.slice(1).some((row) => row.length !== expected.length)) {
    hold('HOLD_SOURCE_SCHEMA', 'Unexpected BLS schedule row shape.');
  }
  return selected.rows.slice(1);
}
function englishDate(text) {
  const match = text.match(/^(?:(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), )?([A-Za-z]+)\.? (\d{1,2}), (20\d{2})$/);
  if (!match) hold('HOLD_SOURCE_SCHEMA', 'Unrecognized official release date.');
  const token = match[2].toLowerCase();
  const month = MONTHS.findIndex((name) => name.toLowerCase() === token || name.slice(0, 3).toLowerCase() === token || (name === 'September' && token === 'sept')) + 1;
  const date = `${match[4]}-${String(month).padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  if (!month || !isCalendarDate(date)) hold('HOLD_SOURCE_SCHEMA', 'Invalid official calendar date.');
  if (match[1] && ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${date}T00:00:00Z`).getUTCDay()] !== match[1]) {
    hold('HOLD_SCHEDULE_CONFLICT', 'Official date and weekday disagree.');
  }
  return date;
}
function englishTime(text) {
  const match = text.match(/^(0?[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/i);
  if (!match) hold('HOLD_SOURCE_SCHEMA', 'Unrecognized official release time.');
  return `${String(Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)).padStart(2, '0')}:${match[2]}`;
}
function rejectScheduleNotice(text) {
  if (/\b(cancelled|canceled|postponed|rescheduled|to be announced|TBD)\b/i.test(text)) {
    hold('HOLD_SCHEDULE_CONFLICT', 'An official schedule notice requires reviewed resolution.');
  }
}
function definitionFor(series) {
  const definition = blsMonthlyDefinition(series);
  if (!definition) hold('HOLD_UNSUPPORTED_EVENT', 'No official BLS adapter exists for this series.');
  return definition;
}
export function parseBlsMonthlyReleaseSchedule(html, period, series) {
  const definition = definitionFor(series);
  if (!visibleText(html).includes(`Schedule of Releases for the ${definition.name}`)) {
    hold('HOLD_IDENTITY_MISMATCH', 'The source is not the requested national BLS release schedule.');
  }
  rejectScheduleNotice(visibleText(html));
  const rows = tableWithHeaders(html, ['Reference Month', 'Release Date', 'Release Time']);
  const parsed = rows.map((row) => {
    rejectScheduleNotice(row.join(' '));
    return { referencePeriod: referencePeriod(row[0]), eventDate: englishDate(row[1]), releaseTime: englishTime(row[2]) };
  });
  if (new Set(parsed.map((row) => row.referencePeriod)).size !== parsed.length) hold('HOLD_SCHEDULE_CONFLICT', 'Duplicate reference periods in the official schedule.');
  const matching = parsed.filter((row) => row.referencePeriod === period);
  if (matching.length !== 1) hold('HOLD_REFERENCE_PERIOD_MISMATCH', 'The reference period is not present exactly once in the official schedule.');
  const row = matching[0];
  return Object.freeze({ publisher: 'BLS', series, referencePeriod: row.referencePeriod, releaseStage: 'initial',
    eventDate: row.eventDate, releaseTime: row.releaseTime, timeZone: CALENDAR_TIME_ZONE,
    releaseAt: localReleaseInstant(row.eventDate, row.releaseTime),
  });
}
export function parseBlsCpiSchedule(html, period) { return parseBlsMonthlyReleaseSchedule(html, period, 'CPI'); }
export function confirmBlsMonthlySchedule(html, event) {
  const definition = definitionFor(event.series);
  const text = visibleText(html);
  if (!text.includes('All times on calendar are Eastern Time')) hold('HOLD_SOURCE_SCHEMA', 'Official monthly calendar timezone is missing.');
  const rows = tableWithHeaders(html, ['Date', 'Time', 'Release']);
  // Profile strings are fixed constants, never candidate-controlled regular expressions.
  const prefix = new RegExp(`^${definition.name}\\b`);
  const label = new RegExp(`^${definition.name} for ([A-Za-z]+ 20\\d{2})$`);
  const matching = rows.filter((row) => prefix.test(row[2])).filter((row) => {
    rejectScheduleNotice(row.join(' '));
    const match = row[2].match(label);
    if (!match) hold('HOLD_IDENTITY_MISMATCH', 'Ambiguous release entry in the official monthly calendar.');
    return referencePeriod(match[1]) === event.referencePeriod;
  });
  if (matching.length !== 1) hold('HOLD_SCHEDULE_CONFLICT', 'Monthly calendar does not confirm one matching event.');
  if (englishDate(matching[0][0]) !== event.eventDate || englishTime(matching[0][1]) !== event.releaseTime) {
    hold('HOLD_SCHEDULE_CONFLICT', 'Official schedule sources disagree on release timing.');
  }
}
export function parseBlsMonthlyRelease(html, series) {
  const definition = definitionFor(series);
  const text = visibleText(html);
  const titles = [...text.matchAll(new RegExp(`\\b${definition.resultHeading} - ([A-Z]+ 20\\d{2})\\b`, 'g'))];
  if (titles.length !== 1) hold('HOLD_OUTCOME_NOT_RELEASED', 'A unique matching national results heading is required.');
  const prefix = `Transmission of material in this ${definition.news ? 'news ' : ''}release is embargoed until`;
  const pattern = new RegExp(prefix + ' (?:USDL[- ]\\d{2}-\\d{4} )?(\\d{1,2}:[0-5]\\d) (a\\.m\\.|p\\.m\\.) \\(ET\\) ((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),? [A-Za-z]+ \\d{1,2}, 20\\d{2})', 'g');
  const timestamps = [...text.matchAll(pattern)];
  if (timestamps.length !== 1) hold('HOLD_OUTCOME_NOT_RELEASED', 'A unique official release timestamp is required.');
  const stamp = timestamps[0];
  const date = englishDate(stamp[3].replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) /, '$1, '));
  const time = englishTime(`${stamp[1]} ${stamp[2] === 'a.m.' ? 'AM' : 'PM'}`);
  if (timestamps[0].index > titles[0].index) hold('HOLD_OUTCOME_NOT_RELEASED', 'The embargo timestamp must precede the results heading.');
  const resultText = text.slice(titles[0].index + titles[0][0].length, titles[0].index + titles[0][0].length + 2000);
  if (!resultText.includes(definition.resultLead)
      || !resultText.includes('Bureau of Labor Statistics reported today')
      || !/\b(increased|decreased|declined|rose|fell|unchanged)\b/.test(resultText)) {
    hold('HOLD_OUTCOME_NOT_RELEASED', 'The official artifact does not contain a recognizable matching results statement.');
  }
  return Object.freeze({ referencePeriod: referencePeriod(titles[0][1]), releaseAt: localReleaseInstant(date, time) });
}
export function parseBlsCpiRelease(html) { return parseBlsMonthlyRelease(html, 'CPI'); }
// Diagnostics classify response metadata only. Raw headers, bodies, URLs supplied by
// a response, and exception messages never enter the diagnostic record.
function urlCategory(value, requested) {
  if (!value) return 'absent';
  if (typeof value !== 'string' || value.length > 4096) return 'invalid';
  try {
    const parsed = new URL(value, requested);
    if (parsed.username || parsed.password) return 'credentials-present';
    if (parsed.origin !== 'https://www.bls.gov') return 'off-origin';
    if (parsed.href === requested) return 'same-source';
    return ALLOWED_URL.test(parsed.href) ? 'other-allowlisted-source' : 'other-same-origin';
  } catch { return 'invalid'; }
}
function mediaType(value) {
  if (!value) return 'missing';
  const type = value.split(';', 1)[0].trim().toLowerCase();
  return ['text/html', 'text/plain', 'application/json'].includes(type) ? type : 'other';
}
function transportCode(error, timedOut) {
  if (timedOut) return 'TIMEOUT';
  const code = error?.cause?.code ?? error?.code;
  return ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
    'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT',
    'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT',
    'ERR_TLS_CERT_ALTNAME_INVALID'].includes(code) ? code : 'OTHER';
}
function responseDiagnostic(response, url, started) {
  const status = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
  const target = urlCategory(response.url, url);
  const location = urlCategory(response.headers.get('location'), url);
  const retry = response.headers.get('retry-after');
  const retryAfterSeconds = typeof retry === 'string' && /^\d{1,6}$/.test(retry) && Number(retry) <= 86400 ? Number(retry) : null;
  const failureClass = status === 401 || status === 403 ? 'access-denied'
    : status === 429 ? 'rate-limited'
    : status >= 300 && status < 400 ? 'redirect'
    : status >= 500 ? 'server-error'
    : status !== 200 ? 'http-error'
    : response.redirected || !['absent', 'same-source'].includes(target) ? 'unexpected-response-url' : null;
  return Object.freeze({ url, requestedAt: new Date(started).toISOString(), httpStatus: status,
    contentType: mediaType(response.headers.get('content-type')), redirectLocation: location,
    responseUrl: target, redirected: response.redirected === true, retryAfterSeconds,
    failureClass, transportCode: null });
}

/** Fixed official endpoints only; redirects, stale cache metadata and oversized bodies fail closed. */
export async function readOfficialBlsHtml(url, { fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 12000 } = {}) {
  if (!ALLOWED_URL.test(url)) hold('HOLD_SOURCE_UNAVAILABLE', 'Official source URL is outside the adapter allowlist.');
  const started = now();
  if (!Number.isFinite(started)) hold('HOLD_INVALID_CLOCK', 'Trusted fetch clock is unavailable.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(12000, Math.max(1, timeoutMs)));
  let diagnostic = null;
  let stage = 'request';
  try {
    const response = await fetchImpl(url, { method: 'GET', redirect: 'manual', signal: controller.signal,
      cache: 'no-store', headers: { Accept: 'text/html', 'Cache-Control': 'no-cache', Pragma: 'no-cache', 'User-Agent': BLS_CALENDAR_USER_AGENT } });
    stage = 'response';
    diagnostic = responseDiagnostic(response, url, started);
    if (response.status !== 200 || response.redirected || (response.url && response.url !== url)) hold('HOLD_SOURCE_UNAVAILABLE', 'Official source did not return a direct HTTP 200 response.');
    if (!/^text\/html(?:;|$)/i.test(response.headers.get('content-type') ?? '')) hold('HOLD_SOURCE_SCHEMA', 'Official source did not return HTML.');
    const age = response.headers.get('age');
    const dated = response.headers.get('date');
    if ((age !== null && (!/^\d+$/.test(age) || Number(age) * 1000 >= CALENDAR_MAX_AGE_MS))
        || (dated !== null && (!Number.isFinite(Date.parse(dated)) || started - Date.parse(dated) >= CALENDAR_MAX_AGE_MS || Date.parse(dated) - started > 60000))) {
      hold('HOLD_EVIDENCE_STALE', 'Official source cache metadata is stale or invalid.');
    }
    const declared = response.headers.get('content-length');
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_SOURCE_BYTES)) hold('HOLD_SOURCE_UNAVAILABLE', 'Official source exceeds the size bound.');
    if (!response.body?.getReader) hold('HOLD_SOURCE_UNAVAILABLE', 'A bounded streaming response is required.');
    stage = 'body';
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_SOURCE_BYTES) { await reader.cancel(); hold('HOLD_SOURCE_UNAVAILABLE', 'Official source exceeds the streaming size bound.'); }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    stage = 'decode';
    const html = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    if (!html.trim()) hold('HOLD_SOURCE_SCHEMA', 'Official source is empty.');
    return Object.freeze({ html, diagnostic, evidence: Object.freeze({ url, fetchedAt: new Date(started).toISOString(), sha256: digest(html), adapterVersion: BLS_ADAPTER_VERSION }) });
  } catch (error) {
    const failure = error instanceof CalendarHold ? error
      : new CalendarHold('HOLD_SOURCE_UNAVAILABLE', 'Official source fetch, decoding or bounded read failed.');
    failure.sourceDiagnostic = Object.freeze({
      ...(diagnostic ?? { url, requestedAt: new Date(started).toISOString(), httpStatus: null,
        contentType: 'missing', redirectLocation: 'absent', responseUrl: 'absent', redirected: false, retryAfterSeconds: null }),
      stage,
      failureClass: diagnostic?.failureClass ?? (stage === 'request' ? 'transport-error' : stage === 'decode' ? 'invalid-encoding' : 'source-contract'),
      transportCode: stage === 'request' || stage === 'body' ? transportCode(error, controller.signal.aborted) : null,
    });
    throw failure;
  } finally { clearTimeout(timer); controller.abort(); }
}
export async function loadBlsMonthlyCalendar(candidate, options) {
  const definition = definitionFor(candidate.series);
  const sources = [];
  try {
    const schedule = await readOfficialBlsHtml(`https://www.bls.gov/schedule/news_release/${definition.slug}.htm`, options);
    sources.push(schedule.evidence);
    const event = parseBlsMonthlyReleaseSchedule(schedule.html, candidate.referencePeriod, candidate.series);
    const monthlyUrl = `https://www.bls.gov/schedule/${event.eventDate.slice(0, 4)}/${event.eventDate.slice(5, 7)}_sched_list.htm`;
    const monthly = await readOfficialBlsHtml(monthlyUrl, options);
    sources.push(monthly.evidence);
    confirmBlsMonthlySchedule(monthly.html, event);
    const release = await readOfficialBlsHtml(`https://www.bls.gov/news.release/${definition.slug}.nr0.htm`, options);
    sources.push(release.evidence);
    return Object.freeze({ event, release: parseBlsMonthlyRelease(release.html, candidate.series), sources: Object.freeze(sources) });
  } catch (error) {
    if (error?.name === 'CalendarHold') error.calendarSources = Object.freeze(sources);
    throw error;
  }
}

export async function loadBlsCpiCalendar(candidate, options) {
  if (candidate.series !== 'CPI') hold('HOLD_IDENTITY_MISMATCH', 'The CPI compatibility entrypoint cannot verify another release.');
  return loadBlsMonthlyCalendar(candidate, options);
}
