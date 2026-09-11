import { blsMonthlyDefinition } from './publication-calendar-series.js';
import {
  CALENDAR_MAX_AGE_MS, CALENDAR_TIME_ZONE, CalendarHold, MONTHS, digest, hold,
  isCalendarDate, localReleaseInstant, referencePeriod,
} from './publication-calendar.js';

export const BLS_CPI_SCHEDULE = 'https://www.bls.gov/schedule/news_release/cpi.htm';
export const BLS_CPI_RELEASE = 'https://www.bls.gov/news.release/cpi.nr0.htm';
export const BLS_ADAPTER_VERSION = 'bls-national-monthly/html-v4';
// Truthful robot identity and public owner contact; never impersonate a browser.
export const BLS_CALENDAR_USER_AGENT = 'USDImpact-CalendarValidator/1.0 (+https://www.usd-impact.com/contact/)';
const MAX_SOURCE_BYTES = 512000;
const ALLOWED_URL = /^https:\/\/www\.bls\.gov\/(?:schedule\/news_release\/(?:cpi|ppi|empsit)\.htm|schedule\/20\d{2}\/(?:0[1-9]|1[0-2])_sched_list\.htm|news\.release\/(?:cpi|ppi|empsit)\.nr0\.htm)$/;
const WEEKDAYS = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);

function htmlSpace(character) {
  return character === ' ' || character === '\n' || character === '\r' || character === '\t' || character === '\f';
}
function asciiDigit(character) {
  return typeof character === 'string' && character.length === 1 && character >= '0' && character <= '9';
}
function asciiDigits(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  for (const character of value) if (!asciiDigit(character)) return false;
  return true;
}
function wordCharacter(character) {
  if (typeof character !== 'string' || character.length !== 1) return false;
  const code = character.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || character === '_';
}
function htmlNameBoundary(character) {
  return character === undefined || character === '>' || character === '/' || htmlSpace(character);
}

function tagEnd(html, start) {
  let quote = null;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '>') return index + 1;
  }
  hold('HOLD_SOURCE_SCHEMA', 'Malformed or ambiguous official markup.');
}

/** Locate non-data HTML regions without rewriting source bytes before parsing. */
function excludedHtmlRanges(html) {
  const lower = html.toLowerCase();
  const ranges = [];
  let cursor = 0;
  while (cursor < html.length) {
    const candidates = [
      ['comment', lower.indexOf('<!--', cursor)],
      ['script', lower.indexOf('<script', cursor)],
      ['style', lower.indexOf('<style', cursor)],
      ['template', lower.indexOf('<template', cursor)],
    ].filter(([, index]) => index >= 0).sort((left, right) => left[1] - right[1]);
    if (!candidates.length) break;
    const [kind, start] = candidates[0];
    if (kind === 'comment') {
      const end = lower.indexOf('-->', start + 4);
      if (end < 0) hold('HOLD_SOURCE_SCHEMA', 'Unterminated official HTML comment.');
      ranges.push([start, end + 3]);
      cursor = end + 3;
      continue;
    }
    const boundary = lower[start + kind.length + 1];
    if (boundary && !htmlNameBoundary(boundary)) {
      cursor = start + kind.length + 1;
      continue;
    }
    const openEnd = tagEnd(html, start);
    const closePrefix = `</${kind}`;
    const closeStart = lower.indexOf(closePrefix, openEnd);
    if (closeStart < 0) hold('HOLD_SOURCE_SCHEMA', `Unterminated official ${kind} block.`);
    const closeBoundary = lower[closeStart + closePrefix.length];
    if (closeBoundary && closeBoundary !== '>' && !htmlSpace(closeBoundary)) {
      cursor = closeStart + closePrefix.length;
      continue;
    }
    const closeEnd = tagEnd(html, closeStart);
    ranges.push([start, closeEnd]);
    cursor = closeEnd;
  }
  return ranges;
}

function outsideExcludedRanges(index, ranges) {
  for (const [start, end] of ranges) {
    if (index < start) return true;
    if (index < end) return false;
  }
  return true;
}

function textOutsideTags(html) {
  let output = '';
  let inTag = false;
  let quote = null;
  for (const character of html) {
    if (inTag) {
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '>') {
        inTag = false;
        output += ' ';
      }
    } else if (character === '<') {
      inTag = true;
    } else {
      output += character;
    }
  }
  if (inTag || quote) hold('HOLD_SOURCE_SCHEMA', 'Malformed or ambiguous official markup.');
  return output;
}

function visibleText(html) {
  const ranges = excludedHtmlRanges(html);
  let cursor = 0;
  let visible = '';
  for (const [start, end] of ranges) {
    visible += `${html.slice(cursor, start)} `;
    cursor = end;
  }
  visible += html.slice(cursor);
  return textOutsideTags(visible)
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, number) => {
      const point = number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
    })
    .replace(/&(nbsp|amp|quot|apos|ndash|mdash|rsquo|lt|gt);/gi, (_, name) => ({
      nbsp: ' ', amp: '&', quot: '"', apos: "'", ndash: '-', mdash: '-', rsquo: "'", lt: '<', gt: '>',
    })[name.toLowerCase()])
    .replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
}

function relevantTableTags(html, excluded) {
  const lower = html.toLowerCase();
  const tags = [];
  const names = ['table', 'tr', 'th', 'td'];
  let cursor = 0;
  while (cursor < html.length) {
    const start = lower.indexOf('<', cursor);
    if (start < 0) break;
    if (!outsideExcludedRanges(start, excluded)) {
      cursor = start + 1;
      continue;
    }
    let nameStart = start + 1;
    let closing = false;
    if (lower[nameStart] === '/') {
      closing = true;
      nameStart += 1;
    }
    const tag = names.find((name) => lower.startsWith(name, nameStart) && htmlNameBoundary(lower[nameStart + name.length]));
    if (!tag) {
      cursor = start + 1;
      continue;
    }
    const end = tagEnd(html, start);
    tags.push(Object.freeze({ start, end, closing, tag, raw: html.slice(start, end) }));
    if (tags.length > 7000) hold('HOLD_SOURCE_SCHEMA', 'Official table token count exceeds the parser complexity bound.');
    cursor = end;
  }
  return tags;
}

function selfClosingTag(raw) {
  let cursor = raw.length - 2;
  while (cursor > 0 && htmlSpace(raw[cursor])) cursor -= 1;
  return raw[cursor] === '/';
}

function plainClosingTag(raw, tag) {
  let cursor = 2 + tag.length;
  while (cursor < raw.length - 1 && htmlSpace(raw[cursor])) cursor += 1;
  return cursor === raw.length - 1 && raw[cursor] === '>';
}

function openingTagHasAttribute(raw, wanted) {
  const lower = raw.toLowerCase();
  let cursor = 1;
  while (cursor < lower.length - 1 && !htmlSpace(lower[cursor]) && lower[cursor] !== '>') cursor += 1;
  while (cursor < lower.length - 1) {
    while (cursor < lower.length - 1 && htmlSpace(lower[cursor])) cursor += 1;
    if (cursor >= lower.length - 1 || lower[cursor] === '/' || lower[cursor] === '>') return false;
    const start = cursor;
    while (cursor < lower.length - 1) {
      const character = lower[cursor];
      const code = character.charCodeAt(0);
      const nameCharacter = (code >= 48 && code <= 57) || (code >= 97 && code <= 122)
        || character === '_' || character === '-' || character === ':';
      if (!nameCharacter) break;
      cursor += 1;
    }
    if (cursor === start) return false;
    const name = lower.slice(start, cursor);
    while (cursor < lower.length - 1 && htmlSpace(lower[cursor])) cursor += 1;
    if (name === wanted) return lower[cursor] === '=';
    if (lower[cursor] === '=') {
      cursor += 1;
      while (cursor < lower.length - 1 && htmlSpace(lower[cursor])) cursor += 1;
      const quote = lower[cursor];
      if (quote === '"' || quote === "'") {
        cursor += 1;
        while (cursor < lower.length - 1 && lower[cursor] !== quote) cursor += 1;
        if (cursor >= lower.length - 1) return false;
        cursor += 1;
      } else {
        while (cursor < lower.length - 1 && !htmlSpace(lower[cursor]) && lower[cursor] !== '>') cursor += 1;
      }
    }
  }
  return false;
}

function tableWithHeaders(html, expected) {
  const excluded = excludedHtmlRanges(html);
  // BLS places the release table inside a layout table. Track table ownership;
  // flattening nested rows/cells would mix navigation with release metadata.
  const stack = [];
  const tables = [];
  const counts = { table: 0, tr: 0, cell: 0 };
  const malformed = () => hold('HOLD_SOURCE_SCHEMA', 'Malformed or ambiguous official table structure.');
  for (const token of relevantTableTags(html, excluded)) {
    const { closing, tag } = token;
    const parent = stack.at(-1);
    if (selfClosingTag(token.raw) || (closing && !plainClosingTag(token.raw, tag))) malformed();
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
      parent.cell = { tag, start: token.end, nested: false };
      if (openingTagHasAttribute(token.raw, 'rowspan') || openingTagHasAttribute(token.raw, 'colspan')) parent.spans = true;
    } else {
      if (!parent.cell || parent.cell.tag !== tag || !parent.row) malformed();
      parent.row.push(parent.cell.nested ? null : visibleText(html.slice(parent.cell.start, token.start)));
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
  if (match[1] && WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] !== match[1]) {
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

function exactMonthlyCalendarPeriod(text, definition) {
  if (!text.startsWith(definition.name)) return { family: false, period: null };
  const boundary = text[definition.name.length];
  if (boundary && wordCharacter(boundary)) return { family: false, period: null };
  const prefix = `${definition.name} for `;
  if (!text.startsWith(prefix)) return { family: true, period: null };
  try { return { family: true, period: referencePeriod(text.slice(prefix.length)) }; }
  catch { return { family: true, period: null }; }
}

export function confirmBlsMonthlySchedule(html, event) {
  const definition = definitionFor(event.series);
  const text = visibleText(html);
  if (!text.includes('All times on calendar are Eastern Time')) hold('HOLD_SOURCE_SCHEMA', 'Official monthly calendar timezone is missing.');
  const rows = tableWithHeaders(html, ['Date', 'Time', 'Release']);
  const matching = rows.filter((row) => {
    const parsed = exactMonthlyCalendarPeriod(row[2], definition);
    if (!parsed.family) return false;
    rejectScheduleNotice(row.join(' '));
    if (!parsed.period) hold('HOLD_IDENTITY_MISMATCH', 'Ambiguous release entry in the official monthly calendar.');
    return parsed.period === event.referencePeriod;
  });
  if (matching.length !== 1) hold('HOLD_SCHEDULE_CONFLICT', 'Monthly calendar does not confirm one matching event.');
  if (englishDate(matching[0][0]) !== event.eventDate || englishTime(matching[0][1]) !== event.releaseTime) {
    hold('HOLD_SCHEDULE_CONFLICT', 'Official schedule sources disagree on release timing.');
  }
}

function resultHeadings(text, definition) {
  const prefix = `${definition.resultHeading} - `;
  const matches = [];
  let cursor = 0;
  while (cursor < text.length) {
    const index = text.indexOf(prefix, cursor);
    if (index < 0) break;
    cursor = index + prefix.length;
    if (wordCharacter(text[index - 1])) continue;
    for (const month of MONTHS) {
      const token = month.toUpperCase();
      if (!text.startsWith(token, cursor) || text[cursor + token.length] !== ' ') continue;
      const yearStart = cursor + token.length + 1;
      const year = text.slice(yearStart, yearStart + 4);
      if (year.length !== 4 || !year.startsWith('20') || !asciiDigits(year) || wordCharacter(text[yearStart + 4])) continue;
      matches.push(Object.freeze({ index, periodText: `${token} ${year}`, length: prefix.length + token.length + 5 }));
      break;
    }
  }
  return matches;
}

function usdLCodeLength(text, cursor) {
  if (!text.startsWith('USDL-', cursor) && !text.startsWith('USDL ', cursor)) return 0;
  const candidate = text.slice(cursor, cursor + 12);
  if (candidate.length !== 12 || !asciiDigits(candidate.slice(5, 7)) || candidate[7] !== '-'
      || !asciiDigits(candidate.slice(8, 12))) return -1;
  return 12;
}

function embargoDateAt(text, cursor) {
  let weekday = null;
  for (const value of WEEKDAYS) {
    if (!text.startsWith(value, cursor)) continue;
    const after = cursor + value.length;
    if (text.startsWith(', ', after)) cursor = after + 2;
    else if (text[after] === ' ') cursor = after + 1;
    else continue;
    weekday = value;
    break;
  }
  if (!weekday) return null;
  let month = null;
  for (const value of MONTHS) {
    if (text.startsWith(value, cursor) && text[cursor + value.length] === ' ') {
      month = value;
      cursor += value.length + 1;
      break;
    }
  }
  if (!month) return null;
  const dayStart = cursor;
  while (cursor < text.length && cursor - dayStart < 2 && asciiDigit(text[cursor])) cursor += 1;
  const day = text.slice(dayStart, cursor);
  if (!day || text[cursor] !== ',' || text[cursor + 1] !== ' ') return null;
  cursor += 2;
  const year = text.slice(cursor, cursor + 4);
  if (year.length !== 4 || !year.startsWith('20') || !asciiDigits(year) || wordCharacter(text[cursor + 4])) return null;
  return Object.freeze({ dateText: `${weekday}, ${month} ${day}, ${year}`, end: cursor + 4 });
}

function embargoAt(text, prefix, index) {
  let cursor = index + prefix.length;
  if (text[cursor] !== ' ') return null;
  cursor += 1;
  const codeLength = usdLCodeLength(text, cursor);
  if (codeLength < 0) return null;
  if (codeLength > 0) {
    cursor += codeLength;
    if (text[cursor] !== ' ') return null;
    cursor += 1;
  }
  const colon = text.indexOf(':', cursor);
  if (colon < cursor + 1 || colon > cursor + 2) return null;
  const hour = text.slice(cursor, colon);
  if (!asciiDigits(hour) || Number(hour) < 1 || Number(hour) > 12) return null;
  const minute = text.slice(colon + 1, colon + 3);
  if (minute.length !== 2 || !asciiDigits(minute) || Number(minute) > 59 || text[colon + 3] !== ' ') return null;
  cursor = colon + 4;
  let meridiem = null;
  if (text.startsWith('a.m.', cursor)) meridiem = 'AM';
  else if (text.startsWith('p.m.', cursor)) meridiem = 'PM';
  if (!meridiem) return null;
  cursor += 4;
  if (!text.startsWith(' (ET) ', cursor)) return null;
  cursor += 6;
  const date = embargoDateAt(text, cursor);
  if (!date) return null;
  return Object.freeze({ index, timeText: `${hour}:${minute} ${meridiem}`, dateText: date.dateText, end: date.end });
}

function embargoTimestamps(text, definition) {
  const prefix = `Transmission of material in this ${definition.news ? 'news ' : ''}release is embargoed until`;
  const matches = [];
  let cursor = 0;
  while (cursor < text.length) {
    const index = text.indexOf(prefix, cursor);
    if (index < 0) break;
    cursor = index + prefix.length;
    const parsed = embargoAt(text, prefix, index);
    if (parsed) matches.push(parsed);
  }
  return matches;
}

export function parseBlsMonthlyRelease(html, series) {
  const definition = definitionFor(series);
  const text = visibleText(html);
  const titles = resultHeadings(text, definition);
  if (titles.length !== 1) hold('HOLD_OUTCOME_NOT_RELEASED', 'A unique matching national results heading is required.');
  const timestamps = embargoTimestamps(text, definition);
  if (timestamps.length !== 1) hold('HOLD_OUTCOME_NOT_RELEASED', 'A unique official release timestamp is required.');
  const stamp = timestamps[0];
  const date = englishDate(stamp.dateText);
  const time = englishTime(stamp.timeText);
  if (stamp.index > titles[0].index) hold('HOLD_OUTCOME_NOT_RELEASED', 'The embargo timestamp must precede the results heading.');
  const resultText = text.slice(titles[0].index + titles[0].length, titles[0].index + titles[0].length + 2000);
  if (!resultText.includes(definition.resultLead)
      || !resultText.includes('Bureau of Labor Statistics reported today')
      || !/\b(increased|decreased|declined|rose|fell|unchanged)\b/.test(resultText)) {
    hold('HOLD_OUTCOME_NOT_RELEASED', 'The official artifact does not contain a recognizable matching results statement.');
  }
  return Object.freeze({ referencePeriod: referencePeriod(titles[0].periodText), releaseAt: localReleaseInstant(date, time) });
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