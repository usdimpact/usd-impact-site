// Issue #950 — source-only fail-closed activation boundary for REVIEW candidates.
// This check is intentionally strict until independent schema, Auth Admin,
// account-deletion coordinator and Production release approvals exist.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const read=path=>readFileSync(join(root,path),'utf8');
const candidateNames=[
  'account-deletion-fenced-protocol-candidate',
  'account-deletion-due-batch-candidate',
  'account-deletion-completion-recovery-candidate',
  'account-deletion-coordinated-offline-candidate',
];
const allowedCandidateImports={
  'apps/web/src/lib/account-deletion-due-batch-candidate.js':[
    'account-deletion-fenced-protocol-candidate',
  ],
  'apps/web/src/lib/account-deletion-coordinated-offline-candidate.js':[
    'account-deletion-due-batch-candidate',
    'account-deletion-completion-recovery-candidate',
  ],
};
const candidatePaths=candidateNames.map(name=>'apps/web/src/lib/'+name+'.js');
const sqlCandidatePaths=[
  'docs/operations/candidates/account-deletion-atomic-claim.review.sql',
  'docs/operations/candidates/account-deletion-jwt-rls-fence.review.sql',
  'docs/operations/candidates/account-deletion-transactional-completion-escrow.review.sql',
  'docs/operations/candidates/account-deletion-confirmed-tokenloss-recovery.review.sql',
  'docs/operations/candidates/account-deletion-completion-escrow-health.review.sql',
  'docs/operations/candidates/issue950-s3-jwt-session-source.review.sql',
  'docs/operations/candidates/issue950-s3-jwt-session-restore.review.sql',
  'docs/operations/candidates/issue950-s3-jwt-session-source-rollback.review.sql',
  'docs/operations/candidates/issue950-s3-jwt-session-restore-rollback.review.sql',
];
let checks=0,checkedFiles=0;

function walk(directory){
  const entries=readdirSync(join(root,directory),{withFileTypes:true});
  for(const entry of entries){
    const path=join(directory,entry.name);
    if(entry.isDirectory())walk(path);
    else if(entry.isFile() && /\.(?:js|mjs|cjs|ts|tsx|jsx|astro)$/.test(entry.name)){
      checkedFiles++;
      const content=read(path);
      // The dormant batch candidate alone may import the dormant one-account
      // candidate. No actual route, middleware, app/client source may import
      // either review-only module.
      const allowed=allowedCandidateImports[path]||[];
      for(const name of candidateNames){
        if(allowed.includes(name)){
          assert.ok(content.includes(name),
            'Missing explicit offline candidate dependency: '+path+' -> '+name);
        }else {
          assert.equal(content.includes(name),false,
            'Runtime imported forbidden account deletion module: '+path+' -> '+name);
        }
        checks++;
      }
    }
  }
}
walk('apps/web/api');
walk('apps/web/src');
if(existsSync(join(root,'apps/web/middleware.js'))){
  const middleware=read('apps/web/middleware.js');
  for(const name of candidateNames){
    assert.doesNotMatch(middleware,new RegExp(name));
    checks++;
  }
}
const finalizer=read('apps/web/src/lib/account-deletion-finalizer.js');
assert.match(finalizer,/if \(!enabled\(environment\.ACCOUNT_DELETION_FINALIZER_ENABLED\)\)/);
assert.doesNotMatch(finalizer,/claim_due_account_deletion|begin_claimed_auth_removal/);
checks+=2;
const accountApi=read('apps/web/api/account.js');
assert.doesNotMatch(accountApi,/account-deletion-(?:fenced-protocol|due-batch)-candidate/);
checks++;
const vercel=JSON.parse(read('apps/web/vercel.json'));
const crons=(vercel.crons||[]).filter(x=>x.path==='/api/account-deletion-finalizer');
assert.deepEqual(crons,[{
  path:'/api/account-deletion-finalizer',schedule:'20 4 * * *',
}],'No new/unreviewed deletion scheduler or schedule changes');
checks++;
for(const file of candidatePaths){
  const content=read(file);
  assert.match(content,/offline_fixture/,'candidate must stay explicitly offline');
  assert.doesNotMatch(content,/\bfetch\s*\(/,'no global fetch inside candidate');
  assert.doesNotMatch(content,/\bprocess\.env\b/,'no automatic environment credentials');
  assert.doesNotMatch(content,/\/auth\/v1\/admin\/users/,'no direct live Auth Admin HTTP');
  checks+=4;
}
// The private Storage transfer plan is deliberately data-only: no live
// API, worker or middleware may import it, and it cannot execute rclone.
const storagePlanPath='apps/web/src/lib/account-deletion-private-storage-restore-plan.review.js';
const storagePlan=read(storagePlanPath);
assert.match(storagePlan,/SOURCE_ONLY_DRY_PLAN/);
assert.doesNotMatch(storagePlan,/\bfetch\s*\(|\bprocess\.env\b|node:child_process|\bspawn\s*\(|\bexecFile\s*\(/);
checks+=2;
function rejectStoragePlanImports(dir){
  for(const entry of readdirSync(join(root,dir),{withFileTypes:true})){
    const path=join(dir,entry.name);
    if(entry.isDirectory())rejectStoragePlanImports(path);
    else if(entry.isFile() && /\.(?:js|mjs|cjs|ts|tsx|jsx|astro)$/.test(entry.name)
      && path!==storagePlanPath){
      assert.equal(read(path).includes('account-deletion-private-storage-restore-plan.review'),false,
        'Live source imported the private Storage restore plan: '+path);
      checks++;
    }
  }
}
rejectStoragePlanImports('apps/web/src');
rejectStoragePlanImports('apps/web/api');

// GoTrue Admin wire review uses a deliberately unusable static test key,
// exact synthetic account and an injected fake transport. Never import into
// an application entrypoint, handler or production finalizer.
const authAdminWirePath='apps/web/src/lib/account-deletion-gotrue-admin-wire.review.js';
const authAdminWire=read(authAdminWirePath);
assert.match(authAdminWire,/sb_secret_issue950_offline_wire_fixture_never_real/);
assert.match(authAdminWire,/offline_fixture/);
assert.match(authAdminWire,/should_soft_delete:true/);
assert.doesNotMatch(authAdminWire,/\bfetch\s*\(|\bprocess\.env\b|\bAuthorization\s*:/);
checks+=4;
function rejectAuthAdminWireImports(dir){
  for(const entry of readdirSync(join(root,dir),{withFileTypes:true})){
    const path=join(dir,entry.name);
    if(entry.isDirectory())rejectAuthAdminWireImports(path);
    else if(entry.isFile() && /\.(?:js|mjs|cjs|ts|tsx|jsx|astro)$/.test(entry.name)
      && path!==authAdminWirePath){
      assert.equal(read(path).includes('account-deletion-gotrue-admin-wire.review'),false,
        'Live runtime imported GoTrue Admin wire review adapter: '+path);
      checks++;
    }
  }
}
rejectAuthAdminWireImports('apps/web/src');
rejectAuthAdminWireImports('apps/web/api');

for(const file of sqlCandidatePaths){
  const content=read(file);
  assert.match(content,/REVIEW ONLY|REVIEW-ONLY/);
  checks++;
}
const migrationFiles=readdirSync(join(root,'supabase/migrations'));
assert.ok(!migrationFiles.some(name=>/account.deletion.(atomic.claim|jwt.rls.fence)/i.test(name)),
  'Review-only SQL must not be placed in live migration directory');
checks++;

// A named-file check alone is insufficient: the same irreversible RPCs could
// be copied into a generically named migration while the backup/restore gate
// remains unverified. Fail on SQL CONTENT, not just on filename patterns.
// Removing this guard requires a separately reviewed coordinated cutover PR.
const proposedDeletionSql = /\b(?:claim_due_account_deletion|begin_claimed_auth_removal|finalize_claimed_account_deletion|confirm_claimed_auth_soft_delete|mark_claimed_auth_ambiguous|recover_confirmed_without_token|list_account_deletion_completion_recoveries|confirm_account_deletion_completion_outbox|completion_intents|confirmed_recovery_audit|completion_escrow_health|issue950_(?:source|restore)_session_|__ISSUE950_(?:SOURCE|RESTORE)_SYNTHETIC_UUID__)\b/i;
assert.equal(proposedDeletionSql.test('create function public.claim_due_account_deletion('),true);
assert.equal(proposedDeletionSql.test('create table public.unrelated_fixture (id uuid)'),false);
checks+=2;
for (const name of migrationFiles.filter(name=>name.endsWith('.sql'))) {
  assert.doesNotMatch(read('supabase/migrations/'+name),proposedDeletionSql,
    'Issue #950 REVIEW-ONLY account deletion SQL found in executable migration: '+name);
  checks++;
}
const workflow=read('.github/workflows/account-deletion-pg17-multiconnection.yml');
assert.match(workflow,/PGHOST: 127\.0\.0\.1/);
assert.match(workflow,/image: postgres:17/);
assert.match(workflow,/contents: read/);
assert.doesNotMatch(workflow,/SUPABASE_SECRET_KEY:\s+\$\{\{\s*secrets\./);
checks+=4;
console.log('Issue #950 protected review boundary: '+checks+
  ' static checks PASS over '+checkedFiles+
  ' API/source files; candidate modules cannot enter active runtime.');
