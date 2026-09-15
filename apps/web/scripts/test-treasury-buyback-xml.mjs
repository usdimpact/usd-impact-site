import assert from 'node:assert/strict';
import { normalizeCalendarCandidate } from '../src/lib/publication-calendar.js';
import {
  TREASURY_BUYBACK_XML_MAX_BYTES,
  TREASURY_BUYBACK_XML_SCHEMA_VERSION,
  TreasuryBuybackXmlHold,
  parseTreasuryBuybackXmlEnvelope,
  verifyTreasuryBuybackXmlSet,
} from '../src/lib/treasury-buyback-xml.js';

let groups = 0;
const pass = () => { groups += 1; };
const stamp = '20260818174000';
const base = 'https://www.treasurydirect.gov/instit/annceresult/press/preanre/2026';
const urls = Object.freeze({
  BBPA: `${base}/BBPA_${stamp}.xml`,
  BBA: `${base}/BBA_${stamp}.xml`,
  BBR: `${base}/BBR_${stamp}.xml`,
});
const common = `
  <operationStartDTM>2026-08-18T13:40:00-04:00</operationStartDTM>
  <operationCloseDTM>2026-08-18T14:00:00-04:00</operationCloseDTM>`;
const bbpa = `<?xml version="1.0" encoding="UTF-8"?>
<buybackAnnouncement>
  <announcementType>Preliminary</announcementType>
  <announcementDTM>2026-08-17T11:00:00-04:00</announcementDTM>
  <announcementTitle>TREASURY DEBT BUYBACK OPERATION PRELIMINARY ANNOUNCEMENT</announcementTitle>${common}
  <maxParAmountRedeemed>2000000000</maxParAmountRedeemed>
  <numberIssuesEligible>36</numberIssuesEligible>
</buybackAnnouncement>`;
const bba = `<?xml version="1.0" encoding="UTF-8"?>
<buybackAnnouncement>
  <announcementType>Final</announcementType>
  <announcementDTM>2026-08-18T11:00:00-04:00</announcementDTM>${common}
</buybackAnnouncement>`;
const bbr = `<?xml version="1.0" encoding="UTF-8"?>
<buybackResults>
  <announcementDTM>2026-08-18T11:00:00-04:00</announcementDTM>${common}
  <operationStatus>Results</operationStatus>
  <numberIssuesAccepted>3</numberIssuesAccepted>
  <totalParAmountOffered>19868000000</totalParAmountOffered>
  <totalParAmountAccepted>2000000000</totalParAmountAccepted>
</buybackResults>`;

function held(work, code) {
  assert.throws(work, (error) => error instanceof TreasuryBuybackXmlHold && error.code === code);
  pass();
}

assert.equal(TREASURY_BUYBACK_XML_SCHEMA_VERSION, 'treasury-buyback-xml/treasurydirect-v0');
assert.equal(TREASURY_BUYBACK_XML_MAX_BYTES, 1_048_576);
pass();

const preliminary = parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: bbpa });
assert.equal(preliminary.artifactKind, 'BBPA');
assert.equal(preliminary.operationStamp, stamp);
assert.equal(preliminary.operationStartAt, '2026-08-18T17:40:00.000Z');
assert.equal(preliminary.operationCloseAt, '2026-08-18T18:00:00.000Z');
assert.equal(preliminary.sourceAnnouncementAt, '2026-08-17T15:00:00.000Z');
assert.equal(preliminary.maxParAmountRedeemed, '2000000000');
assert.equal(preliminary.numberIssuesEligible, '36');
assert.equal(preliminary.resultsPublishedAt, null);
assert.equal(preliminary.freshSourceVerified, false);
assert.equal(preliminary.publicationAuthorized, false);
assert.equal(preliminary.enforcementActive, false);
pass();

const final = parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBA, xml: bba });
assert.equal(final.artifactKind, 'BBA');
assert.equal(final.announcementType, 'Final');
assert.equal(final.sourceAnnouncementAt, '2026-08-18T15:00:00.000Z');
assert.equal(final.resultsPublishedAt, null);
pass();

const results = parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBR, xml: bbr });
assert.equal(results.artifactKind, 'BBR');
assert.equal(results.operationStatus, 'Results');
assert.equal(results.numberIssuesAccepted, '3');
assert.equal(results.totalParAmountOffered, '19868000000');
assert.equal(results.totalParAmountAccepted, '2000000000');
assert.equal(results.sourceAnnouncementAt, '2026-08-18T15:00:00.000Z');
assert.equal(results.resultsPublishedAt, null, 'BBR announcementDTM must not become results publication time');
pass();

const verifiedSet = verifyTreasuryBuybackXmlSet({ preliminary, final, results });
assert.deepEqual(verifiedSet, {
  schemaVersion: TREASURY_BUYBACK_XML_SCHEMA_VERSION,
  operationStamp: stamp,
  operationStartAt: '2026-08-18T17:40:00.000Z',
  operationCloseAt: '2026-08-18T18:00:00.000Z',
  preliminaryAnnouncementAt: '2026-08-17T15:00:00.000Z',
  finalAnnouncementAt: '2026-08-18T15:00:00.000Z',
  resultsPublishedAt: null,
  freshSourceVerified: false,
  publicationAuthorized: false,
  enforcementActive: false,
});
pass();

held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA.replace('www.treasurydirect.gov', 'evil.example'), xml: bbpa }), 'HOLD_TREASURY_BUYBACK_XML_URL');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: `${urls.BBPA}?download=1`, xml: bbpa }), 'HOLD_TREASURY_BUYBACK_XML_URL');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA.replace('/2026/', '/2025/'), xml: bbpa }), 'HOLD_TREASURY_BUYBACK_XML_URL');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: `${base}/OTHER_${stamp}.xml`, xml: bbpa }), 'HOLD_TREASURY_BUYBACK_XML_URL');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: '' }), 'HOLD_TREASURY_BUYBACK_XML_BODY');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: `<!DOCTYPE a [<!ENTITY x "boom">]>${bbpa}` }), 'HOLD_TREASURY_BUYBACK_XML_BODY');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: `<!-- fake <operationStartDTM>2026-08-18T13:40:00-04:00</operationStartDTM> -->${bbpa}` }), 'HOLD_TREASURY_BUYBACK_XML_BODY');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: `<root><![CDATA[${bbpa}]]></root>` }), 'HOLD_TREASURY_BUYBACK_XML_BODY');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: `${bbpa}${'x'.repeat(TREASURY_BUYBACK_XML_MAX_BYTES)}` }), 'HOLD_TREASURY_BUYBACK_XML_BODY');

held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: bbpa.replace('</operationStartDTM>', '</operationStartDTM><operationStartDTM>2026-08-18T13:40:00-04:00</operationStartDTM>') }), 'HOLD_TREASURY_BUYBACK_XML_DUPLICATE');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: bbpa.replace('<operationCloseDTM>2026-08-18T14:00:00-04:00</operationCloseDTM>', '') }), 'HOLD_TREASURY_BUYBACK_XML_SCHEMA');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: bbpa.replace('2026-08-18T13:40:00-04:00', '2026-08-18T13:40:00') }), 'HOLD_TREASURY_BUYBACK_XML_TIME');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: bbpa.replace('2026-08-18T13:40:00-04:00', '2026-02-31T13:40:00-04:00') }), 'HOLD_TREASURY_BUYBACK_XML_TIME');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: bbpa.replace('2026-08-18T14:00:00-04:00', '2026-08-18T13:30:00-04:00') }), 'HOLD_TREASURY_BUYBACK_XML_TIME');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: bbpa.replace('2026-08-18T14:00:00-04:00', '2026-08-18T17:00:00-04:00') }), 'HOLD_TREASURY_BUYBACK_XML_TIME');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA.replace(stamp, '20260818174100'), xml: bbpa }), 'HOLD_TREASURY_BUYBACK_XML_IDENTITY');

held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: bbpa.replace('Preliminary', 'Final') }), 'HOLD_TREASURY_BUYBACK_XML_KIND');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: bbpa.replace('<announcementDTM>2026-08-17T11:00:00-04:00</announcementDTM>', '') }), 'HOLD_TREASURY_BUYBACK_XML_TIME');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: bbpa.replace('2026-08-17T11:00:00-04:00', '2026-08-18T13:40:00-04:00') }), 'HOLD_TREASURY_BUYBACK_XML_TIME');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: bbpa.replace('TREASURY DEBT BUYBACK OPERATION PRELIMINARY ANNOUNCEMENT', 'Other announcement') }), 'HOLD_TREASURY_BUYBACK_XML_KIND');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: bbpa.replace('36', '-1') }), 'HOLD_TREASURY_BUYBACK_XML_SCHEMA');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBPA, xml: bbpa.replace('36', '3&bogus;6') }), 'HOLD_TREASURY_BUYBACK_XML_SCHEMA');

held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBA, xml: bba.replace('Final', 'Preliminary') }), 'HOLD_TREASURY_BUYBACK_XML_KIND');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBA, xml: bba.replace('2026-08-18T11:00:00-04:00', '2026-08-18T13:41:00-04:00') }), 'HOLD_TREASURY_BUYBACK_XML_TIME');
const bbaWithoutType = bba.replace('  <announcementType>Final</announcementType>\n', '');
assert.equal(parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBA, xml: bbaWithoutType }).announcementType, null);
pass();

held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBR, xml: bbr.replace('<operationStatus>Results</operationStatus>', '<operationStatus>Scheduled</operationStatus>') }), 'HOLD_TREASURY_BUYBACK_XML_KIND');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBR, xml: bbr.replace('2000000000', '19868000001') }), 'HOLD_TREASURY_BUYBACK_XML_RESULT');
held(() => parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBR, xml: bbr.replace('<numberIssuesAccepted>3</numberIssuesAccepted>', '') }), 'HOLD_TREASURY_BUYBACK_XML_SCHEMA');
const bbrWithoutAnnouncement = bbr.replace('  <announcementDTM>2026-08-18T11:00:00-04:00</announcementDTM>', '');
assert.equal(parseTreasuryBuybackXmlEnvelope({ sourceUrl: urls.BBR, xml: bbrWithoutAnnouncement }).sourceAnnouncementAt, null);
pass();

const mismatchedFinal = parseTreasuryBuybackXmlEnvelope({
  sourceUrl: 'https://www.treasurydirect.gov/instit/annceresult/press/preanre/2026/BBA_20260819174000.xml',
  xml: bba.replaceAll('2026-08-18', '2026-08-19'),
});
held(() => verifyTreasuryBuybackXmlSet({ preliminary, final: mismatchedFinal, results }), 'HOLD_TREASURY_BUYBACK_XML_SET');
held(() => verifyTreasuryBuybackXmlSet({ preliminary, final, results: final }), 'HOLD_TREASURY_BUYBACK_XML_SET');
held(() => verifyTreasuryBuybackXmlSet({ preliminary: { ...preliminary, publicationAuthorized: true }, final, results }), 'HOLD_TREASURY_BUYBACK_XML_SET');

assert.throws(
  () => normalizeCalendarCandidate({
    publisher: 'TREASURY', series: 'BUYBACK', referencePeriod: '2026-08', releaseStage: 'initial',
    eventDate: '2026-08-18', releaseTime: '14:00', timeZone: 'America/New_York',
    releaseAt: '2026-08-18T18:00:00Z', phase: 'outcome', statusLabel: 'released',
  }),
  (error) => error?.code === 'HOLD_UNSUPPORTED_EVENT',
  'Treasury XML parsing must not create a canonical publication-calendar PASS path',
);
pass();

assert.equal(JSON.stringify(results).includes('resultsPublishedAt":"2026'), false);
assert.equal(JSON.stringify(verifiedSet).includes('resultsPublishedAt":"2026'), false);
pass();

console.log(`Treasury buyback dormant XML parser: ${groups} regression groups passed (synthetic/captured-shape fixtures only; no network freshness or publication certification).`);
