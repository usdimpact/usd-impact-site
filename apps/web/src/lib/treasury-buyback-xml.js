export const TREASURY_BUYBACK_XML_SCHEMA_VERSION = 'treasury-buyback-xml/treasurydirect-v0';
export const TREASURY_BUYBACK_XML_MAX_BYTES = 1_048_576;

export class TreasuryBuybackXmlHold extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TreasuryBuybackXmlHold';
    this.code = code;
  }
}

const hold = (code, message) => { throw new TreasuryBuybackXmlHold(code, message); };
const ARTIFACT_PATH = /^\/instit\/annceresult\/press\/preanre\/(20\d{2})\/(BBPA|BBA|BBR)_(20\d{12})\.xml$/;
const ISO_OFFSET_TIMESTAMP = /^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1\d|2[0-3]):[0-5]\d)$/;
const NON_NEGATIVE_INTEGER = /^(?:0|[1-9]\d*)$/;

function parseArtifactUrl(value) {
  if (typeof value !== 'string' || value.length > 400) hold('HOLD_TREASURY_BUYBACK_XML_URL', 'A bounded TreasuryDirect XML URL is required.');
  let url;
  try { url = new URL(value); } catch { hold('HOLD_TREASURY_BUYBACK_XML_URL', 'TreasuryDirect XML URL is malformed.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'www.treasurydirect.gov' || url.port || url.username || url.password || url.search || url.hash) {
    hold('HOLD_TREASURY_BUYBACK_XML_URL', 'TreasuryDirect XML URL must use the reviewed HTTPS origin and canonical path only.');
  }
  const match = url.pathname.match(ARTIFACT_PATH);
  if (!match || match[1] !== match[3].slice(0, 4)) hold('HOLD_TREASURY_BUYBACK_XML_URL', 'TreasuryDirect XML URL does not match the reviewed buyback artifact path.');
  return Object.freeze({ url: url.toString(), year: match[1], kind: match[2], operationStamp: match[3] });
}

function boundedXml(value) {
  if (typeof value !== 'string') hold('HOLD_TREASURY_BUYBACK_XML_BODY', 'TreasuryDirect XML body must be text.');
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes < 16 || bytes > TREASURY_BUYBACK_XML_MAX_BYTES) hold('HOLD_TREASURY_BUYBACK_XML_BODY', 'TreasuryDirect XML body is empty or exceeds the parser bound.');
  if (/<!DOCTYPE\b|<!ENTITY\b|<!\[CDATA\[|<!--|<\?xml-stylesheet\b/i.test(value)) {
    hold('HOLD_TREASURY_BUYBACK_XML_BODY', 'TreasuryDirect XML contains unsupported active or ambiguous markup.');
  }
  return value;
}

function decodeText(value, tag) {
  if (/<|>/.test(value)) hold('HOLD_TREASURY_BUYBACK_XML_SCHEMA', `TreasuryDirect ${tag} contains nested markup.`);
  const unknownEntity = /&(?!(?:amp|lt|gt|quot|apos);)/;
  if (unknownEntity.test(value)) hold('HOLD_TREASURY_BUYBACK_XML_SCHEMA', `TreasuryDirect ${tag} contains an unsupported entity.`);
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
    .trim();
}

function uniqueTag(xml, tag, { required = true, max = 300 } = {}) {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g');
  const matches = [...xml.matchAll(pattern)];
  if (matches.length === 0) {
    if (required) hold('HOLD_TREASURY_BUYBACK_XML_SCHEMA', `TreasuryDirect ${tag} is missing.`);
    return null;
  }
  if (matches.length !== 1) hold('HOLD_TREASURY_BUYBACK_XML_DUPLICATE', `TreasuryDirect ${tag} must appear exactly once.`);
  const text = decodeText(matches[0][1], tag);
  if (!text || text.length > max) hold('HOLD_TREASURY_BUYBACK_XML_SCHEMA', `TreasuryDirect ${tag} is empty or unbounded.`);
  return text;
}

function isRealCalendarDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function instant(value, tag) {
  if (!ISO_OFFSET_TIMESTAMP.test(value) || !isRealCalendarDate(value.slice(0, 10))) {
    hold('HOLD_TREASURY_BUYBACK_XML_TIME', `TreasuryDirect ${tag} requires a real calendar date and explicit ISO timestamp offset.`);
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) hold('HOLD_TREASURY_BUYBACK_XML_TIME', `TreasuryDirect ${tag} is not a valid timestamp.`);
  return Object.freeze({ text: value, epochMs: ms, isoUtc: new Date(ms).toISOString() });
}

function integer(value, tag) {
  if (!NON_NEGATIVE_INTEGER.test(value) || value.length > 30) hold('HOLD_TREASURY_BUYBACK_XML_SCHEMA', `TreasuryDirect ${tag} must be a canonical non-negative integer.`);
  return value;
}

function utcStamp(epochMs) {
  const iso = new Date(epochMs).toISOString();
  return iso.slice(0, 19).replace(/[-:T]/g, '');
}

/**
 * Decode one caller-supplied TreasuryDirect buyback XML envelope.
 *
 * This module performs no network request and no freshness check. It is not
 * wired into the publication calendar. A BBR announcementDTM, when present,
 * is retained only as sourceAnnouncementAt; it is never interpreted as the
 * time aggregate results became public.
 */
export function parseTreasuryBuybackXmlEnvelope({ sourceUrl, xml }) {
  const artifact = parseArtifactUrl(sourceUrl);
  const body = boundedXml(xml);
  const operationStart = instant(uniqueTag(body, 'operationStartDTM'), 'operationStartDTM');
  const operationClose = instant(uniqueTag(body, 'operationCloseDTM'), 'operationCloseDTM');
  if (operationClose.epochMs <= operationStart.epochMs || operationClose.epochMs - operationStart.epochMs > 3 * 60 * 60 * 1000) {
    hold('HOLD_TREASURY_BUYBACK_XML_TIME', 'TreasuryDirect operation window is reversed or exceeds the reviewed bound.');
  }
  if (utcStamp(operationStart.epochMs) !== artifact.operationStamp) {
    hold('HOLD_TREASURY_BUYBACK_XML_IDENTITY', 'TreasuryDirect operation start does not match the artifact operation stamp.');
  }

  const announcementText = uniqueTag(body, 'announcementDTM', { required: false, max: 40 });
  const sourceAnnouncementAt = announcementText ? instant(announcementText, 'announcementDTM') : null;
  const common = {
    schemaVersion: TREASURY_BUYBACK_XML_SCHEMA_VERSION,
    sourceUrl: artifact.url,
    artifactKind: artifact.kind,
    operationStamp: artifact.operationStamp,
    operationStartAt: operationStart.isoUtc,
    operationCloseAt: operationClose.isoUtc,
    sourceAnnouncementAt: sourceAnnouncementAt?.isoUtc ?? null,
    resultsPublishedAt: null,
    freshSourceVerified: false,
    publicationAuthorized: false,
    enforcementActive: false,
  };

  if (artifact.kind === 'BBPA') {
    const announcementType = uniqueTag(body, 'announcementType', { max: 40 });
    if (announcementType !== 'Preliminary') hold('HOLD_TREASURY_BUYBACK_XML_KIND', 'BBPA envelope is not a Preliminary announcement.');
    if (!sourceAnnouncementAt || sourceAnnouncementAt.epochMs >= operationStart.epochMs) {
      hold('HOLD_TREASURY_BUYBACK_XML_TIME', 'Preliminary announcement must precede the operation start.');
    }
    const announcementTitle = uniqueTag(body, 'announcementTitle', { max: 180 });
    if (!/^TREASURY DEBT BUYBACK OPERATION PRELIMINARY ANNOUNCEMENT$/i.test(announcementTitle)) {
      hold('HOLD_TREASURY_BUYBACK_XML_KIND', 'BBPA announcement title does not match the reviewed captured shape.');
    }
    return Object.freeze({
      ...common,
      announcementType,
      announcementTitle,
      maxParAmountRedeemed: integer(uniqueTag(body, 'maxParAmountRedeemed', { max: 30 }), 'maxParAmountRedeemed'),
      numberIssuesEligible: integer(uniqueTag(body, 'numberIssuesEligible', { max: 30 }), 'numberIssuesEligible'),
    });
  }

  if (artifact.kind === 'BBA') {
    const announcementType = uniqueTag(body, 'announcementType', { required: false, max: 40 });
    if (announcementType && announcementType !== 'Final') hold('HOLD_TREASURY_BUYBACK_XML_KIND', 'BBA announcement type conflicts with the expected final-announcement shape.');
    if (!sourceAnnouncementAt || sourceAnnouncementAt.epochMs > operationStart.epochMs) {
      hold('HOLD_TREASURY_BUYBACK_XML_TIME', 'Final announcement timestamp must not follow operation start.');
    }
    return Object.freeze({ ...common, announcementType });
  }

  const operationStatus = uniqueTag(body, 'operationStatus', { max: 40 });
  if (operationStatus !== 'Results') hold('HOLD_TREASURY_BUYBACK_XML_KIND', 'BBR envelope is not a Results record.');
  const numberIssuesAccepted = integer(uniqueTag(body, 'numberIssuesAccepted', { max: 30 }), 'numberIssuesAccepted');
  const totalParAmountOffered = integer(uniqueTag(body, 'totalParAmountOffered', { max: 30 }), 'totalParAmountOffered');
  const totalParAmountAccepted = integer(uniqueTag(body, 'totalParAmountAccepted', { max: 30 }), 'totalParAmountAccepted');
  if (BigInt(totalParAmountAccepted) > BigInt(totalParAmountOffered)) {
    hold('HOLD_TREASURY_BUYBACK_XML_RESULT', 'TreasuryDirect accepted par amount exceeds offered par amount.');
  }
  return Object.freeze({ ...common, operationStatus, numberIssuesAccepted, totalParAmountOffered, totalParAmountAccepted });
}

/** Cross-envelope consistency only; still not a freshness or publication decision. */
export function verifyTreasuryBuybackXmlSet({ preliminary, final, results }) {
  for (const [name, envelope, kind] of [['preliminary', preliminary, 'BBPA'], ['final', final, 'BBA'], ['results', results, 'BBR']]) {
    if (!envelope || envelope.schemaVersion !== TREASURY_BUYBACK_XML_SCHEMA_VERSION || envelope.artifactKind !== kind) {
      hold('HOLD_TREASURY_BUYBACK_XML_SET', `Treasury buyback ${name} envelope is missing or has the wrong kind.`);
    }
    if (envelope.publicationAuthorized !== false || envelope.enforcementActive !== false || envelope.freshSourceVerified !== false) {
      hold('HOLD_TREASURY_BUYBACK_XML_SET', `Treasury buyback ${name} envelope crossed the dormant-parser boundary.`);
    }
  }
  const identity = `${preliminary.operationStamp}:${preliminary.operationStartAt}:${preliminary.operationCloseAt}`;
  for (const envelope of [final, results]) {
    if (`${envelope.operationStamp}:${envelope.operationStartAt}:${envelope.operationCloseAt}` !== identity) {
      hold('HOLD_TREASURY_BUYBACK_XML_SET', 'Treasury buyback XML envelopes do not identify one operation.');
    }
  }
  return Object.freeze({
    schemaVersion: TREASURY_BUYBACK_XML_SCHEMA_VERSION,
    operationStamp: preliminary.operationStamp,
    operationStartAt: preliminary.operationStartAt,
    operationCloseAt: preliminary.operationCloseAt,
    preliminaryAnnouncementAt: preliminary.sourceAnnouncementAt,
    finalAnnouncementAt: final.sourceAnnouncementAt,
    resultsPublishedAt: null,
    freshSourceVerified: false,
    publicationAuthorized: false,
    enforcementActive: false,
  });
}
