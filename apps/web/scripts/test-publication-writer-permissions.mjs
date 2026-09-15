import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Isolated embedded engine only. No URL, credentials, server or environment reader.
const db = new PGlite();
const tests = [];
const h = (x) => x.repeat(64);
const roles = ['reader', 'controller', 'recorder', 'revoker'];
const q = async (sql, values = []) => (await db.query(sql, values)).rows;
const scalar = async (sql, values = []) => Object.values((await q(sql, values))[0])[0];
async function test(name, work) {
  try { await work(); tests.push(name); }
  catch (error) { console.error(`Failed governed writer test: ${name}`); throw error; }
}
async function as(role, work) {
  assert(['postgres', 'anon', 'authenticated', 'service_role', ...roles.map((r) => `fx558_${r}`)].includes(role));
  await db.exec(`SET SESSION AUTHORIZATION ${role}`);
  try { assert.equal(await scalar('select current_user'), role); return await work(); }
  finally { await db.exec('SET SESSION AUTHORIZATION postgres'); assert.equal(await scalar('select current_user'), 'postgres'); }
}
const rejects = (work, code) => assert.rejects(work, (error) => error.message.includes(code));
const denied = (sql, values = []) => assert.rejects(() => q(sql, values), (error) => error.code === '42501');
const rev = () => scalar('select revision::text from publication_guard.history_state');
const row = (x) => scalar('select row_to_json(a) from publication_guard.publication_admissions a where path=$1 and source_sha256=$2', [x.path, x.source]);
const release = (x) => scalar('select row_to_json(r) from publication_guard.release_authorizations r where release_id=$1', [x.id]);
const authArgs = (x) => [x.id, x.deployment, x.commit, x.artifact, x.approval, x.expires];
const prepArgs = (x) => [x.id, x.path, x.source, x.mode, x.evidence, x.checked, x.until, x.deadline, x.notBefore];
const commands = {
  authorize: ['fx558_controller', 'select publication_guard_api.authorize_release($1,$2,$3,$4,$5,$6)', authArgs],
  prepare: ['fx558_controller', 'select publication_guard_api.prepare_admission($1,$2,$3,$4,$5,$6,$7,$8,$9)', prepArgs],
  record: ['fx558_recorder', 'select publication_guard_api.record_verified_receipt($1,$2,$3,$4)', (x) => [x.id,x.path,x.source,x.receipt]],
  revokeRelease: ['fx558_revoker', 'select publication_guard_api.revoke_release($1)', (x) => [x.id]],
  revokeItem: ['fx558_revoker', 'select publication_guard_api.revoke_admission($1,$2,$3)', (x) => [x.id,x.path,x.source]],
};
async function op(name, x) {
  const [role,sql,args] = commands[name]; return as(role, () => scalar(sql,args(x)));
}
async function fixture(patch = {}) {
  const dates = (await q("select clock_timestamp()+interval '10 minutes' as expires, clock_timestamp()-interval '1 second' as checked, clock_timestamp()+interval '8 minutes' as until, clock_timestamp()+interval '9 minutes' as deadline"))[0];
  return { id: randomUUID(), path: `/news/catalysts/fixture-${randomUUID()}`, source:h('d'), mode:'preview', evidence:h('e'),
    receipt:h('f'), deployment:'dpl_WriterLocalFixture', commit:'a'.repeat(40), artifact:h('b'), approval:h('c'), notBefore:null, ...dates, ...patch };
}
async function seeded(patch={}) { const x=await fixture(patch); await op('authorize',x); await op('prepare',x); return x; }
const read = async (x) => {
  const revision=await rev();
  return as('fx558_reader', () => scalar('select publication_guard_api.read_snapshot($1,$2::jsonb)', [revision, JSON.stringify([{path:x.path,sourceSha256:x.source}])]));
};

try {
  const baseline=await readFile(new URL('../docs/sql/publication-admission-contract-558.sql',import.meta.url),'utf8');
  assert.equal(createHash('sha256').update(baseline).digest('hex'),'a64a5605b62b2eabbe6b121dc3207504a1f3ba422dbf9849dc6925c4d6f1ef33');
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await db.exec(baseline);
  const baselineDefinitions=await q("select p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='publication_guard' order by p.proname");
  await test('candidate installs only into the isolated engine', async () => db.exec(await readFile(new URL('../docs/sql/publication-writer-api-contract-558.sql',import.meta.url),'utf8')));
  await test('six original invoker functions remain unchanged', async () => assert.deepEqual(await q("select p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='publication_guard' order by p.proname"),baselineDefinitions));
  await test('eight logical roles have no login or administrative privileges',async()=>{
    const records=await q("select rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication from pg_roles where rolname like 'fx558_%'");
    assert.equal(records.length,8);
    for(const record of records) for(const key of ['rolcanlogin','rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication']) assert.equal(record[key],false);
    assert.equal(await scalar("select count(*)::int from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname like 'fx558_%'"),0);
  });
  await test('owners own no protected table and cannot create API objects',async()=>{
    assert.equal(await scalar("select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_roles r on r.oid=c.relowner where n.nspname='publication_guard' and r.rolname like 'fx558_%'"),0);
    for(const role of roles) assert.equal(await scalar("select has_schema_privilege($1,'publication_guard_api','CREATE')",[`fx558_${role}_owner`]),false);
  });
  await test('all entry points have hardened configuration and a common first lock',async()=>{
    const records=await q("select p.proname,p.prosecdef,p.prosrc,p.proconfig,p.proowner::regrole::text as owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='publication_guard_api'");
    assert.equal(records.length,7); assert.equal(records.filter((r)=>r.prosecdef).length,6);
    for(const record of records) {
      assert(record.proconfig.includes('search_path=""')); assert(record.proconfig.includes('row_security=on'));
      assert(!/\bEXECUTE\b/i.test(record.prosrc));
      if(record.prosecdef && record.proname!=='read_snapshot') {
        assert(record.proconfig.includes('lock_timeout=2s'));
        const gate=record.prosrc.indexOf('PERFORM publication_guard_api.acquire_writer_gate();');
        assert(gate>=0);
        const firstPrivateRead=record.prosrc.indexOf('FROM publication_guard.');
        assert(firstPrivateRead<0 || gate<firstPrivateRead);
      }
    }
  });
  await test('private baseline tables retain row security',async()=>{
    const records=await q("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='publication_guard' and relkind='r'");
    assert.equal(records.length,3); assert(records.every((r)=>r.relrowsecurity));
  });
  const x=await fixture();
  for(const role of ['anon','authenticated','service_role',...roles.map((r)=>`fx558_${r}`)]) {
    await test(`${role} has no raw state, direct gate, original finalizer or owner access`,()=>as(role,async()=>{
      for(const sql of ['select * from publication_guard.history_state','update publication_guard.history_state set revision=0',
        'select * from publication_guard.release_authorizations for update','select * from publication_guard.publication_admissions for update',
        'truncate publication_guard.history_state','alter table publication_guard.publication_admissions disable row level security',
        'create table publication_guard_api.spoof(x int)','select publication_guard_api.acquire_writer_gate()',
        'select publication_guard.finalize_admission(null,null,null,null)']) await denied(sql);
      for(const owner of roles) await denied(`SET ROLE fx558_${owner}_owner`);
    }));
    await test(`${role} cannot use another capability`,()=>as(role,async()=>{
      for(const [expected,sql,args] of Object.values(commands)) if(expected!==role) await denied(sql,args(x));
      if(role!=='fx558_reader') await denied("select publication_guard_api.read_snapshot('0','[]')");
    }));
  }
  await test('release authorization creates no admission',async()=>{
    assert.equal(await op('authorize',x),'AUTHORIZED_PENDING_ONLY');
    assert.equal(await scalar('select count(*)::int from publication_guard.publication_admissions'),0);
  });
  await test('exact authorization replay preserves timestamps and history',async()=>{
    const before=await release(x),revision=await rev();assert.equal(await op('authorize',x),'ALREADY_AUTHORIZED');
    assert.deepEqual(await release(x),before);assert.equal(await rev(),revision);
  });
  for(const [key,value] of [['artifact',h('a')],['approval',h('a')],['commit','b'.repeat(40)],['deployment','dpl_DifferentFixture'],['expires',new Date(Date.now()+60000)]]) {
    await test(`authorization ${key} cannot be replaced`,async()=>{
      const before=await release(x),revision=await rev();await rejects(()=>op('authorize',{...x,[key]:value}),'HOLD_AUTHORIZATION_CONFLICT');
      assert.deepEqual(await release(x),before);assert.equal(await rev(),revision);
    });
  }
  await test('preparation creates pending only',async()=>{
    assert.equal(await op('prepare',x),'PREPARED_NOT_ADMITTED');const record=await row(x);
    assert.equal(record.state,'pending');assert.equal(record.admitted_at,null);assert.equal(record.response_receipt_sha256,null);
  });
  await test('exact preparation replay cannot refresh evidence or preparation time',async()=>{
    const before=await row(x),revision=await rev();assert.equal(await op('prepare',x),'ALREADY_PREPARED');
    assert.deepEqual(await row(x),before);assert.equal(await rev(),revision);
  });
  for(const [key,value] of [['source',h('a')],['evidence',h('a')],['until',x.expires],['mode','outcome'],['deadline',x.until]]) {
    await test(`preparation ${key} cannot be replaced`,async()=>{
      const before=await row(x),revision=await rev();await rejects(()=>op('prepare',{...x,[key]:value}),'HOLD_PREPARATION_CONFLICT');
      assert.deepEqual(await row(x),before);assert.equal(await rev(),revision);
    });
  }
  for(const [patch,code] of [
    [{deadline:new Date(Date.now()-60000)},'HOLD_PREVIEW_EXPIRED'],
    [{checked:new Date(Date.now()+60000)},'HOLD_EVIDENCE_EXPIRED'],
    [{until:new Date(Date.now()-60000)},'HOLD_EVIDENCE_EXPIRED'],
    [{mode:'outcome',deadline:null,notBefore:new Date(Date.now()+60000)},'HOLD_OUTCOME_NOT_RELEASED'],
    [{mode:'preview',deadline:null},'check constraint'],
    [{mode:'none',deadline:null},'check constraint'],
    [{path:'/account'},'HOLD_INVALID_REQUEST'],
    [{source:'bad'},'HOLD_INVALID_REQUEST'],
  ]) await test(`invalid preparation holds ${code}`,async()=>{
    const f=await fixture(patch);await op('authorize',f);const revision=await rev();
    await rejects(()=>op('prepare',f),code);assert.equal(await rev(),revision);
    assert.equal(await scalar('select count(*)::int from publication_guard.publication_admissions where path=$1',[f.path]),0);
  });
  await test('reader observes pending through bounded history function',async()=>assert.equal((await read(x)).records[0].record.state,'pending'));
  await test('recorder finalizes and exact replay preserves state',async()=>{
    assert.equal(await op('record',x),'RECORDED');const before=await row(x),revision=await rev();
    assert.equal(await op('record',x),'ALREADY_RECORDED');assert.deepEqual(await row(x),before);assert.equal(await rev(),revision);
    assert.equal((await read(x)).records[0].record.state,'admitted');
  });
  await test('conflicting receipt and wrong content are rejected',async()=>{
    await rejects(()=>op('record',{...x,receipt:h('a')}),'HOLD_RECEIPT_CONFLICT');
    await rejects(()=>op('record',{...x,source:h('a')}),'HOLD_ADMISSION_NOT_PREPARED');
  });
  await test('missing receipt and unknown binding are rejected',async()=>{
    await rejects(()=>op('record',{...x,receipt:null}),'HOLD_INVALID_REQUEST');
    await rejects(()=>op('revokeItem',{...x,source:h('a')}),'HOLD_ADMISSION_NOT_PREPARED');
  });
  await test('item revocation is irreversible and idempotent',async()=>{
    assert.equal(await op('revokeItem',x),'REVOKED');const before=await row(x),revision=await rev();
    assert.equal(await op('revokeItem',x),'ALREADY_REVOKED');assert.deepEqual(await row(x),before);assert.equal(await rev(),revision);
    await rejects(()=>op('record',x),'HOLD_REVOKED');await rejects(()=>op('prepare',x),'HOLD_REVOKED');
  });
  await test('release revocation blocks all future preparation and recording',async()=>{
    const f=await seeded();assert.equal(await op('revokeRelease',f),'REVOKED');const before=await release(f),revision=await rev();
    assert.equal(await op('revokeRelease',f),'ALREADY_REVOKED');assert.deepEqual(await release(f),before);assert.equal(await rev(),revision);
    await rejects(()=>op('record',f),'HOLD_RELEASE_UNAUTHORIZED');await rejects(()=>op('prepare',f),'HOLD_RELEASE_UNAUTHORIZED');
    await rejects(()=>op('authorize',f),'HOLD_RELEASE_UNAUTHORIZED');assert.equal((await read(f)).records[0].record.state,'revoked');
  });
  await test('caller cannot disable wrapper row security or substitute search path',async()=>{
    const f=await seeded();await as('fx558_recorder',async()=>{
      await db.exec('SET row_security=off; SET search_path=pg_temp,public;');
      try { assert.equal(await scalar(commands.record[1],commands.record[2](f)),'RECORDED'); }
      finally {await db.exec('RESET row_security; RESET search_path');}
    });
  });
  await test('no-calendar Daily remains uncertified',async()=>{
    const f=await seeded({path:'/news/2026-09-10',mode:'none',deadline:null});await op('record',f);
    assert.equal((await read(f)).records[0].record.calendarVerified,false);
  });
  await test('matching outcome can be recorded after release',async()=>{
    const f=await seeded({mode:'outcome',deadline:null,notBefore:new Date(Date.now()-60000)});
    assert.equal(await op('record',f),'RECORDED');
  });
  await test('rolled-back writer leaves record and history unchanged',async()=>{
    const f=await seeded();const before=await row(f),revision=await rev();await db.exec('BEGIN');
    try {assert.equal(await op('record',f),'RECORDED');} finally {await db.exec('ROLLBACK');}
    assert.deepEqual(await row(f),before);assert.equal(await rev(),revision);
  });
  await test('missing history gate fails closed',async()=>{
    const f=await seeded();await db.exec('BEGIN; DELETE FROM publication_guard.history_state; SET SESSION AUTHORIZATION fx558_recorder;');
    try {await rejects(()=>scalar(commands.record[1],commands.record[2](f)),'HOLD_HISTORY_UNAVAILABLE');}
    finally {await db.exec('ROLLBACK; SET SESSION AUTHORIZATION postgres;');assert.equal(await scalar('select current_user'),'postgres');}
  });
  console.log(`Publication governed writers: ${tests.length} embedded SQL groups passed (local synthetic evidence; no native concurrency or live grants).`);
} finally { await db.close(); }
