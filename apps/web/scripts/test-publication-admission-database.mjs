import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createPublicationServingPolicy, SERVING_SCOPE } from '../src/lib/publication-serving-policy.js';

// Real embedded PostgreSQL and temporary on-disk storage; no Supabase/network access.
const directory = await mkdtemp(join(tmpdir(), 'publication-admissions-558-'));
let db = new PGlite(join(directory, 'data'));
let count = 0;
const sha = (value) => createHash('sha256').update(value).digest('hex');
const time = (offset) => new Date(Date.now() + offset).toISOString();
const h = (letter) => letter.repeat(64);
const sql = await readFile(new URL('../docs/sql/publication-admission-contract-558.sql', import.meta.url), 'utf8');
async function test(name, fn) {
  try { await fn(); count++; }
  catch (error) { console.error(`Failed database contract: ${name}`); throw error; }
}
async function rejects(query, params, pattern) {
  await assert.rejects(() => db.query(query, params), (error) => pattern.test(error.message));
}
async function revision() {
  return (await db.query('select revision::text as revision from publication_guard.history_state')).rows[0].revision;
}
async function release(overrides = {}) {
  const row = { release_id: randomUUID(), repository: SERVING_SCOPE.repository, project_id: SERVING_SCOPE.projectId,
    team_id: SERVING_SCOPE.teamId, deployment_id: 'dpl_DatabaseFixtureA', commit_sha: 'a'.repeat(40),
    artifact_sha256: h('b'), approval_sha256: h('c'), expires_at: time(600000), ...overrides };
  const fields = Object.keys(row);
  await db.query(`insert into publication_guard.release_authorizations (${fields.join(',')}) values (${fields.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(row));
  return row;
}
async function prepare(r, overrides = {}) {
  const row = { path: `/news/catalysts/fixture-${randomUUID()}`, source_sha256: h('d'), release_id: r.release_id,
    event_mode: 'preview', evidence_sha256: h('e'), calendar_checked_at: time(-5000), calendar_valid_until: time(500000),
    preview_deadline: time(600000), not_before: null, ...overrides };
  const fields = Object.keys(row);
  await db.query(`insert into publication_guard.publication_admissions (${fields.join(',')}) values (${fields.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(row));
  return row;
}
async function finish(row, receipt = h('f'), id = row.release_id) {
  return (await db.query('select publication_guard.finalize_admission($1,$2,$3,$4) as result', [id, row.path, row.source_sha256, receipt])).rows[0].result;
}
async function get(row) {
  return (await db.query('select * from publication_guard.publication_admissions where path=$1 and source_sha256=$2', [row.path,row.source_sha256])).rows[0];
}
async function history(keys, rev = null) {
  return (await db.query('select publication_guard.read_history($1,$2::jsonb) as snapshot', [rev ?? await revision(), JSON.stringify(keys)])).rows[0].snapshot;
}
const key = (row) => ({ path: row.path, sourceSha256: row.source_sha256 });
let original;
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await test('prototype applies to isolated PostgreSQL', () => db.exec(sql));
  await test('private tables have RLS with no application policies', async () => {
    const rows = (await db.query("select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='publication_guard' and c.relkind='r'")).rows;
    assert.equal(rows.length,3); assert(rows.every((r) => r.relrowsecurity));
    assert.equal((await db.query("select count(*)::int as n from pg_policies where schemaname='publication_guard'")).rows[0].n,0);
  });
  await test('no SECURITY DEFINER functions or public-schema changes', async () => {
    assert.equal((await db.query("select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='publication_guard' and p.prosecdef")).rows[0].n,0);
    assert.equal((await db.query("select count(*)::int as n from pg_tables where schemaname='public'")).rows[0].n,0);
  });
  for (const role of ['anon','authenticated','service_role']) {
    await test(`${role} cannot read, mint or invoke the private history`, async () => {
      await db.exec(`set role ${role}`);
      try {
        for (const statement of [
          'select * from publication_guard.publication_admissions',
          'insert into publication_guard.publication_admissions(path) values (\'/news/2026-09-10\')',
          "select publication_guard.finalize_admission(null,null,null,null)",
          "select publication_guard.read_history('0','[]'::jsonb)",
        ]) await rejects(statement, [], /permission denied/i);
      } finally { await db.exec('reset role'); }
    });
  }
  const r = await release();
  await test('release authorization alone creates no admission', async () => {
    assert.equal((await db.query('select count(*)::int as n from publication_guard.publication_admissions')).rows[0].n,0);
  });
  for (const [name,patch,pattern] of [
    ['wrong project',{project_id:'other'},/check constraint/],
    ['wrong repository',{repository:'other/repo'},/check constraint/],
    ['bad artifact',{artifact_sha256:'not-a-hash'},/check constraint/],
    ['forged release time',{created_at:time(-86400000)},/HOLD_SERVER_TIME_REQUIRED/],
    ['expired approval',{expires_at:time(-5000)},/HOLD_APPROVAL_EXPIRED/],
    ['overlong approval',{expires_at:time(3600000)},/HOLD_APPROVAL_EXPIRED/],
  ]) await test(name, () => assert.rejects(() => release(patch),pattern));
  await test('authorization binding cannot be rewritten', () => rejects('update publication_guard.release_authorizations set artifact_sha256=$1 where release_id=$2',[h('a'),r.release_id],/HOLD_IMMUTABLE_RELEASE/));
  await test('authorization cannot be deleted', () => rejects('delete from publication_guard.release_authorizations where release_id=$1',[r.release_id],/HOLD_IMMUTABLE_RELEASE/));
  original = await prepare(r);
  await test('pending record is explicit and has no admitted timestamp', async () => {
    const row=await get(original); assert.equal(row.state,'pending'); assert.equal(row.admitted_at,null); assert.equal(row.response_receipt_sha256,null);
    const snapshot=await history([key(original)]); assert.equal(snapshot.records[0].record.state,'pending');
  });
  await test('missing records remain null', async () => {
    const snapshot=await history([{path:'/news/catalysts/missing-fixture',sourceSha256:h('a')}]);
    assert.equal(snapshot.records[0].record,null);
  });
  for (const [name,patch,pattern] of [
    ['direct admitted insert',{state:'admitted'},/HOLD_PENDING_REQUIRED/],
    ['backdated pending time',{prepared_at:time(-86400000)},/HOLD_PENDING_REQUIRED/],
    ['backdated admitted time',{admitted_at:time(-86400000)},/HOLD_PENDING_REQUIRED/],
    ['source hash invalid',{source_sha256:'g'.repeat(64)},/check constraint/],
    ['unsupported route',{path:'/account'},/check constraint/],
    ['past preview',{preview_deadline:time(-5000)},/HOLD_PREVIEW_EXPIRED/],
    ['future evidence',{calendar_checked_at:time(60000)},/HOLD_EVIDENCE_EXPIRED/],
    ['expired evidence',{calendar_valid_until:time(-1000)},/HOLD_EVIDENCE_EXPIRED/],
    ['overlong evidence',{calendar_checked_at:time(-1200000)},/check constraint/],
    ['outcome before release',{event_mode:'outcome',preview_deadline:null,not_before:time(60000)},/HOLD_OUTCOME_NOT_RELEASED/],
    ['missing outcome instant',{event_mode:'outcome',preview_deadline:null},/check constraint/],
    ['preview missing deadline',{preview_deadline:null},/check constraint/],
    ['no-calendar brief',{event_mode:'none',preview_deadline:null},/check constraint/],
    ['unknown mode',{event_mode:'unverified'},/check constraint/],
  ]) await test(name, () => assert.rejects(() => prepare(r,patch),pattern));
  await test('unknown release cannot prepare', () => assert.rejects(() => prepare({...r,release_id:randomUUID()}),/HOLD_RELEASE_UNAUTHORIZED/));
  await test('duplicate exact-content preparation cannot overwrite evidence', () => assert.rejects(() => prepare(r,original),/duplicate key/));
  await test('same release and route cannot stage changed bytes', () => assert.rejects(() => prepare(r,{...original,source_sha256:h('a')}),/duplicate key/));
  await test('missing response receipt cannot finalize', () => assert.rejects(() => finish(original,null),/HOLD_INVALID_REQUEST/));
  await test('wrong release cannot finalize', async () => {
    const other=await release(); await assert.rejects(() => finish(original,h('f'),other.release_id),/HOLD_ADMISSION_NOT_PREPARED/);
  });
  await test('pending evidence cannot be modified', () => rejects('update publication_guard.publication_admissions set evidence_sha256=$1 where path=$2',[h('a'),original.path],/HOLD_IMMUTABLE_ADMISSION/));
  await test('caller cannot supply admitted time', () => rejects("update publication_guard.publication_admissions set state='admitted',response_receipt_sha256=$1,admitted_at=clock_timestamp() where path=$2",[h('f'),original.path],/HOLD_SERVER_TIME_REQUIRED/));
  await test('successful finalization uses database time', async () => {
    assert.equal(await finish(original),'RECORDED'); const row=await get(original);
    assert.equal(row.state,'admitted'); assert(row.admitted_at>=row.prepared_at); assert(row.admitted_at<new Date(row.calendar_valid_until));
  });
  await test('retry preserves original admission time and history revision', async () => {
    const before=await get(original);const rev=await revision(); assert.equal(await finish(original),'ALREADY_RECORDED');
    assert.deepEqual(await get(original),before);assert.equal(await revision(),rev);
  });
  await test('conflicting receipt is not a duplicate success', () => assert.rejects(() => finish(original,h('a')),/HOLD_RECEIPT_CONFLICT/));
  await test('admitted source is immutable', () => rejects('update publication_guard.publication_admissions set source_sha256=$1 where path=$2',[h('a'),original.path],/HOLD_IMMUTABLE_ADMISSION/));
  await test('admission deletion is rejected', () => rejects('delete from publication_guard.publication_admissions where path=$1',[original.path],/HOLD_IMMUTABLE_ADMISSION/));
  await test('same clock snapshot supplies complete ordered records', async () => {
    const missing={path:'/news/catalysts/missing-fixture',sourceSha256:h('a')};const rev=await revision();
    const snap=await history([missing,key(original)],rev);assert.equal(snap.revision,rev);assert.equal(snap.records.length,2);
    assert.equal(snap.records[0].record,null);assert.equal(snap.records[1].record.state,'admitted');
  });
  await test('outdated history revision fails closed', () => assert.rejects(() => history([key(original)],'0'),/HOLD_HISTORY_REVISION/));
  for (const invalid of [null,{},[{}],[{...key(original),extra:true}],[key(original),key(original)],Array(501).fill(key(original))]) {
    await test('invalid or duplicate history keys are rejected', () => assert.rejects(() => history(invalid),/HOLD_INVALID_KEYS|HOLD_DUPLICATE_KEYS/));
  }
  await test('transaction rollback removes finalization and its revision', async () => {
    const pending=await prepare(r);const rev=await revision(); await db.exec('begin');
    assert.equal(await finish(pending),'RECORDED'); await db.exec('rollback');
    assert.equal((await get(pending)).state,'pending');assert.equal(await revision(),rev);
  });
  await test('waiting transaction cannot use its start time after preview expiry', async () => {
    const pending=await prepare(r,{preview_deadline:time(250)});await db.exec('begin');
    try { await db.exec('select pg_sleep(0.35)');await assert.rejects(() => finish(pending),/HOLD_PREVIEW_EXPIRED/); }
    finally {await db.exec('rollback');}
    assert.equal((await get(pending)).state,'pending');
  });
  await test('expired approval cannot finalize an earlier preparation', async () => {
    const short=await release({expires_at:time(250)});const pending=await prepare(short);
    await db.exec('select pg_sleep(0.35)');await assert.rejects(() => finish(pending),/HOLD_APPROVAL_EXPIRED/);
  });
  await test('expired evidence cannot finalize an earlier preparation', async () => {
    const pending=await prepare(r,{calendar_valid_until:time(250)});
    await db.exec('select pg_sleep(0.35)');await assert.rejects(() => finish(pending),/HOLD_EVIDENCE_EXPIRED/);
  });
  await test('matching outcome can be recorded after its minimum release time', async () => {
    const row=await prepare(r,{event_mode:'outcome',preview_deadline:null,not_before:time(-60000)});
    assert.equal(await finish(row),'RECORDED');assert.equal((await history([key(row)])).records[0].record.previewDeadline,null);
  });
  await test('no-calendar Daily stays explicitly uncertified', async () => {
    const row=await prepare(r,{path:'/news/2026-09-10',event_mode:'none',preview_deadline:null});
    await finish(row);const record=(await history([key(row)])).records[0].record;
    assert.equal(record.basis,'no-calendar-entries');assert.equal(record.calendarVerified,false);
  });
  await test('expired release approval does not erase an earlier recorded archive', async () => {
    const short=await release({expires_at:time(250)});const row=await prepare(short);await finish(row);
    const before=await get(row);await db.exec('select pg_sleep(0.35)');
    assert.equal(await finish(row),'ALREADY_RECORDED');assert.deepEqual(await get(row),before);
    assert.equal((await history([key(row)])).records[0].record.state,'admitted');
  });
  await test('whole-release revocation also removes recorded publication eligibility', async () => {
    const auth=await release();const row=await prepare(auth);await finish(row);
    await db.query('update publication_guard.release_authorizations set revoked_at=clock_timestamp() where release_id=$1',[auth.release_id]);
    assert.equal((await history([key(row)])).records[0].record.state,'revoked');
    await assert.rejects(() => finish(row),/HOLD_RELEASE_UNAUTHORIZED/);
  });
  await test('an unsuccessful transaction cannot advance history', async () => {
    const before=await revision();await assert.rejects(() => prepare(r,{preview_deadline:time(-5000)}),/HOLD_PREVIEW_EXPIRED/);
    assert.equal(await revision(),before);
  });
  await test('revoked release blocks pending admissions', async () => {
    const revoked=await release();const pending=await prepare(revoked);
    await db.query('update publication_guard.release_authorizations set revoked_at=clock_timestamp() where release_id=$1',[revoked.release_id]);
    await assert.rejects(() => finish(pending),/HOLD_RELEASE_UNAUTHORIZED/);
    assert.equal((await history([key(pending)])).records[0].record.state,'revoked');
    await rejects('update publication_guard.release_authorizations set revoked_at=null where release_id=$1',[revoked.release_id],/HOLD_IMMUTABLE_RELEASE/);
  });
  await test('admitted content can be revoked but never revived', async () => {
    const row=await prepare(r);await finish(row);const before=await get(row);
    await db.query("update publication_guard.publication_admissions set state='revoked' where path=$1",[row.path]);
    assert.deepEqual((await get(row)).admitted_at,before.admitted_at);
    await assert.rejects(() => finish(row),/HOLD_REVOKED/);
    await rejects("update publication_guard.publication_admissions set state='admitted' where path=$1",[row.path],/HOLD_INVALID_TRANSITION/);
  });
  await test('recorded rows survive close and reopen without being re-admitted', async () => {
    const before=await get(original);const rev=await revision();await db.close();db=new PGlite(join(directory,'data'));
    assert.deepEqual(await get(original),before);assert.equal(await revision(),rev);assert.equal(await finish(original),'ALREADY_RECORDED');
  });
  await test('SQL history feeds the existing policy without certifying a pending row', async () => {
    const released=time(600000);const payload={status:'published',category:'USD Impact Catalyst Brief',slug:'/news/catalysts/database-policy-fixture',
      title:'Synthetic fixture only',phase:'preview',statusLabel:'scheduled-confirmed',calendar:{publisher:'BLS',series:'CPI',releaseStage:'initial',releaseAt:released}};
    const source=`---\n${Object.entries(payload).map(([k,v])=>`${k}: ${JSON.stringify(v)}`).join('\n')}\n---\nSynthetic body.`;
    const row=await prepare(r,{path:payload.slug,source_sha256:sha(source),preview_deadline:released});
    const entries=[{path:row.path,sourceSha256:row.source_sha256}];
    const policy=createPublicationServingPolicy({loadAuthority:async()=>({...SERVING_SCOPE,schema:'publication-serving-authority/v1',target:'production',exposure:'public-approved',
      deploymentId:r.deployment_id,commitSha:r.commit_sha,artifactSha256:r.artifact_sha256,historyRevision:await revision(),
      observedAt:time(0),validUntil:time(10000),entries,manifestSha256:sha(JSON.stringify(entries)),legacyBaseline:null}),
      readHistory:({revision:rev,entries:keys})=>history(keys,rev)});
    assert.equal(policy.project(await policy.inspect([source])).view.items.length,0);
    await finish(row);assert.equal(policy.project(await policy.inspect([source])).view.items.length,1);
    await db.query("update publication_guard.publication_admissions set state='revoked' where path=$1",[row.path]);
    assert.equal(policy.project(await policy.inspect([source])).view.items.length,0);
  });
  console.log(`Publication admission database: ${count} groups passed (PGlite PostgreSQL, temporary persistent storage, synthetic evidence; no live admission or Supabase writes).`);
} finally {await db.close();await rm(directory,{recursive:true,force:true});}
