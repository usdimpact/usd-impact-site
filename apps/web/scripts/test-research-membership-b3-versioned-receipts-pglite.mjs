// B-3: PGlite SINGLE SESSION ONLY, NOT real concurrent PostgreSQL proof.
// No connected Supabase, provider, payments, or Production I/O.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const sqlPath = new URL('../../../docs/operations/research-b3-versioned-receipts-pglite-review-2026-11-04.sql', import.meta.url);
const sql = await readFile(sqlPath, 'utf8');
assert.match(sql, /REVIEW \/ OFFLINE TEST ONLY/);
assert.match(sql, /create schema research_receipt_review/);
assert.doesNotMatch(sql, /create schema research_private\s*;/i);
const db = new PGlite();
const query = async (s, args = []) => (await db.query(s,args)).rows;
async function rpc(name,args) {
  const placeholders = args.map((_,i) => '$' + (i+1)).join(', ');
  const rows = await query('select research_receipt_review.'+name+'('+placeholders+') as result', args);
  return rows[0].result;
}
const begin = (id,version='research-receipt-business-v3',hash='a'.repeat(64)) =>
  rpc('begin_review_receipt',[id,'subscription_created',version,hash]);
const finish = (r,status,code=null) =>
  rpc('finish_review_receipt',[r.receipt_id,r.attempt_count,r.lease_token,status,code]);
const journal = async () => query('select conflict_code,provider_event_id,attempt_count from research_receipt_review.conflict_observations order by observed_at,id');
async function rejected(fn, expected = /append-only/) {
  let error; try {await fn();} catch(e){error=e;}
  assert.ok(error,'append-only evidence must reject mutations');
  assert.match(String(error?.message??error), expected);
}
try {
  await db.exec(sql);

  // V1: version and checksum must BOTH be stored.
  const a = await begin('review:event-a');
  assert.equal(a.disposition,'acquired');
  assert.equal(a.attempt_count,1);
  assert.ok(a.receipt_id && a.lease_token);
  const row = (await query('select fingerprint_version,fingerprint_sha256 from research_receipt_review.receipts where provider_event_id=$1',['review:event-a']))[0];
  assert.equal(row.fingerprint_version,'research-receipt-business-v3');
  assert.equal(row.fingerprint_sha256,'a'.repeat(64));

  assert.equal((await begin('review:event-a')).disposition,'in_progress');
  assert.equal((await begin('review:event-a',undefined,'b'.repeat(64))).disposition,'semantic_conflict');
  const mismatched = await begin('review:event-a','research-receipt-business-v2','c'.repeat(64));
  assert.equal(mismatched.disposition,'version_mismatch');
  assert.equal(mismatched.stored_version,'research-receipt-business-v3');
  assert.equal((await begin('review:unknown','research-receipt-business-v99','d'.repeat(64))).disposition,'unsupported_version');

  // Correct finish, idempotent finish, stale finish and terminal hash rejection.
  assert.equal((await finish(a,'processed')).disposition,'applied');
  assert.equal((await finish(a,'processed')).disposition,'already_applied');
  assert.equal((await finish(a,'failed','duplicate_paid_subscription')).disposition,'stale_attempt');
  assert.equal((await begin('review:event-a')).disposition,'terminal_duplicate');
  assert.equal((await begin('review:event-a',undefined,'e'.repeat(64))).disposition,'semantic_conflict');

  // RC8: failure remains in separate append-only journal after retry.
  const b=await begin('review:event-b');
  assert.equal((await finish(b,'failed','duplicate_paid_subscription')).disposition,'applied');
  const before=(await journal()).filter(r=>r.provider_event_id==='review:event-b');
  assert.equal(before.length,1);
  assert.equal(before[0].conflict_code,'duplicate_paid_subscription');
  const retry=await begin('review:event-b');
  assert.equal(retry.disposition,'acquired');
  assert.equal(retry.attempt_count,2);
  assert.notEqual(retry.lease_token,b.lease_token);
  assert.equal((await finish(retry,'processed')).disposition,'applied');
  assert.deepEqual((await journal()).filter(r=>r.provider_event_id==='review:event-b'), before);
  assert.equal((await finish(b,'failed','duplicate_paid_subscription')).disposition,'stale_attempt');

  // Simulated expired lease: NO actual concurrent workers.
  const c=await begin('review:event-c');
  await query("update research_receipt_review.receipts set lease_expires_at=transaction_timestamp()-interval '1 second' where id=$1",[c.receipt_id]);
  const second=await begin('review:event-c');
  assert.equal(second.disposition,'acquired');
  assert.equal(second.attempt_count,2);
  assert.equal((await finish(c,'failed','receipt_completion_conflict')).disposition,'stale_attempt');
  assert.equal((await finish(second,'processed')).disposition,'applied');
  assert.equal((await finish(second,'processed')).disposition,'already_applied');
  const cs=(await query('select status from research_receipt_review.receipts where id=$1',[c.receipt_id]))[0].status;
  assert.equal(cs,'processed');

  // Appendix-only journal: updates, deletes and truncation refused.
  const count=(await query('select count(*)::integer as c from research_receipt_review.conflict_observations'))[0].c;
  assert.ok(count>=4);
  await rejected(()=>query("update research_receipt_review.conflict_observations set conflict_code='foreign_invoice'"));
  await rejected(()=>query('delete from research_receipt_review.conflict_observations'));
  // PostgreSQL may reject this TRUNCATE through a referring FK BEFORE reaching our trigger.
  // Both protections are valid rejections; the resolution table below verifies the trigger.
  await rejected(()=>query('truncate research_receipt_review.conflict_observations'),
    /append-only|cannot truncate a table referenced in a foreign key constraint/);
  assert.equal((await query('select count(*)::integer as c from research_receipt_review.conflict_observations'))[0].c,count);

  const resolution=await query("insert into research_receipt_review.resolution_observations(conflict_id,resolution_code) select id,'owner_reviewed' from research_receipt_review.conflict_observations where provider_event_id='review:event-b' limit 1 returning id");
  assert.equal(resolution.length,1);
  await rejected(()=>query('truncate research_receipt_review.resolution_observations'));

  console.log('Research B-3 PGlite SINGLE-SESSION version/CAS/journal prototype PASS; real two-session PostgreSQL and Production NOT TESTED.');
} finally {
  await db.close();
}
