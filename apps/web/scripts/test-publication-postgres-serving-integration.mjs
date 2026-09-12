import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPublicationGuardSqlAdapter } from '../src/lib/publication-postgres-adapter.js';
import { createPublicationServingPolicy, SERVING_SCOPE } from '../src/lib/publication-serving-policy.js';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const releaseAt = '2026-09-11T12:30:00.000Z';
const releaseTime = Date.parse(releaseAt);
const now = releaseTime - 120_000;
const path = '/news/catalysts/cpi-august-preview';
const calendar = {
  publisher: 'BLS',
  series: 'CPI',
  referencePeriod: '2026-08',
  releaseStage: 'initial',
  eventDate: '2026-09-11',
  releaseTime: '08:30',
  timeZone: 'America/New_York',
  releaseAt,
};
const source = `---\nstatus: "published"\nslug: "${path}"\ncategory: "USD Impact Catalyst Brief"\ntitle: "August CPI preview"\nevent: "BLS Consumer Price Index (CPI) for August 2026"\nphase: "preview"\nstatusLabel: "scheduled-confirmed"\neventDate: "2026-09-11"\ncalendar: ${JSON.stringify(calendar)}\n---\nSYNTHETIC_TEST_BODY`;
const sourceSha256 = digest(source);
const entries = [{ path, sourceSha256 }];
const historyRevision = 'revision-integration-1';
const authority = {
  ...SERVING_SCOPE,
  schema: 'publication-serving-authority/v1',
  target: 'production',
  exposure: 'public-approved',
  deploymentId: 'dpl_integration1',
  commitSha: 'a'.repeat(40),
  artifactSha256: 'b'.repeat(64),
  historyRevision,
  entries,
  manifestSha256: digest(JSON.stringify(entries)),
  legacyBaseline: null,
  observedAt: new Date(now - 1_000).toISOString(),
  validUntil: new Date(now + 10_000).toISOString(),
};
const record = {
  ...SERVING_SCOPE,
  schema: 'publication-admission/v1',
  path,
  sourceSha256,
  state: 'admitted',
  basis: 'calendar-verified',
  calendarVerified: true,
  deploymentId: 'dpl_original123',
  commitSha: 'c'.repeat(40),
  artifactSha256: 'd'.repeat(64),
  evidenceSha256: 'e'.repeat(64),
  calendarCheckedAt: new Date(releaseTime - 180_000).toISOString(),
  admittedAt: new Date(releaseTime - 150_000).toISOString(),
  calendarValidUntil: releaseAt,
  previewDeadline: releaseAt,
};

let groups = 0;
async function check(name, operation) {
  try {
    await operation();
    groups += 1;
  } catch (error) {
    throw new Error(`Postgres/serving integration regression: ${name}`, { cause: error });
  }
}

function policyForQuery(query) {
  const reader = createPublicationGuardSqlAdapter({ role: 'reader', query });
  return createPublicationServingPolicy({
    now: () => now,
    loadAuthority: async () => authority,
    readHistory: reader.readSnapshot,
  });
}

await check('reader readSnapshot is the serving readHistory adapter without a wrapper', async () => {
  const calls = [];
  const query = async ({ text, values }) => {
    calls.push({ text, values });
    assert.equal(text, 'select publication_guard_api.read_snapshot($1, $2::jsonb) as value');
    assert.equal(values[0], historyRevision);
    assert.deepEqual(JSON.parse(values[1]), entries);
    return { rows: [{ value: { revision: historyRevision, records: [{ ...entries[0], record }] } }] };
  };
  const policy = policyForQuery(query);
  const ticket = await policy.inspect([source]);
  assert.equal(ticket.state, 'INSPECTED');
  const projected = policy.project(ticket, { surface: 'homepage' });
  assert.equal(projected.view.items.length, 1);
  assert.equal(projected.view.items[0].slug, path);
  assert.equal(projected.view.items[0].publicationPresentation, 'current');
  assert.equal(projected.publicationAuthorized, false);
  assert.equal(projected.enforcementActive, false);
  assert.equal(calls.length, 1);
});

await check('wrong database history revision fails closed in serving policy', async () => {
  const policy = policyForQuery(async () => ({ rows: [{ value: {
    revision: 'wrong-revision',
    records: [{ ...entries[0], record }],
  } }] }));
  const ticket = await policy.inspect([source]);
  assert.equal(ticket.state, 'HOLD');
  assert.equal(ticket.decision, 'HOLD_HISTORY_SNAPSHOT_INVALID');
  assert.equal(policy.project(ticket, { surface: 'homepage' }).view.items.length, 0);
});

await check('incomplete database history snapshot fails closed', async () => {
  const policy = policyForQuery(async () => ({ rows: [{ value: { revision: historyRevision, records: [] } }] }));
  const ticket = await policy.inspect([source]);
  assert.equal(ticket.state, 'HOLD');
  assert.equal(ticket.decision, 'HOLD_HISTORY_SNAPSHOT_INVALID');
});

await check('database adapter errors are sanitized by serving policy', async () => {
  const policy = policyForQuery(async () => { throw new Error('PRIVATE_DATABASE_DETAIL_DO_NOT_EXPOSE'); });
  const ticket = await policy.inspect([source]);
  assert.equal(ticket.state, 'HOLD');
  assert.equal(ticket.decision, 'HOLD_ADAPTER_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(ticket), /PRIVATE_DATABASE_DETAIL/);
});

await check('synthetic Preview authority is still rejected', async () => {
  const reader = createPublicationGuardSqlAdapter({ role: 'reader', query: async () => ({
    rows: [{ value: { revision: historyRevision, records: [{ ...entries[0], record }] } }],
  }) });
  const policy = createPublicationServingPolicy({
    now: () => now,
    loadAuthority: async () => ({ ...authority, target: 'preview', exposure: 'private-preview' }),
    readHistory: reader.readSnapshot,
  });
  const ticket = await policy.inspect([source]);
  assert.equal(ticket.state, 'HOLD');
  assert.equal(ticket.decision, 'HOLD_PUBLIC_CONTEXT_UNVERIFIED');
});

console.log(`publication postgres/serving integration tests pass (${groups} groups)`);
