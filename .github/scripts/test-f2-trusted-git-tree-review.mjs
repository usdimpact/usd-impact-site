// F2 dry-run: synthetic and unprivileged. Do not publish a GitHub check from this test.
import assert from 'node:assert/strict';
import {gitBlobSha,policySha256,reviewFrozenScoreTrees} from './f2-trusted-git-tree-review.mjs';

const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40),D='d'.repeat(40),E='e'.repeat(40);
const pinned=Object.fromEntries(Array.from({length:775},(_,i)=>['src/frozen/input-'+i+'.astro',A]));
const audit=[
  'scripts/score-held-build-closure.mjs',
  'scripts/test-score-held-build-closure.mjs',
  'scripts/score-held-build-closure-baseline.json',
];
const trustedAuditBlobs=Object.fromEntries(audit.map(x=>[x,B]));
const policy={
  schema_version:1,disposition:'hold',
  source_commit:'2588ce25c61e574ad6ce84ec99a557edfcfa2cf1',
  score_rights_issue:'https://github.com/usdimpact/usd-impact-pipeline/issues/155',
  dynamic_content_prefixes:['src/content/news/','src/content/catalyst-briefs/'],
  audit_only_exclusions:audit,pinned_files:pinned
};
const raw=JSON.stringify(policy);
function entry(rel,sha=A,mode='100644'){
  return {path:'apps/web/'+rel,type:'blob',mode,sha};
}
const base=[
  ...Object.entries(pinned).map(([p,sha])=>entry(p,sha)),
  ...audit.map(p=>entry(p,B)),
  entry('src/content/news/2026-11-02.md',C),
  entry('src/content/catalyst-briefs/2026-11-02.md',C)
];
const payload={
  repository:'usdimpact/usd-impact-site',baseBranch:'main',
  expectedHeadSha:C,observedHeadSha:C,
  expectedBaseTreeSha:D,expectedCandidateTreeSha:E,
  trustedPolicyJson:raw,expectedPolicyGitBlobSha:gitBlobSha(raw),
  expectedPolicySha256:policySha256(raw),trustedAuditBlobs,
  baseTree:{sha:D,truncated:false,tree:base},
  candidateTree:{sha:E,truncated:false,tree:structuredClone(base)}
};
const run=(patch={})=>reviewFrozenScoreTrees({...payload,...patch});
function changed(rel,sha=B){
  const clone=structuredClone(payload.candidateTree);
  const node=clone.tree.find(e=>e.path==='apps/web/'+rel);
  assert.ok(node,'fixture must exist');
  node.sha=sha;
  return clone;
}
assert.equal(run().disposition,'DRAFT_SOURCE_ONLY_PASS');
assert.equal(run().checked_frozen,775);
assert.equal(run().trusted_check_published,false);
assert.equal(run().rights_granted,false);
let cases=0;
function expectHold(result,needle){
  assert.equal(result.disposition,'HOLD',needle);
  assert.ok([...result.errors,...result.review].some(x=>x.includes(needle)),
    'missing intended fail-closed reason '+needle);
  cases++;
}
expectHold(run({candidateTree:changed('src/frozen/input-9.astro')}),'modified frozen build input');
expectHold(run({candidateTree:changed(audit[2])}),'Changed self-auditing');
expectHold(run({candidateTree:changed(audit[0])}),'Changed self-auditing');
// Simulate simultaneous malicious file modification and locally regenerated baseline:
// independently pinned policy bytes and guard SHA are never inherited from candidate.
const repinned={...policy,pinned_files:{...pinned,['src/frozen/input-9.astro']:B}};
const attack=run({trustedPolicyJson:JSON.stringify(repinned),candidateTree:changed('src/frozen/input-9.astro')});
expectHold(attack,'Protected policy content');
const extra=structuredClone(payload.candidateTree);
extra.tree.push(entry('src/pages/unapproved-score.astro',A));
expectHold(run({candidateTree:extra}),'New unreviewed');
const missing=structuredClone(payload.candidateTree);
missing.tree=missing.tree.filter(e=>e.path!=='apps/web/src/frozen/input-13.astro');
expectHold(run({candidateTree:missing}),'Missing or modified');
const symlink=changed('src/content/news/2026-11-02.md');
symlink.tree.find(x=>x.path.endsWith('2026-11-02.md')).mode='120000';
expectHold(run({candidateTree:symlink}),'symlink');
const bad=structuredClone(payload.candidateTree);
bad.truncated=true;
expectHold(run({candidateTree:bad}),'truncated');
expectHold(run({observedHeadSha:A}),'exact PR HEAD');
const daily=changed('src/content/news/2026-11-02.md',B);
const decision=run({candidateTree:daily});
expectHold(decision,'editorial/source-rights review');
assert.equal(decision.errors.length,0);
assert.equal(decision.rights_granted,false);
const unreviewed=structuredClone(payload.candidateTree);
unreviewed.tree.push(entry('public/assets/fonts/unreviewed.woff2',A));
expectHold(run({candidateTree:unreviewed}),'New unreviewed');
const special=structuredClone(payload.candidateTree);
special.tree.push(entry('.vercel/output/generated.html',A));
expectHold(run({candidateTree:special}),'forbidden');
const duplicate=structuredClone(payload.candidateTree);
duplicate.tree.push(entry('src/frozen/input-0.astro',A));
expectHold(run({candidateTree:duplicate}),'duplicate');
const deleted=structuredClone(payload.candidateTree);
deleted.tree=deleted.tree.filter(e=>!e.path.endsWith('news/2026-11-02.md'));
expectHold(run({candidateTree:deleted}),'editorial/source-rights review');
console.log('F2_DRAFT_TREE_CONTRACT_PASS clean=1 fail_closed='+cases+
  ' self_repin_denied=true audit_guard_denied=true editorial_review_required=true'+
  ' sha_bound=true app_published=false rights_granted=false');
