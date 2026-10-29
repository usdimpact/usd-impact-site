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
];
const allowedImportingCandidate='apps/web/src/lib/account-deletion-due-batch-candidate.js';
const candidatePaths=candidateNames.map(name=>'apps/web/src/lib/'+name+'.js');
const sqlCandidatePaths=[
  'docs/operations/candidates/account-deletion-atomic-claim.review.sql',
  'docs/operations/candidates/account-deletion-jwt-rls-fence.review.sql',
  'docs/operations/candidates/account-deletion-transactional-completion-escrow.review.sql',
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
      if(path!==allowedImportingCandidate){
        for(const name of candidateNames){
          assert.equal(content.includes(name),false,
            'Live source imported review-only account deletion module: '+path);
          checks++;
        }
      }else {
        assert.ok(content.includes(candidateNames[0]),
          'Batch candidate must call fenced adapter rather than bypass the claim');
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
for(const file of sqlCandidatePaths){
  const content=read(file);
  assert.match(content,/REVIEW ONLY|REVIEW-ONLY/);
  checks++;
}
const migrationFiles=readdirSync(join(root,'supabase/migrations'));
assert.ok(!migrationFiles.some(name=>/account.deletion.(atomic.claim|jwt.rls.fence)/i.test(name)),
  'Review-only SQL must not be placed in live migration directory');
checks++;
const workflow=read('.github/workflows/account-deletion-pg17-multiconnection.yml');
assert.match(workflow,/PGHOST: 127\.0\.0\.1/);
assert.match(workflow,/image: postgres:17/);
assert.match(workflow,/contents: read/);
assert.doesNotMatch(workflow,/SUPABASE_SECRET_KEY:\s+\$\{\{\s*secrets\./);
checks+=4;
console.log('Issue #950 protected review boundary: '+checks+
  ' static checks PASS over '+checkedFiles+
  ' API/source files; candidate modules cannot enter active runtime.');
