// Explicitly invoked CLI: DEMO uses invented XML and never downloads market data.
// --live-official makes one bounded GET to the fixed Treasury government endpoint;
// it never creates files, opens PRs, publishes, or asserts licence rights.
import { buildTreasuryCandidate, fetchTreasuryCandidate, redactedIssuerProbeReceipt, planTreasuryProbeArgs } from './verified-treasury-source.mjs';

const plan = planTreasuryProbeArgs(process.argv.slice(2));
const fixtureXml = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" ' +
  'xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" ' +
  'xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices">' +
  '<entry><content type="application/xml"><m:properties>' +
  '<d:NEW_DATE m:type="Edm.DateTime">2100-02-01T00:00:00</d:NEW_DATE>' +
  '<d:BC_2YEAR m:type="Edm.Double">4.12</d:BC_2YEAR>' +
  '<d:BC_10YEAR m:type="Edm.Double">4.65</d:BC_10YEAR>' +
  '</m:properties></content></entry></feed>';

function newYorkDay(instant) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(instant).map(p => [p.type,p.value]));
  return parts.year + '-' + parts.month + '-' + parts.day;
}

const result = plan.mode === 'demo' ?
  buildTreasuryCandidate({
    xml: fixtureXml, day: '2100-02-01', asOfUtc:'2100-02-01T23:45:00Z',
  }) :
  await (async () => {
    const start = new Date();
    const day = plan.day ?? newYorkDay(start);
    return fetchTreasuryCandidate({
      day, fetchImpl: globalThis.fetch, allowRetrospective: plan.allowRetrospective,
    });
  })();
if (result.record.public_release_authorized !== false ||
    result.en.public_release_authorized !== false ||
    result.es.public_release_authorized !== false) {
  throw new Error('candidate violated publication prohibition');
}

// The invented demo may show invented rates; an actual issuer probe NEVER
// prints real numeric observations or translated rate-bearing Markdown.
const report = plan.mode === 'demo' ? {
  scenario: 'INVENTED_FIXTURE_ONLY',
  source_transport: result.record.source.transport,
  status: result.record.status,
  record: result.record,
  english: result.en,
  spanish: result.es,
  publication_enabled: false,
  writes_repository_or_customer_data: false,
} : redactedIssuerProbeReceipt(result);
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
