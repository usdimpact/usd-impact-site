import assert from 'node:assert/strict';
import {
  PUBLICATION_GUARD_DATABASE_SCOPE,
  PublicationGuardDatabaseConfigurationError,
  createPublicationGuardSqlAdapter,
  publicationGuardLoginName,
  validatePublicationGuardDatabaseUrl,
} from '../src/lib/publication-postgres-adapter.js';

let groups = 0;
const pass = () => { groups += 1; };
const secret = 'a'.repeat(64);
const ref = PUBLICATION_GUARD_DATABASE_SCOPE.projectRef;
const url = (role, extra = '') => `postgresql://${publicationGuardLoginName(role)}.${ref}:${secret}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres${extra}`;
function hold(fn, code) {
  assert.throws(fn, (error) => error instanceof PublicationGuardDatabaseConfigurationError && error.code === code);
  pass();
}

assert.equal(ref, 'xakayexlzyrazuunqlxe');
assert.equal(PUBLICATION_GUARD_DATABASE_SCOPE.productionRef, 'gjzetjugmnwanvjkchux');
assert.equal(PUBLICATION_GUARD_DATABASE_SCOPE.sharedDevelopmentRef, 'ycstrcvshdluovtuasjc');
pass();

for (const role of ['reader', 'controller', 'recorder', 'revoker']) {
  const validated = validatePublicationGuardDatabaseUrl(url(role, '?sslmode=require'), { role });
  assert.deepEqual(validated, {
    role,
    projectRef: ref,
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    username: `${publicationGuardLoginName(role)}.${ref}`,
    sslRequired: true,
  });
  assert.equal(JSON.stringify(validated).includes(secret), false);
  pass();
}

hold(() => validatePublicationGuardDatabaseUrl('', { role: 'reader' }), 'HOLD_DATABASE_URL');
hold(() => validatePublicationGuardDatabaseUrl(`https://${publicationGuardLoginName('reader')}.${ref}:${secret}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`, { role: 'reader' }), 'HOLD_DATABASE_PROTOCOL');
hold(() => validatePublicationGuardDatabaseUrl(`postgresql://${publicationGuardLoginName('reader')}.${ref}:${secret}@db.${ref}.supabase.co:5432/postgres`, { role: 'reader' }), 'HOLD_DATABASE_POOLER');
hold(() => validatePublicationGuardDatabaseUrl(`postgresql://${publicationGuardLoginName('reader')}.${ref}:${secret}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`, { role: 'reader' }), 'HOLD_DATABASE_POOLER');
hold(() => validatePublicationGuardDatabaseUrl(`postgresql://${publicationGuardLoginName('reader')}.${ref}:${secret}@aws-0-eu-central-1.pooler.supabase.com:6543/template1`, { role: 'reader' }), 'HOLD_DATABASE_NAME');
hold(() => validatePublicationGuardDatabaseUrl(`postgresql://postgres.${ref}:${secret}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`, { role: 'reader' }), 'HOLD_DATABASE_ROLE');
hold(() => validatePublicationGuardDatabaseUrl(`postgresql://${publicationGuardLoginName('controller')}.${ref}:${secret}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`, { role: 'reader' }), 'HOLD_DATABASE_ROLE');
hold(() => validatePublicationGuardDatabaseUrl(url('reader', '?sslmode=disable'), { role: 'reader' }), 'HOLD_DATABASE_OPTIONS');
hold(() => validatePublicationGuardDatabaseUrl(url('reader', '?sslmode=require&application_name=x'), { role: 'reader' }), 'HOLD_DATABASE_OPTIONS');
hold(() => validatePublicationGuardDatabaseUrl(url('reader').replace(`.${ref}`, '.gjzetjugmnwanvjkchux'), { role: 'reader' }), 'HOLD_DATABASE_PROJECT');
hold(() => validatePublicationGuardDatabaseUrl(url('reader'), { role: 'reader', projectRef: 'ycstrcvshdluovtuasjc' }), 'HOLD_DATABASE_PROJECT');
hold(() => publicationGuardLoginName('postgres'), 'HOLD_DATABASE_ROLE');

const calls = [];
const query = async (config) => {
  calls.push(config);
  assert.equal(Object.hasOwn(config, 'name'), false, 'queries must remain unnamed for transaction pooling');
  assert.equal(typeof config.text, 'string');
  assert.equal(Array.isArray(config.values), true);
  return { rows: [{ value: { ok: true, call: calls.length } }] };
};
const ids = {
  releaseId: '11111111-1111-4111-8111-111111111111',
  deploymentId: 'dpl_12345678',
  commitSha: '1'.repeat(40),
  artifactSha256: '2'.repeat(64),
  approvalSha256: '3'.repeat(64),
  path: '/news/catalysts/test-event',
  sourceSha256: '4'.repeat(64),
  evidenceSha256: '5'.repeat(64),
  receiptSha256: '6'.repeat(64),
};
const now = '2026-09-11T00:00:00.000Z';
const later = '2026-09-11T00:10:00.000Z';

const reader = createPublicationGuardSqlAdapter({ role: 'reader', query });
assert.deepEqual(Object.keys(reader).sort(), ['enforcementActive', 'publicationAuthorized', 'readSnapshot', 'role'].sort());
const snapshot = await reader.readSnapshot({ revision: '0', entries: [{ path: ids.path, sourceSha256: ids.sourceSha256 }] });
assert.equal(snapshot.ok, true);
assert.match(calls.at(-1).text, /read_snapshot\(\$1, \$2::jsonb\)/);
assert.equal(calls.at(-1).values[0], '0');
pass();

const controller = createPublicationGuardSqlAdapter({ role: 'controller', query });
assert.deepEqual(Object.keys(controller).sort(), ['authorizeRelease', 'enforcementActive', 'prepareAdmission', 'publicationAuthorized', 'role'].sort());
await controller.authorizeRelease({ ...ids, expiresAt: later });
assert.match(calls.at(-1).text, /authorize_release\(\$1,\$2,\$3,\$4,\$5,\$6::timestamptz\)/);
assert.deepEqual(calls.at(-1).values.slice(0, 5), [ids.releaseId, ids.deploymentId, ids.commitSha, ids.artifactSha256, ids.approvalSha256]);
pass();
await controller.prepareAdmission({ ...ids, mode: 'preview', checkedAt: now, validUntil: later, previewDeadline: later });
assert.match(calls.at(-1).text, /prepare_admission\(\$1,\$2,\$3,\$4,\$5,\$6::timestamptz/);
assert.equal(calls.at(-1).values[3], 'preview');
pass();

const recorder = createPublicationGuardSqlAdapter({ role: 'recorder', query });
assert.deepEqual(Object.keys(recorder).sort(), ['enforcementActive', 'publicationAuthorized', 'recordVerifiedReceipt', 'role'].sort());
await recorder.recordVerifiedReceipt(ids);
assert.match(calls.at(-1).text, /record_verified_receipt\(\$1,\$2,\$3,\$4\)/);
assert.equal(calls.at(-1).values[3], ids.receiptSha256);
pass();

const revoker = createPublicationGuardSqlAdapter({ role: 'revoker', query });
assert.deepEqual(Object.keys(revoker).sort(), ['enforcementActive', 'publicationAuthorized', 'revokeAdmission', 'revokeRelease', 'role'].sort());
await revoker.revokeRelease(ids);
assert.match(calls.at(-1).text, /revoke_release\(\$1\)/);
await revoker.revokeAdmission(ids);
assert.match(calls.at(-1).text, /revoke_admission\(\$1,\$2,\$3\)/);
pass();

hold(() => createPublicationGuardSqlAdapter({ role: 'reader' }), 'HOLD_DATABASE_ADAPTER');
await assert.rejects(() => reader.readSnapshot({ revision: '0', entries: [{ path: ids.path, sourceSha256: 'bad' }] }), (error) => error.code === 'HOLD_DATABASE_ENTRIES');
pass();
await assert.rejects(() => controller.authorizeRelease({ ...ids, commitSha: 'bad', expiresAt: later }), (error) => error.code === 'HOLD_DATABASE_ARGUMENT');
pass();
await assert.rejects(() => controller.prepareAdmission({ ...ids, mode: 'preview', checkedAt: later, validUntil: now, previewDeadline: later }), (error) => error.code === 'HOLD_DATABASE_WRITE');
// The database contract, not this structural adapter, decides temporal ordering. The fake query proves values remain bound parameters.
assert.equal(calls.at(-1).values[5], later);
assert.equal(calls.at(-1).values[6], now);
pass();

const malformedQuery = async () => ({ rows: [] });
const malformedReader = createPublicationGuardSqlAdapter({ role: 'reader', query: malformedQuery });
await assert.rejects(() => malformedReader.readSnapshot({ revision: '0', entries: [] }), (error) => error.code === 'HOLD_DATABASE_SNAPSHOT');
pass();

assert.equal(calls.every((call) => !call.text.includes(secret)), true);
assert.equal(calls.every((call) => call.values.every((value) => value !== secret)), true);
pass();

console.log(`publication postgres adapter tests pass (${groups} groups)`);