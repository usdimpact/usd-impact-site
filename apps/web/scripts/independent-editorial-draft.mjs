// Draft-only and offline. No HTTP, external provider, Score, public route or publication.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

export const CONTRACT_VERSION = 'independent-editorial-draft-v1';
export const SERIES = 'independent_macro_education';
const here = path.dirname(fileURLToPath(import.meta.url));
export const NEWS_DIR = path.resolve(here, '../src/content/news');
export const DRAFT_DIR = path.resolve(here, '../../../docs/operations/independent-editorial');
const dailyUrl = (date) => '/news/' + date;
const EDITORIAL_FIELDS = ['title', 'summary', 'sections', 'whatToWatch', 'complianceNote'];
const WEEKLY_FIELDS = [
  'contractVersion', 'series', 'kind', 'status', 'releaseAuthorized',
  'rightsStatus', 'marketDataLicenseBudgetUSD', 'periodStart', 'periodEnd',
  'sourceEditions', 'claims', 'editorial'
];
const MONTHLY_FIELDS = [
  'contractVersion', 'series', 'kind', 'status', 'releaseAuthorized',
  'rightsStatus', 'marketDataLicenseBudgetUSD', 'sourceRule',
  'sourceWeeklyReports', 'editorial'
];
const CLAIM_FIELDS = [
  'id', 'sourceEditionDate', 'sourceId', 'sourceUrl', 'claimCategory',
  'eventDate', 'observationPeriod', 'assertion', 'marketReactionAsserted',
  'rightsStatus', 'sourceReleaseAt', 'postReleaseEditorialReceipt'
];
const COMMENT_RECEIPT = /^https:\/\/github\.com\/usdimpact\/usd-impact-site\/pull\/[1-9]\d*#issuecomment-[1-9]\d*$/;

function exactFields(value, fields, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), label + ' must be an object');
  assert.deepEqual(Object.keys(value).sort(), [...fields].sort(), label + ' has missing or unexpected fields');
}
function day(value) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/, 'date must use YYYY-MM-DD');
  const parsed = new Date(value + 'T12:00:00.000Z');
  assert.ok(!Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value, 'invalid calendar date');
  return parsed;
}
function plusDays(date, days) {
  const d = day(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function assertDraftOnly(record, kind, fields) {
  exactFields(record, fields, kind);
  assert.equal(record.contractVersion, CONTRACT_VERSION, 'versioned independent draft only');
  assert.equal(record.series, SERIES, 'must never consume original Score series');
  assert.equal(record.kind, kind, 'incorrect report kind');
  assert.equal(record.status, 'draft', 'this version forbids published or ready status');
  assert.equal(record.releaseAuthorized, false, 'this version never authorizes release');
  assert.equal(record.rightsStatus, 'pending_independent_source_review', 'source rights remain pending');
  assert.equal(record.marketDataLicenseBudgetUSD, 0, 'no license budget or vendor access');
}
function validateEditorial(value) {
  exactFields(value, EDITORIAL_FIELDS, 'editorial');
  for (const key of ['title', 'summary', 'complianceNote']) {
    assert.ok(typeof value[key] === 'string' && value[key].trim().length >= 12, 'editorial ' + key + ' must be substantive');
  }
  assert.ok(/educational/i.test(value.complianceNote) && /not investment/i.test(value.complianceNote), 'educational compliance warning is required');
  assert.ok(Array.isArray(value.sections) && value.sections.length >= 3, 'editorial sections missing');
  for (const section of value.sections) {
    exactFields(section, ['heading', 'text'], 'editorial section');
    assert.ok(typeof section.heading === 'string' && section.heading.length > 3);
    assert.ok(typeof section.text === 'string' && section.text.length > 15);
  }
  assert.ok(Array.isArray(value.whatToWatch) && value.whatToWatch.length > 0);
  for (const watch of value.whatToWatch) assert.ok(typeof watch === 'string' && watch.length > 8);
}
export function gitBlobSha(content) {
  const buffer = Buffer.from(content, 'utf8');
  return createHash('sha1').update('blob ' + buffer.length + '\0').update(buffer).digest('hex');
}
export function readPublishedDaily(date, newsDir = NEWS_DIR) {
  day(date); // A canonical date is the only supported filename; prevents path traversal.
  const source = fs.readFileSync(path.join(newsDir, date + '.md'), 'utf8');
  const parts = source.split(/^---\s*$/m);
  assert.ok(parts.length >= 3, 'Daily must contain frontmatter');
  const metadata = yaml.load(parts[1]);
  assert.ok(metadata && typeof metadata === 'object', 'invalid Daily metadata');
  assert.equal(metadata.date, date, 'Daily date mismatch');
  assert.equal(metadata.slug, dailyUrl(date), 'Daily slug mismatch');
  assert.equal(metadata.status, 'published', 'only already published Daily files are eligible');
  assert.ok(Array.isArray(metadata.sources) && Array.isArray(metadata.highlights), 'Daily source evidence missing');
  return { metadata, blobSha: gitBlobSha(source) };
}
export function validateWeeklyDraft(record, options = {}) {
  assertDraftOnly(record, 'independent_weekly', WEEKLY_FIELDS);
  const start = day(record.periodStart);
  const end = day(record.periodEnd);
  assert.equal(start.getUTCDay(), 1, 'weekly period starts on Monday');
  assert.equal(end.getUTCDay(), 5, 'weekly period ends on Friday');
  assert.equal(record.periodEnd, plusDays(record.periodStart, 4), 'weekly period is one Monday-Friday');
  assert.ok(Array.isArray(record.sourceEditions) && record.sourceEditions.length === 5, 'exactly five weekday Daily sources required for this draft pilot');
  const evidence = new Map();
  for (let i = 0; i < 5; i += 1) {
    const entry = record.sourceEditions[i];
    exactFields(entry, ['date', 'gitBlobSha'], 'Daily source reference');
    const date = plusDays(record.periodStart, i);
    assert.equal(entry.date, date, 'source Dailies must be complete and chronological');
    assert.match(entry.gitBlobSha, /^[a-f0-9]{40}$/);
    const verified = readPublishedDaily(date, options.newsDir ?? NEWS_DIR);
    assert.equal(entry.gitBlobSha, verified.blobSha, 'Daily content hash changed or is unreviewed: ' + date);
    evidence.set(date, verified.metadata);
  }
  assert.ok(Array.isArray(record.claims) && record.claims.length >= 3 && record.claims.length <= 12, '3-12 evidence-linked claims required');
  const ids = new Set();
  for (const claim of record.claims) {
    exactFields(claim, CLAIM_FIELDS, 'claim');
    assert.match(claim.id, /^[a-z0-9][a-z0-9-]{2,60}$/);
    assert.ok(!ids.has(claim.id), 'duplicate claim id');
    ids.add(claim.id);
    assert.ok(typeof claim.assertion === 'string' && claim.assertion.trim().length > 15 && claim.assertion.length <= 550);
    assert.ok(typeof claim.observationPeriod === 'string' && claim.observationPeriod.length > 3);
    assert.ok(['calendar_preview', 'official_outcome', 'context'].includes(claim.claimCategory));
    assert.equal(claim.marketReactionAsserted, false, 'no unsupported market reaction assertions');
    assert.equal(claim.rightsStatus, 'pending_independent_source_review', 'Daily verification is not a reuse license');
    const meta = evidence.get(claim.sourceEditionDate);
    assert.ok(meta, 'claim must refer to an included, pinned published Daily');
    day(claim.eventDate);
    if (claim.claimCategory === 'official_outcome') {
      assert.ok(claim.eventDate <= claim.sourceEditionDate, 'future events are not outcomes');
    }
    const source = meta.sources.find((s) => s.id === claim.sourceId);
    assert.ok(source && source.sourceType === 'primary', 'claim must cite a primary source ID in the correct Daily');
    assert.equal(claim.sourceUrl, source.url, 'citation URL must match the published Daily source');
    assert.equal(new URL(claim.sourceUrl).protocol, 'https:', 'official source URL must use HTTPS');
    assert.ok(meta.highlights.some((h) => ['verified-primary', 'verified-multiple'].includes(h.verification) && h.sourceIds.includes(claim.sourceId)),
      'claim must be covered by a verified Daily highlight');
    if (claim.sourceReleaseAt !== null) {
      assert.ok(typeof claim.sourceReleaseAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(claim.sourceReleaseAt));
      const release = new Date(claim.sourceReleaseAt);
      assert.ok(!Number.isNaN(release.valueOf()) && claim.sourceReleaseAt.endsWith('Z'));
      assert.equal(release.toISOString().slice(0, 10), source.publishedAt,
        'release date must agree with cited Daily source');
      if (release.valueOf() > new Date(meta.generatedAt).valueOf()) {
        assert.match(claim.postReleaseEditorialReceipt || '', COMMENT_RECEIPT,
          'post-release claim needs traceable later editorial-review receipt');
      }
    }
    if (claim.postReleaseEditorialReceipt !== null) {
      assert.match(claim.postReleaseEditorialReceipt, COMMENT_RECEIPT);
    }
  }
  validateEditorial(record.editorial);
  return {
    sourceEdtions: evidence.size, claimCount: ids.size,
    draftOnly: true, sourceRightsCleared: false, publishReady: false
  };
}
export function inspectIndependentMonthlyWindow(sources) {
  assert.ok(Array.isArray(sources) && sources.length <= 4, 'no more than four independently published Weeklies');
  const dates = [];
  for (const source of sources) {
    exactFields(source, ['series', 'kind', 'periodEnd', 'publicationStatus', 'publicationReceipt'], 'independent Weekly source');
    assert.equal(source.series, SERIES, 'legacy Score Weeklies are not independent sources');
    assert.equal(source.kind, 'independent_weekly', 'legacy Score Weeklies cannot count');
    assert.equal(source.publicationStatus, 'published', 'monthly requires actually published independent Weeklies');
    assert.match(source.publicationReceipt, COMMENT_RECEIPT, 'source publication requires traceable receipt metadata');
    assert.equal(day(source.periodEnd).getUTCDay(), 5, 'source must end Friday');
    dates.push(source.periodEnd);
  }
  const unique = new Set(dates);
  assert.equal(unique.size, dates.length, 'duplicate independent Weekly source');
  const consecutive = dates.length === 4 && dates.every((date, i) => i === 0 || date === plusDays(dates[i - 1], 7));
  return { sourceCount: dates.length, fourConsecutive: consecutive, draftOnly: true, publishReady: false };
}
// Draft-only structural check. The caller must provide a complete, immutable inventory
// from a trusted future publisher. A boolean attestation or a GitHub-looking receipt
// cannot independently prove completeness or authenticity; NEVER authorizes release.
export function inspectFirstFourIndependentPublishedWeeklies(selectedSources, options = {}) {
  const structural = inspectIndependentMonthlyWindow(selectedSources);
  assert.equal(structural.fourConsecutive, true, 'exactly four consecutive published independent Weeklies required');
  assert.equal(options.completeInventoryAttested, true, 'complete independent Weekly inventory must be explicitly attested');
  assert.ok(Array.isArray(options.fullPublishedIndependentWeeklies), 'complete published independent Weekly inventory required');
  assert.ok(Array.isArray(options.publishedIndependentMonthlyHistory), 'published independent Monthly history required');

  const available = [...options.fullPublishedIndependentWeeklies];
  const seen = new Set();
  for (const week of available) {
    inspectIndependentMonthlyWindow([week]); // strict fields, independent family, published status, Friday and receipt
    assert.ok(!seen.has(week.periodEnd), 'duplicate independent Weekly in supplied full inventory');
    seen.add(week.periodEnd);
  }
  available.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));

  const priorEnds = new Set();
  const consumed = new Set();
  for (const prior of options.publishedIndependentMonthlyHistory) {
    exactFields(prior,
      ['series', 'kind', 'periodEnd', 'publicationStatus', 'publicationReceipt', 'sourceWeeklyPeriodEnds'],
      'previous independent Monthly history');
    assert.equal(prior.series, SERIES, 'prior Monthlys must belong to the same independent series');
    assert.equal(prior.kind, 'independent_monthly', 'legacy Score Monthlys are not independent history');
    assert.equal(prior.publicationStatus, 'published', 'only published previous independent Monthlys count');
    assert.match(prior.publicationReceipt, COMMENT_RECEIPT, 'prior Monthly requires a traceable receipt string');
    assert.equal(day(prior.periodEnd).getUTCDay(), 5, 'prior independent Monthly must end on Friday');
    assert.ok(!priorEnds.has(prior.periodEnd), 'duplicate historical independent Monthly period');
    priorEnds.add(prior.periodEnd);
    assert.ok(Array.isArray(prior.sourceWeeklyPeriodEnds) && prior.sourceWeeklyPeriodEnds.length === 4,
      'prior independent Monthly must identify its four sources');
    const historic = prior.sourceWeeklyPeriodEnds;
    assert.ok(historic.every((date, i) => {
      day(date);
      return i === 0 || date === plusDays(historic[i - 1], 7);
    }), 'prior independent Monthly sources must be consecutive');
    assert.equal(historic[3], prior.periodEnd, 'prior Monthly must end with fourth source');
    for (const date of historic) {
      assert.ok(!consumed.has(date), 'previous independent Monthly sources must never be reused');
      consumed.add(date);
    }
  }

  const latestPrior = [...priorEnds].sort().at(-1) ?? null;
  const eligible = available.filter((week) => !latestPrior || week.periodEnd > latestPrior);
  assert.ok(eligible.length >= 4, 'fewer than four published independent Weeklies in supplied complete inventory');
  const firstFour = eligible.slice(0, 4);
  if (latestPrior) {
    assert.equal(firstFour[0].periodEnd, plusDays(latestPrior, 7),
      'first independent Weekly after prior Monthly is missing');
  }
  assert.ok(firstFour.every((week, i) => i === 0 || week.periodEnd === plusDays(firstFour[i - 1].periodEnd, 7)),
    'a Friday is missing in the first four independent Weeklies');
  assert.deepEqual(selectedSources.map((week) => week.periodEnd), firstFour.map((week) => week.periodEnd),
    'selected source Weeklies are not the first four eligible independent Weeklies');
  assert.ok(firstFour.every((week) => !consumed.has(week.periodEnd)),
    'published independent Weekly already consumed by another Monthly');
  return { ...structural, firstFourStructurallyConfirmed: true, publishReady: false, releaseAuthorized: false };
}
export function validateMonthlyDraft(record, options = {}) {
  assertDraftOnly(record, 'independent_monthly', MONTHLY_FIELDS);
  assert.equal(record.sourceRule, 'four_consecutive_published_independent_weeklies');
  validateEditorial(record.editorial);
  if (record.sourceWeeklyReports.length === 4) {
    return inspectFirstFourIndependentPublishedWeeklies(record.sourceWeeklyReports, options);
  }
  return { ...inspectIndependentMonthlyWindow(record.sourceWeeklyReports),
    firstFourStructurallyConfirmed: false, releaseAuthorized: false };
}
export function runOfflineDraftValidation() {
  const weekly = JSON.parse(fs.readFileSync(path.join(DRAFT_DIR, 'weekly-2026-10-30.draft.json'), 'utf8'));
  const monthly = JSON.parse(fs.readFileSync(path.join(DRAFT_DIR, 'monthly-template.draft.json'), 'utf8'));
  const result = { weekly: validateWeeklyDraft(weekly), monthly: validateMonthlyDraft(monthly) };
  assert.equal(result.weekly.publishReady, false);
  assert.equal(result.monthly.publishReady, false);
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(process.argv.length, 2, 'no runtime inputs or provider endpoints permitted');
    console.log(JSON.stringify(runOfflineDraftValidation(), null, 2));
  } catch (error) {
    console.error('Independent editorial draft validation failed:', error.message);
    process.exitCode = 1;
  }
}
