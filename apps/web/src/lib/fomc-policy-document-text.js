import { createHash } from 'node:crypto';
import { types } from 'node:util';

// Supplied article text only. No retrieval, authenticity, meeting or release approval.
export const FOMC_TEXT_SCHEMA = 'fomc-policy-document-text/v1';
export const FOMC_TEXT_PAIR_SCHEMA = 'fomc-policy-document-text-pair/v1';
export const FOMC_TEXT_MAX_BYTES = 131072;
const FIELDS = ['schema', 'documentRole', 'sourceUrl', 'articleText'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DATE = `(?:${MONTHS.join('|')}) [1-9][0-9]?, 20[0-9]{2}`;
const NUMBER = '(?:[0-9]{1,3}(?:\\.[0-9]{1,4})?|(?:[0-9]{1,3}[- ])?[0-9]{1,2}/[0-9]{1,2}|[0-9]{0,3}[\u00bc\u00bd\u00be])';
const NO_AUTHORITY = Object.freeze({
  sourceAuthenticityVerified: false, meetingAssociationVerified: false,
  rawPageCompatibilityCertified: false, documentCompletenessVerified: false,
  freshSourceVerificationPerformed: false, calendarLeaseIssued: false,
  publicationAuthorized: false, enforcementActive: false,
});
export class FomcTextHold extends Error {
  constructor(code) { super(code); this.name = 'FomcTextHold'; this.code = code; }
}
function need(condition, code) { if (!condition) throw new FomcTextHold(code); }
function record(value, fields) {
  need(value && typeof value === 'object' && !types.isProxy(value) && !Array.isArray(value), 'HOLD_FOMC_TEXT_SHAPE');
  const prototype = Object.getPrototypeOf(value);
  need(prototype === Object.prototype || prototype === null, 'HOLD_FOMC_TEXT_SHAPE');
  const keys = Reflect.ownKeys(value);
  need(keys.length === fields.length && keys.every((key) => typeof key === 'string' && fields.includes(key)), 'HOLD_FOMC_TEXT_SHAPE');
  const result = Object.create(null);
  for (const key of fields) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    need(property && property.enumerable && Object.hasOwn(property, 'value'), 'HOLD_FOMC_TEXT_SHAPE');
    result[key] = property.value;
  }
  return result;
}
function freeze(value) {
  if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
}
function dateOf(value) {
  const match = value.match(new RegExp(`^(${MONTHS.join('|')}) ([1-9][0-9]?), (20[0-9]{2})$`));
  need(match, 'HOLD_FOMC_TEXT_DATE');
  const result = `${match[3]}-${String(MONTHS.indexOf(match[1]) + 1).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  const milliseconds = Date.parse(`${result}T00:00:00.000Z`);
  need(Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 10) === result, 'HOLD_FOMC_TEXT_DATE');
  return result;
}
// Every normalized character maps back to exact UTF-16 input boundaries.
function mapped(text, start, end) {
  let value = ''; const starts = [], ends = [];
  for (let index = start; index < end; index += 1) {
    let character = text[index];
    if (/[ \t\r\n\u00a0\u202f]/.test(character)) character = ' ';
    else if (/[\u2010\u2011\u2013]/.test(character)) character = '-';
    else if (/[\u2018\u2019]/.test(character)) character = "'";
    else if (/[\u201c\u201d]/.test(character)) character = '"';
    if (character === ' ' && (!value.length || value.endsWith(' '))) {
      if (value.length) ends[ends.length - 1] = index + 1;
      continue;
    }
    value += character; starts.push(index); ends.push(index + 1);
  }
  if (value.endsWith(' ')) { value = value.slice(0, -1); starts.pop(); ends.pop(); }
  return { value, starts, ends, start, end };
}
function span(text, block, range = [0, block.value.length]) {
  need(range && range[0] >= 0 && range[1] > range[0], 'HOLD_FOMC_TEXT_GRAMMAR');
  const start = block.starts[range[0]], end = block.ends[range[1] - 1];
  return { start, end, unit: 'UTF-16-code-units', text: text.slice(start, end) };
}
function inventory(text) {
  need(typeof text === 'string' && text.length > 0 && text.length <= FOMC_TEXT_MAX_BYTES
    && text.isWellFormed() && Buffer.byteLength(text, 'utf8') <= FOMC_TEXT_MAX_BYTES, 'HOLD_FOMC_TEXT_INPUT');
  need(!/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/.test(text)
    && !/\r(?!\n)/.test(text)
    && !/(?:\.{3}|\u2026|\[\s*(?:truncated|omitted|excerpt)\b|&(?:#|[A-Za-z]+;))/i.test(text), 'HOLD_FOMC_TEXT_INPUT');
  const lines = [], blocks = []; let blockStart = null, blockEnd = null;
  for (const match of text.matchAll(/[^\r\n]*(?:\r?\n|$)/g)) {
    if (!match[0]) continue;
    const raw = match[0].replace(/\r?\n$/, '');
    need(raw.length <= 4096, 'HOLD_FOMC_TEXT_INPUT');
    const line = mapped(text, match.index, match.index + raw.length);
    if (line.value) {
      lines.push(line); if (blockStart === null) blockStart = match.index;
      blockEnd = match.index + raw.length;
    } else if (blockStart !== null) {
      blocks.push(mapped(text, blockStart, blockEnd)); blockStart = null;
    }
  }
  if (blockStart !== null) blocks.push(mapped(text, blockStart, blockEnd));
  need(lines.length <= 1024 && blocks.length <= 256 && blocks.every((block) => block.value.length <= 8192), 'HOLD_FOMC_TEXT_INPUT');
  return { lines, blocks };
}
function one(values, code = 'HOLD_FOMC_TEXT_AMBIGUOUS') { need(values.length === 1, code); return values[0]; }
function percentBasisPoints(token) {
  const fractions = { '\u00bc': '1/4', '\u00bd': '1/2', '\u00be': '3/4' };
  token = token.replace(/([0-9]*)([\u00bc\u00bd\u00be])$/, (_, whole, fraction) => `${whole ? `${whole} ` : ''}${fractions[fraction]}`);
  let result;
  const decimal = token.match(/^(0|[1-9][0-9]{0,2})(?:\.([0-9]{1,2}))?$/);
  if (decimal) result = Number(decimal[1]) * 100 + Number((decimal[2] ?? '').padEnd(2, '0'));
  else {
    const fraction = token.match(/^(?:(0|[1-9][0-9]{0,2})[- ])?([1-3])\/([24])$/);
    need(fraction && Number(fraction[2]) < Number(fraction[3]), 'HOLD_FOMC_TEXT_NUMBER');
    result = Number(fraction[1] ?? 0) * 100 + Number(fraction[2]) * 100 / Number(fraction[3]);
  }
  need(Number.isSafeInteger(result) && result >= 0 && result <= 10000, 'HOLD_FOMC_TEXT_NUMBER');
  return result;
}
function rangeOf(groups) {
  const lowerBasisPoints = percentBasisPoints(groups.lower), upperBasisPoints = percentBasisPoints(groups.upper);
  need(lowerBasisPoints < upperBasisPoints, 'HOLD_FOMC_TEXT_NUMBER');
  return { lowerBasisPoints, upperBasisPoints, unit: 'basis-points' };
}
function printedClock(line, issueDate, text) {
  if (!line) return null;
  const match = line.value.match(/^For release at 2:00 p\.m\. (EST|EDT)$/);
  need(match, 'HOLD_FOMC_TEXT_CLOCK');
  const releaseAt = `${issueDate}T${match[1] === 'EST' ? '19' : '18'}:00:00.000Z`;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(Date.parse(releaseAt)).map(({ type, value }) => [type, value]));
    need(`${parts.year}-${parts.month}-${parts.day}` === issueDate && parts.hour === '14' && parts.minute === '00', 'HOLD_FOMC_TEXT_CLOCK');
  } catch { throw new FomcTextHold('HOLD_FOMC_TEXT_CLOCK'); }
  return { localTime: '14:00', printedZone: match[1], timeZone: 'America/New_York', releaseAt, evidence: span(text, line) };
}

/** Parse supported supplied text, never claim an authenticated or complete official page. */
export function parseFomcPolicyDocumentText(value) {
  const input = record(value, FIELDS);
  need(input.schema === FOMC_TEXT_SCHEMA && ['statement', 'implementation-note'].includes(input.documentRole), 'HOLD_FOMC_TEXT_SHAPE');
  need(typeof input.sourceUrl === 'string' && input.sourceUrl.length <= 2048, 'HOLD_FOMC_TEXT_URL');
  const url = input.sourceUrl.match(/^https:\/\/www\.federalreserve\.gov\/newsevents\/pressreleases\/monetary(20[0-9]{6})(a1|a)\.htm$/);
  need(url && url[2] === (input.documentRole === 'statement' ? 'a' : 'a1'), 'HOLD_FOMC_TEXT_URL');
  const text = input.articleText, { lines, blocks } = inventory(text);
  const titles = lines.filter((line) => /^(?:Federal Reserve issues FOMC statement|Implementation Note issued )/.test(line.value));
  const title = one(titles, 'HOLD_FOMC_TEXT_ROLE');
  const allText = lines.map((line) => line.value).join(' ');
  need([...allText.matchAll(/Federal Reserve issues FOMC statement|Implementation Note issued/g)].length === 1, 'HOLD_FOMC_TEXT_ROLE');
  need(!lines.some((line) => /^(?:Minutes of|Transcript of|Summary of Economic Projections|Press Conference|FOMC Meeting Minutes)\b/i.test(line.value)), 'HOLD_FOMC_TEXT_ROLE');
  need(lines.indexOf(title) <= 1, 'HOLD_FOMC_TEXT_ROLE');
  let issueDate;
  if (input.documentRole === 'statement') {
    need(title.value === 'Federal Reserve issues FOMC statement' && !lines.some((line) => line.value === 'Decisions Regarding Monetary Policy Implementation'), 'HOLD_FOMC_TEXT_ROLE');
    const dateLine = one(lines.filter((line) => new RegExp(`^${DATE}$`).test(line.value)), 'HOLD_FOMC_TEXT_DATE');
    need(lines.indexOf(dateLine) <= 2, 'HOLD_FOMC_TEXT_DATE');
    issueDate = dateOf(dateLine.value);
  } else {
    need(!/\bthe Committee decided to\b|Voting for the (?:monetary )?policy action/i.test(allText), 'HOLD_FOMC_TEXT_ROLE');
    const titleMatch = title.value.match(new RegExp(`^Implementation Note issued (${DATE})$`));
    need(titleMatch, 'HOLD_FOMC_TEXT_ROLE'); issueDate = dateOf(titleMatch[1]);
    const dateLines = lines.filter((line) => new RegExp(`^${DATE}$`).test(line.value));
    need(dateLines.length <= 1 && dateLines.every((line) => lines.indexOf(line) <= 2 && dateOf(line.value) === issueDate), 'HOLD_FOMC_TEXT_DATE');
    one(lines.filter((line) => line.value === 'Decisions Regarding Monetary Policy Implementation'), 'HOLD_FOMC_TEXT_ROLE');
  }
  need(issueDate.replaceAll('-', '') === url[1], 'HOLD_FOMC_TEXT_DATE');
  const clockLines = lines.filter((line) => /^For (?:release|immediate release)\b/.test(line.value));
  need(clockLines.length <= 1 && (input.documentRole !== 'statement' || clockLines.length === 1), 'HOLD_FOMC_TEXT_CLOCK');
  need(!clockLines.length || lines.indexOf(clockLines[0]) <= 3, 'HOLD_FOMC_TEXT_CLOCK');
  const releaseClock = printedClock(clockLines[0], issueDate, text);
  const evidence = { title: span(text, title), change: null, changeUnit: null };
  const issueLine = lines.find((line) => line.value === MONTHS[Number(issueDate.slice(5, 7)) - 1] + ` ${Number(issueDate.slice(8))}, ${issueDate.slice(0, 4)}`);
  evidence.issueDate = span(text, issueLine ?? title);
  const updates = [];
  for (const line of lines.filter((item) => /^(?:Last Update:|Updated\b|Revised\b|This information (?:will|may) be updated)/i.test(item.value))) {
    const update = line.value.match(new RegExp(`^Last Update: (${DATE})$`));
    if (update) {
      const date = dateOf(update[1]); need(date >= issueDate, 'HOLD_FOMC_TEXT_VERSION');
      updates.push({ kind: 'printed-update-date', date, evidence: span(text, line) });
    } else {
      need(/^This information (?:will|may) be updated as appropriate\.$/.test(line.value), 'HOLD_FOMC_TEXT_VERSION');
      updates.push({ kind: 'update-advisory', date: null, evidence: span(text, line) });
    }
  }
  need(updates.length <= 2 && new Set(updates.map((item) => item.kind)).size === updates.length, 'HOLD_FOMC_TEXT_VERSION');
  let action = null, changeBasisPoints = null, changeStatedNumerically = false;
  let associatedStatementDate = null, directiveEffectiveDate = null, targetRange;
  if (input.documentRole === 'statement') {
    const vote = one(blocks.filter((block) => /^Voting for the (?:monetary )?policy action (?:was|were)\b/.test(block.value)));
    const adopted = one(blocks.filter((block) => /\bthe Committee decided to\b/i.test(block.value)));
    need(adopted.start < vote.start, 'HOLD_FOMC_TEXT_GRAMMAR');
    const beforeVote = blocks.filter((block) => block.start < vote.start).map((block) => block.value).join(' ');
    need([...beforeVote.matchAll(/\btarget range for the federal funds rate\b/g)].length === 1, 'HOLD_FOMC_TEXT_AMBIGUOUS');
    const prefix = '(?:^|[.!?] )(?:In support of its goals(?: and in light of the shift in the balance of risks)?, the|The) Committee decided to ';
    const pattern = `${prefix}(?<action>lower|raise|maintain) the target range for the federal funds rate (?:(?:by (?<change>${NUMBER}) (?<changeUnit>percentage points?|basis points) )?to|at) (?<lower>${NUMBER}) to (?<upper>${NUMBER}) percent\\.(?= |$)`;
    const matches = [...adopted.value.matchAll(new RegExp(pattern, 'gd'))];
    const match = one(matches, 'HOLD_FOMC_TEXT_GRAMMAR');
    const decisionText = match[0].replace(/^[.!?] /, '');
    action = match.groups.action;
    need(action === 'maintain' ? / rate at /.test(decisionText) && !match.groups.change : / rate (?:by|to) /.test(decisionText), 'HOLD_FOMC_TEXT_GRAMMAR');
    targetRange = rangeOf(match.groups);
    if (action === 'maintain') changeBasisPoints = 0;
    else if (match.groups.change !== undefined) {
      let amount;
      if (match.groups.changeUnit === 'basis points') {
        need(/^[1-9][0-9]{0,3}$/.test(match.groups.change), 'HOLD_FOMC_TEXT_NUMBER'); amount = Number(match.groups.change);
      } else amount = percentBasisPoints(match.groups.change);
      need(amount > 0 && amount <= 10000, 'HOLD_FOMC_TEXT_NUMBER');
      changeBasisPoints = (action === 'lower' ? -1 : 1) * amount; changeStatedNumerically = true;
      evidence.change = span(text, adopted, match.indices.groups.change);
      evidence.changeUnit = span(text, adopted, match.indices.groups.changeUnit);
    }
    evidence.targetClause = span(text, adopted, match.indices[0]);
    evidence.lower = span(text, adopted, match.indices.groups.lower);
    evidence.upper = span(text, adopted, match.indices.groups.upper);
  } else {
    const association = one(blocks.filter((block) => /monetary policy stance announced by the Federal Open Market Committee/.test(block.value)));
    const associationMatch = association.value.match(new RegExp(`^The Federal Reserve has made the following decisions to implement the monetary policy stance announced by the Federal Open Market Committee in its statement on (?<date>${DATE}):$`, 'd'));
    need(associationMatch && lines.find((line) => line.value === 'Decisions Regarding Monetary Policy Implementation').start < association.start, 'HOLD_FOMC_TEXT_GRAMMAR'); associatedStatementDate = dateOf(associationMatch.groups.date);
    need(associatedStatementDate === issueDate, 'HOLD_FOMC_TEXT_DATE');
    const directive = one(blocks.filter((block) => /in accordance with the following domestic policy directive:$/.test(block.value)));
    need(/^As part of its policy decision, the Federal Open Market Committee voted to authorize and direct the Open Market Desk at the Federal Reserve Bank of New York, until instructed otherwise, to execute transactions in the System Open Market Account in accordance with the following domestic policy directive:$/.test(directive.value), 'HOLD_FOMC_TEXT_GRAMMAR');
    const effective = one(blocks.filter((block) => /^"?Effective /.test(block.value)));
    const effectiveMatch = effective.value.match(new RegExp(`^"?Effective (?<date>${DATE}), the Federal Open Market Committee directs the Desk to:$`, 'd'));
    need(effectiveMatch, 'HOLD_FOMC_TEXT_GRAMMAR'); directiveEffectiveDate = dateOf(effectiveMatch.groups.date);
    need(directiveEffectiveDate >= issueDate, 'HOLD_FOMC_TEXT_DATE');
    need([...blocks.map((block) => block.value).join(' ').matchAll(/\btarget range\b/gi)].length === 1, 'HOLD_FOMC_TEXT_AMBIGUOUS');
    const target = one(blocks.filter((block) => /federal funds rate in a target range/.test(block.value)));
    const targetMatch = target.value.match(new RegExp(`^(?:[-\\u2022] )?Undertake open market operations as necessary to maintain the federal funds rate in a target range of (?<lower>${NUMBER}) to (?<upper>${NUMBER}) percent\\.$`, 'd'));
    need(targetMatch && association.start < directive.start && directive.start < effective.start && effective.start < target.start, 'HOLD_FOMC_TEXT_GRAMMAR');
    targetRange = rangeOf(targetMatch.groups);
    evidence.association = span(text, association, associationMatch.indices.groups.date);
    evidence.effectiveDate = span(text, effective, effectiveMatch.indices.groups.date);
    evidence.targetClause = span(text, target); evidence.lower = span(text, target, targetMatch.indices.groups.lower);
    evidence.upper = span(text, target, targetMatch.indices.groups.upper);
  }
  return freeze({
    schema: FOMC_TEXT_SCHEMA, decision: 'DOCUMENT_TEXT_PARSED_NOT_VERIFIED',
    documentRole: input.documentRole, assertedSourceUrl: input.sourceUrl, representation: 'supplied-article-text',
    documentTextSha256: createHash('sha256').update(text, 'utf8').digest('hex'),
    issueDate, associatedStatementDate, directiveEffectiveDate, releaseClock,
    action, changeBasisPoints, changeStatedNumerically, targetRange, evidence, updateNotices: updates, ...NO_AUTHORITY,
  });
}

/** Always reparse the exact requests; supplied parsed/verified objects are not evidence. */
export function compareFomcPolicyDocumentTexts(value) {
  const pair = record(value, ['schema', 'statement', 'implementation']);
  need(pair.schema === FOMC_TEXT_PAIR_SCHEMA, 'HOLD_FOMC_TEXT_SHAPE');
  const statement = parseFomcPolicyDocumentText(pair.statement);
  const implementation = parseFomcPolicyDocumentText(pair.implementation);
  need(statement.documentRole === 'statement' && implementation.documentRole === 'implementation-note', 'HOLD_FOMC_TEXT_ROLE');
  need(statement.issueDate === implementation.issueDate && statement.issueDate === implementation.associatedStatementDate
    && statement.targetRange.lowerBasisPoints === implementation.targetRange.lowerBasisPoints
    && statement.targetRange.upperBasisPoints === implementation.targetRange.upperBasisPoints, 'HOLD_FOMC_TEXT_PAIR_CONFLICT');
  if (implementation.releaseClock) need(statement.releaseClock.releaseAt === implementation.releaseClock.releaseAt, 'HOLD_FOMC_TEXT_PAIR_CONFLICT');
  return freeze({ schema: FOMC_TEXT_PAIR_SCHEMA, decision: 'DOCUMENT_TEXT_PAIR_CONSISTENT_NOT_VERIFIED', statement, implementation, ...NO_AUTHORITY });
}
