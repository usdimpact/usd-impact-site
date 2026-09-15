import { readdirSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest, isCalendarDate } from '../src/lib/publication-calendar.js';
import { BLS_MONTHLY_SERIES, explicitBlsMonthlyLabel } from '../src/lib/publication-calendar-series.js';
import { parsePublicationCalendarSource } from '../src/lib/publication-calendar-source.js';
import { pipelineCalendarCandidate } from '../src/lib/publication-calendar-pipeline.js';
import { readVerifiedLocalFile } from '../src/lib/verified-local-file.js';

/** Diagnostic classification only. Fuzzy family recognition never selects or certifies an event. */
export function coverageFamily(event) {
  if (typeof event !== 'string' || event.length > 500) return 'UNKNOWN';
  for (const [series, definition] of Object.entries(BLS_MONTHLY_SERIES)) {
    if (definition.mention.test(event)) return `BLS:${series}`;
  }
  if (/\b(?:PCE|Personal Income|BEA)\b/i.test(event)) return 'BEA:UNSUPPORTED';
  if (/\b(?:FOMC|Federal Reserve|Fed|Beige Book)\b/i.test(event)) return 'FED:UNSUPPORTED';
  if (/\b(?:EIA|Petroleum Status|Natural Gas Storage)\b/i.test(event)) return 'EIA:UNSUPPORTED';
  if (/\bTreasury\b/i.test(event) && /\bbuy[ -]?backs?\b/i.test(event)) return 'TREASURY:BUYBACK_UNSUPPORTED';
  if (/\bTreasury\b/i.test(event) && /\bauctions?\b/i.test(event)) return 'TREASURY:AUCTION_UNSUPPORTED';
  if (/\bTreasury\b/i.test(event)) return 'TREASURY:OTHER_UNSUPPORTED';
  if (/\b(?:BLS|Job Openings|JOLTS|Productivity)\b/i.test(event)) return 'BLS:OTHER_UNSUPPORTED';
  return 'UNKNOWN';
}
export function auditCalendarCoverage({ directory = resolve('src/content/news'), asOf = new Date().toISOString().slice(0, 10), limit = 12, readVerified = readVerifiedLocalFile } = {}) {
  if (!isCalendarDate(asOf) || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('A valid diagnostic date and 1-50 edition limit are required.');
  const directoryStat = lstatSync(directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new Error('A regular content directory is required.');
  const names = readdirSync(directory);
  if (names.length > 1000) throw new Error('Coverage inventory exceeds the diagnostic bound.');
  const files = names.filter((name) => /^20\d{2}-\d{2}-\d{2}\.md$/.test(name) && name.slice(0, 10) <= asOf).sort().reverse();
  const editions = [], rows = [], errors = [];
  for (const name of files) {
    if (editions.length >= limit) break;
    const file = resolve(directory, name);
    try {
      const source = readVerified(file, 256000), payload = parsePublicationCalendarSource(source);
      if (payload.status !== 'published') continue;
      if (payload.date !== name.slice(0, 10) || !Array.isArray(payload.catalysts) || payload.catalysts.length > 10) throw new Error('unsupported-edition');
      const contentSha256 = digest(source);
      editions.push({ file: name, date: payload.date, contentSha256 });
      for (const event of payload.catalysts) {
        let recordState = 'CANONICAL_SHAPE_ACCEPTED_NOT_VERIFIED';
        try { pipelineCalendarCandidate(event, { daily: true }); } catch (error) { recordState = error.code ?? 'HOLD_INVALID_CANDIDATE'; }
        rows.push({ file: name, contentSha256, event: typeof event.event === 'string' ? event.event.slice(0, 500) : null,
          date: event.date, familyHint: coverageFamily(event.event), exactLabelRecognized: !!explicitBlsMonthlyLabel(event.event),
          recordState, freshSourceVerified: false, publicationAuthorized: false });
      }
    } catch (error) { errors.push({ file: name, decision: error.code ?? 'HOLD_COVERAGE_SOURCE' }); }
  }
  const familyCounts = {};
  for (const row of rows) familyCounts[row.familyHint] = (familyCounts[row.familyHint] ?? 0) + 1;
  return { decision: errors.length ? 'HOLD_COVERAGE_INCOMPLETE' : 'DIAGNOSTIC_ONLY', asOf, requestedEditionLimit: limit,
    editions, familyCounts, rows, errors, supportedAdapterSeries: Object.keys(BLS_MONTHLY_SERIES),
    freshSourceVerificationPerformed: false, publicationAuthorized: false, enforcementActive: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length > 4) throw new Error('Unexpected diagnostic arguments');
    const result = auditCalendarCoverage({ ...(process.argv[2] ? { asOf: process.argv[2] } : {}), ...(process.argv[3] ? { limit: Number(process.argv[3]) } : {}) });
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.errors.length ? 2 : 0;
  } catch { console.error('Coverage audit failed. Usage: node scripts/audit-publication-calendar-coverage.mjs [YYYY-MM-DD] [1-50]'); process.exitCode = 2; }
}
