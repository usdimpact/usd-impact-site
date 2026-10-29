// Issue #950 — OFFLINE SOURCE-ONLY, NOT an executable Storage transfer.
// No keys, network, filesystem access, SQL, subprocess or application import.
// The plan is constrained to the already-authorized temporary restore.
// Execution requires a separately approved private runner and key handling.
export const SOURCE_REF = 'ycstrcvshdluovtuasjc';
export const RESTORE_REF = 'movnekagnxgcyenczfoc';
export const REGION = 'eu-central-1';
export const PRIVATE_BUCKETS = Object.freeze([
  Object.freeze({name:'library-pass-assets',count:20,bytes:372647590}),
  Object.freeze({name:'library-pass-books',count:1,bytes:2281645}),
]);
export const METADATA_FINGERPRINT =
  '63b14b409e2ba3b7b826eca3915142ccaa1bdafb6fa2b042f22d48c177847f6e';

export class StorageRestoreHold extends Error {
  constructor(code) { super(code); this.name='StorageRestoreHold'; this.code=code; }
}
function stop(code) {throw new StorageRestoreHold(code);}
function matchesInventory(actual) {
  if(!Array.isArray(actual) || actual.length!==PRIVATE_BUCKETS.length)
    stop('STORAGE_RESTORE_BUCKET_SET_MISMATCH');
  const names=new Set();
  for(const v of actual) {
    if(!v || typeof v!=='object' || names.has(v.name)
      || typeof v.private!=='boolean' || !v.private
      || !Number.isSafeInteger(v.count) || !Number.isSafeInteger(v.bytes))
      stop('STORAGE_RESTORE_INVALID_BUCKET');
    names.add(v.name);
    const expected=PRIVATE_BUCKETS.find(b=>b.name===v.name);
    if(!expected || v.count!==expected.count || v.bytes!==expected.bytes)
      stop('STORAGE_RESTORE_METADATA_MISMATCH');
  }
}
export function buildIssue950PrivateStoragePlan({
  sourceRef=SOURCE_REF,restoreRef=RESTORE_REF,region=REGION,
  sourceMetadataFingerprint,restoreMetadataFingerprint,
  sourceInventory,restoreInventory,
  dataApiDisabled,signupDisabled,emailAuthDisabled,
}={}) {
  if(sourceRef!==SOURCE_REF || restoreRef!==RESTORE_REF
    || sourceRef===restoreRef || region!==REGION)
    stop('STORAGE_RESTORE_PROJECT_ISOLATION_HOLD');
  if(dataApiDisabled!==true || signupDisabled!==true
    || emailAuthDisabled!==true)
    stop('STORAGE_RESTORE_ACCESS_ISOLATION_HOLD');
  if(sourceMetadataFingerprint!==METADATA_FINGERPRINT
    || restoreMetadataFingerprint!==METADATA_FINGERPRINT)
    stop('STORAGE_RESTORE_METADATA_FINGERPRINT_HOLD');
  matchesInventory(sourceInventory);
  matchesInventory(restoreInventory);

  // S3 credentials issued by Supabase provide project-wide FULL S3 access
  // across buckets and BYPASS RLS. A source remote used only for GET/list
  // does NOT become server-enforced read-only. Never imply key-level scoping.
  // No key values or object paths enter this non-executable plan.
  // Remotes require a separately approved, private and isolated runner.
  const steps=[];
  for(const b of PRIVATE_BUCKETS) {
    steps.push(Object.freeze({
      bucket:b.name,expectedCount:b.count,expectedBytes:b.bytes,
      preflight:Object.freeze([
        'rclone size issue950_source:'+b.name+' --json',
        'rclone size issue950_restore:'+b.name+' --json',
      ]),
      pilot:'Explicitly approved one-object S3 PUT/GET pilot; do not clear restored SQL metadata',
      copy:'rclone copy issue950_source:'+b.name+' issue950_restore:'+b.name+
        ' --ignore-times --transfers 1 --checkers 2',
      validate:'rclone check issue950_source:'+b.name+
        ' issue950_restore:'+b.name+' --download',
      prohibited:Object.freeze(['sync','move','delete','purge','deletefile']),
    }));
  }
  return Object.freeze({
    mode:'SOURCE_ONLY_DRY_PLAN',
    sourceRef,restoreRef,region,
    sourceAndTargetPrivate:true,
    expectedObjects:PRIVATE_BUCKETS.reduce((s,b)=>s+b.count,0),
    expectedMetadataBytes:PRIVATE_BUCKETS.reduce((s,b)=>s+b.bytes,0),
    storageBytesRecovered:false,
    readyForExecution:false,
    s3CredentialScope:'project_wide_full_s3_access_bypasses_rls',
    sourceKeyReadOnlyEnforced:false,
    mandatoryApprovals:Object.freeze([
      'independent_private_storage_transfer_and_cost_approval',
      'single_object_pilot_with_s3_overwrite_semantics',
      'secure_short_lived_credentials_in_private_runner',
      'security_owner_explicitly_accepts_full_s3_access_bypassing_rls',
      'zero_public_object_urls_and_no_logging_of_object_paths',
      'source_commands_read_only_but_source_s3_key_is_not_read_only',
      'full_private_byte_comparison_and_key_revocation',
    ]),
    steps:Object.freeze(steps),
  });
}
