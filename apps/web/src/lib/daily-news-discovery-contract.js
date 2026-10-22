// Pure request preparation: no fetch, provider call, response rewriting or source
// admission. Output order is a drafting aid, never proof of source validity.
export const SOURCE_FIRST_KEYS = Object.freeze([
  'sources', 'catalysts', 'highlights', 'marketRegime', 'summary', 'body',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function orderedKeys(keys, priority) {
  const present = new Set(keys);
  const preferred = new Set(priority);
  return [...priority.filter((key) => present.has(key)), ...keys.filter((key) => !preferred.has(key))];
}

export function sourceFirstRequest(body) {
  if (!isRecord(body)) throw new TypeError('Daily request must be an object');
  // withSourceMetadata adds date enums and field descriptions. Never let those
  // changes leak into the shared schema used by another edition or repair.
  const next = structuredClone(body);
  const schema = next.text?.format?.schema;
  if (!isRecord(schema?.properties) || !Object.hasOwn(schema.properties, 'sources')) return next;
  const properties = schema.properties;
  schema.properties = Object.fromEntries(
    orderedKeys(Object.keys(properties), SOURCE_FIRST_KEYS).map((key) => [key, properties[key]]),
  );
  if (Array.isArray(schema.required)) schema.required = orderedKeys(schema.required, SOURCE_FIRST_KEYS);
  return next;
}

function addDays(date, offset) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

export function buildSourceDiscoveryPlan(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return [
    `DAILY SOURCE-FIRST DISCOVERY CONTRACT: ${date}`,
    `1. Build sources before composing claims. Research the requested prior-36-hour developments first. Open the actual publisher documents and select at least three distinct, eligible, exact search-returned URLs, each with its own verified displayed publication or permitted update date no later than ${date}. A large list of consulted URLs is not a usable source inventory. Do not use a discovery index, reusable report pointer, guessed URL, access date or another document's date.`,
    `2. Match each selected document to a concrete supported highlight or confirmed catalyst before retaining it. Prefer primary documents; keep the existing independent-reporting rule where applicable. Replace an unsupported topic with a different verified development, not with a fabricated source or an absence claim. A daily-development source must be within ${addDays(date, -14)} through ${date}; that outer validation bound is not permission to call older context new today. Disclose older context explicitly and prioritize fresh outcomes.`,
    `3. Build catalysts next. Check the required primary calendars and include confirmed CPI, PCE, payroll and FOMC events in the inclusive ${date} through ${addDays(date, 7)} window. Keep event dates separate from source dates. Never move a date to fit. For every forward reference in later copy, retain the matching supported event or remove that reference everywhere. A discovery calendar may lead to a source but does not itself prove a document date.`,
    '4. Only then write 3-7 highlights from the retained inventory, followed by the regime, summary and body. Do not force a sector or asset quota. Every retained URL must support a retained highlight or catalyst, and every source ID reference must resolve. Remove unsupported negative statements, stale Treasury auction claims and unsupported market-price or regime assertions rather than filling slots.',
    '5. Final cross-check: count distinct eligible, used publisher documents, not search results, tracking variants or repeated citations. Do not add metadata-only URLs or rewrite dates to pass. Complete research inside the existing request and limits; this contract does not authorize extra requests or a larger retry budget. If adequate evidence is unavailable, do not fabricate a passing bundle. The server validators remain authoritative.',
    'END DAILY SOURCE-FIRST DISCOVERY CONTRACT',
  ].join('\n');
}
