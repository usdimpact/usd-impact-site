import assert from 'node:assert/strict';
import {
  buildIssue950PrivateStoragePlan,StorageRestoreHold,
  SOURCE_REF,RESTORE_REF,REGION,PRIVATE_BUCKETS,METADATA_FINGERPRINT,
} from '../src/lib/account-deletion-private-storage-restore-plan.review.js';

const inventory=PRIVATE_BUCKETS.map(v=>({name:v.name,count:v.count,bytes:v.bytes,private:true}));
const allowed={
  sourceRef:SOURCE_REF,restoreRef:RESTORE_REF,region:REGION,
  sourceMetadataFingerprint:METADATA_FINGERPRINT,
  restoreMetadataFingerprint:METADATA_FINGERPRINT,
  sourceInventory:inventory,restoreInventory:inventory,
  dataApiDisabled:true,signupDisabled:true,emailAuthDisabled:true,
};
let checks=0;
const p=buildIssue950PrivateStoragePlan(allowed);
assert.equal(p.mode,'SOURCE_ONLY_DRY_PLAN');
assert.equal(p.expectedObjects,21);
assert.equal(p.expectedMetadataBytes,374929235);
assert.equal(p.readyForExecution,false);
assert.equal(p.storageBytesRecovered,false);
assert.equal(p.steps.length,2);
assert.equal(p.mandatoryApprovals.length,6);
assert.deepEqual(p.steps.map(x=>x.bucket).sort(),
  ['library-pass-assets','library-pass-books'].sort());
checks+=8;
const serialized=JSON.stringify(p).toLowerCase();
for(const banned of [
  'gjzetjugmnwanvjkchux','service_role','sb_secret_',
  'authorization','rclone sync','rclone move','rclone delete','rclone purge',
  'public url','user_email','signedurl','secret_access_key',
]){
  assert.equal(serialized.includes(banned),false,
    'plan must not contain private credentials/production or destructive commands: '+banned);
  checks++;
}
for(const s of p.steps){
  assert.ok(s.copy.startsWith('rclone copy issue950_source:'));
  assert.ok(s.copy.includes(' issue950_restore:'));
  assert.ok(s.copy.includes('--ignore-times'));
  assert.ok(!s.copy.includes('--ignore-existing'));
  assert.ok(s.validate.includes('--download'));
  assert.ok(s.preflight.every(x=>x.startsWith('rclone size ')));
  checks+=6;
}
function denied(change,code){
  assert.throws(()=>buildIssue950PrivateStoragePlan({...allowed,...change}),
    e=>e instanceof StorageRestoreHold&&e.code===code,code);
  checks++;
}
for(const [change,code] of [
  [{sourceRef:RESTORE_REF},'STORAGE_RESTORE_PROJECT_ISOLATION_HOLD'],
  [{sourceRef:'gjzetjugmnwanvjkchux'},'STORAGE_RESTORE_PROJECT_ISOLATION_HOLD'],
  [{restoreRef:'gjzetjugmnwanvjkchux'},'STORAGE_RESTORE_PROJECT_ISOLATION_HOLD'],
  [{restoreRef:SOURCE_REF},'STORAGE_RESTORE_PROJECT_ISOLATION_HOLD'],
  [{region:'us-east-1'},'STORAGE_RESTORE_PROJECT_ISOLATION_HOLD'],
  [{dataApiDisabled:false},'STORAGE_RESTORE_ACCESS_ISOLATION_HOLD'],
  [{signupDisabled:false},'STORAGE_RESTORE_ACCESS_ISOLATION_HOLD'],
  [{emailAuthDisabled:false},'STORAGE_RESTORE_ACCESS_ISOLATION_HOLD'],
  [{restoreMetadataFingerprint:'different'},'STORAGE_RESTORE_METADATA_FINGERPRINT_HOLD'],
  [{sourceMetadataFingerprint:null},'STORAGE_RESTORE_METADATA_FINGERPRINT_HOLD'],
  [{restoreInventory:[]},'STORAGE_RESTORE_BUCKET_SET_MISMATCH'],
  [{sourceInventory:inventory.concat({name:'additional',count:0,bytes:0,private:true})},'STORAGE_RESTORE_BUCKET_SET_MISMATCH'],
  [{sourceInventory:inventory.map(x=>({...x,private:false}))},'STORAGE_RESTORE_INVALID_BUCKET'],
  [{sourceInventory:inventory.map((x,i)=>i===0?{...x,count:19}:x)},'STORAGE_RESTORE_METADATA_MISMATCH'],
  [{sourceInventory:inventory.map((x,i)=>i===1?{...x,bytes:2281646}:x)},'STORAGE_RESTORE_METADATA_MISMATCH'],
  [{sourceInventory:[inventory[0],inventory[0]]},'STORAGE_RESTORE_INVALID_BUCKET'],
]){
  denied(change,code);
}
assert.equal('execute' in p,false);
assert.equal('run' in p,false);
assert.equal('fetch' in p,false);
assert.equal('credentials' in p,false);
checks+=4;
console.log('Issue #950 credential-free private Storage restore preflight: '+checks+
  ' assertions PASS; NO network, S3 keys, provider, Auth, email or Storage copy.');
