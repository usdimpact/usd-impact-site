import { BLS_MONTHLY_SERIES, blsMonthlyDefinition, explicitBlsMonthlyLabel } from './publication-calendar-series.js';

const freezeList = (values) => Object.freeze([...values]);
const freezeRecord = (value) => Object.freeze({ ...value });

function descriptor({
  family,
  publisher,
  series,
  reference,
  releaseStages,
  clock,
  identity,
  verification,
}) {
  return Object.freeze({
    family,
    publisher,
    series,
    reference: freezeRecord(reference),
    releaseStages: freezeList(releaseStages),
    clock: freezeRecord(clock),
    identity: Object.freeze({ ...identity, fields: freezeList(identity.fields) }),
    verification: freezeRecord(verification),
  });
}

const BLS_DESCRIPTORS = Object.freeze(Object.fromEntries(
  Object.keys(BLS_MONTHLY_SERIES).map((series) => [series, descriptor({
    family: 'BLS_NATIONAL_MONTHLY',
    publisher: 'BLS',
    series,
    reference: { kind: 'month', field: 'referencePeriod', pattern: 'YYYY-MM' },
    releaseStages: ['initial'],
    clock: { kind: 'iana-local-release', timeZone: 'America/New_York' },
    identity: {
      kind: 'monthly-release',
      fields: ['publisher', 'series', 'referencePeriod', 'releaseStage'],
      format: 'legacy-colon-v1',
      labelParser: 'bls-national-monthly',
    },
    verification: { enabled: true, adapter: 'bls-national-monthly/html-v4' },
  })]),
));

const TREASURY_BUYBACK_DESCRIPTOR = descriptor({
  family: 'TREASURY_BUYBACK',
  publisher: 'TREASURY',
  series: 'BUYBACK',
  reference: { kind: 'operation-date', field: 'operationDate', pattern: 'YYYY-MM-DD' },
  releaseStages: ['operation'],
  clock: { kind: 'operation-window', timeZone: 'America/New_York' },
  identity: {
    kind: 'dated-operation',
    fields: ['publisher', 'series', 'operationDate', 'operationIdentity', 'releaseStage'],
    format: 'structured-v1',
    labelParser: null,
  },
  verification: { enabled: false, adapter: null },
});

/**
 * Return a frozen event-family descriptor. Recognition is not verification.
 * A descriptor with verification.enabled=false must remain HOLD_UNSUPPORTED_EVENT
 * at the publication-calendar boundary until a separately reviewed adapter exists.
 */
export function publicationEventDescriptor(publisher, series) {
  if (publisher === 'BLS' && blsMonthlyDefinition(series)) return BLS_DESCRIPTORS[series];
  if (publisher === 'TREASURY' && series === 'BUYBACK') return TREASURY_BUYBACK_DESCRIPTOR;
  return null;
}

export function parsePublicationEventLabel(eventDescriptor, event) {
  if (!eventDescriptor || typeof event !== 'string') return null;
  if (eventDescriptor.identity.labelParser === 'bls-national-monthly') return explicitBlsMonthlyLabel(event);
  return null;
}

function boundedIdentityValue(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 500 ? value : null;
}

/**
 * Build an identity from descriptor-declared fields only. This does not verify
 * evidence or authorize publication. BLS keeps the existing colon identity
 * byte-for-byte; newer families use an encoded structured form to avoid field
 * boundary ambiguity.
 */
export function canonicalPublicationEventIdentity(value, eventDescriptor = publicationEventDescriptor(value?.publisher, value?.series)) {
  if (!value || !eventDescriptor) return null;
  const parts = eventDescriptor.identity.fields.map((field) => boundedIdentityValue(value[field]));
  if (parts.some((part) => part === null)) return null;
  if (eventDescriptor.identity.format === 'legacy-colon-v1') return parts.join(':');
  return `publication-event/v1|${encodeURIComponent(eventDescriptor.family)}|${eventDescriptor.identity.fields
    .map((field, index) => `${encodeURIComponent(field)}=${encodeURIComponent(parts[index])}`)
    .join('|')}`;
}

export function publicationEventRegistrySnapshot() {
  return Object.freeze([
    ...Object.values(BLS_DESCRIPTORS),
    TREASURY_BUYBACK_DESCRIPTOR,
  ]);
}
