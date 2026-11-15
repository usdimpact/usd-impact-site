import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { parseRawGitDiff, isGovernanceMarkdownOnly, releaseCiPlan } from './held-release-ci-plan.mjs';

const SHA='a'.repeat(40), ZERO='0'.repeat(40);
const path='docs/operations/review-notes.md';
const header=':000000 100644 '+ZERO+' '+SHA+' A';
assert.deepEqual(parseRawGitDiff(header+'\0'+path+'\0'),[
  {path,oldMode:'000000',newMode:'100644',status:'A'},
]);
assert.equal(parseRawGitDiff(''),null);
assert.equal(parseRawGitDiff(header+'\0'+path),null);
assert.equal(parseRawGitDiff(header+'\0'+path+'\0'+header+'\0'+path+'\0'),null);
assert.equal(parseRawGitDiff(header.replace('100644','120000')+'\0'+path+'\0')?.[0].newMode,'120000');
assert.equal(isGovernanceMarkdownOnly([{path,oldMode:'000000',newMode:'100644',status:'A'}]),true);
for(const bad of [
  'docs/operations/../../apps/web/index.mjs',
  'docs/operations/unapproved.astro',
  'docs/legal/release.md',
  'apps/web/src/pages/es/new.astro',
  '.github/workflows/quality.yml',
  'docs/operations/change.md\napps/web/new.astro',
]) {
  assert.equal(isGovernanceMarkdownOnly([{path:bad,oldMode:'000000',newMode:'100644',status:'A'}]),false,bad);
}
assert.equal(isGovernanceMarkdownOnly([{path,oldMode:'000000',newMode:'120000',status:'A'}]),false,'no symlink optimization');
assert.equal(isGovernanceMarkdownOnly([{path,oldMode:'100644',newMode:'000000',status:'D'}]),false,'deletion not fast');
assert.equal(isGovernanceMarkdownOnly([{path,oldMode:'100644',newMode:'100644',status:'R'}]),false,'rename not fast');
assert.equal(isGovernanceMarkdownOnly([]),false,'missing diff must build');

const folder=mkdtempSync(join(tmpdir(),'held-release-required-ci-'));
const cwd=join(folder,'repo');
mkdirSync(cwd,{recursive:true});
function git(...args){
  const result=spawnSync('git',args,{cwd,encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,'git '+args.join(' ')+': '+result.stderr);
  return result.stdout.trim();
}
function write(relative,data){
  const full=join(cwd,relative);mkdirSync(dirname(full),{recursive:true});
  writeFileSync(full,data);
}
function commit(message){git('add','-A');git('commit','-m',message);return git('rev-parse','HEAD');}
function merge(base,head,tree=head){
  const sha=git('commit-tree',tree+'^{tree}','-p',base,'-p',head,'-m','synthetic PR merge');
  git('checkout','--detach',sha);
  return sha;
}
const repository='usdimpact/usd-impact-site';
function context(base,head,checkout){
  const env={GITHUB_REPOSITORY:repository,GITHUB_EVENT_NAME:'pull_request',GITHUB_SHA:checkout};
  const event={pull_request:{state:'open',
    base:{sha:base,ref:'held-parent',repo:{full_name:repository}},
    head:{sha:head,repo:{full_name:repository}}}};
  return {env,event,cwd};
}
try{
  git('init','-b','main');git('config','user.name','CI fixture');git('config','user.email','ci@example.invalid');
  write(path,'Draft-only document fixture\n');write('apps/web/astro.config.mjs','// baseline site\n');
  const base=commit('baseline');
  write(path,'Draft-only document fixture — updated\n');
  const documentationHead=commit('docs-only PR');
  const documentationMerge=merge(base,documentationHead);
  assert.deepEqual(releaseCiPlan(context(base,documentationHead,documentationMerge)),
    {build:false,reason:'verified_operations_markdown_only',files:[path]});
  const known=context(base,documentationHead,documentationMerge);
  assert.equal(releaseCiPlan({...known,env:{...known.env,GITHUB_EVENT_NAME:'workflow_dispatch'}}).build,true);
  assert.equal(releaseCiPlan({...known,env:{...known.env,GITHUB_SHA:base}}).build,true);
  assert.equal(releaseCiPlan({...known,event:{pull_request:{...known.event.pull_request,
    head:{sha:documentationHead,repo:{full_name:'outsider/repo'}}}}}).build,true);
  assert.equal(releaseCiPlan({...known,event:{pull_request:{...known.event.pull_request,
    state:'closed'}}}).build,true);
  assert.equal(releaseCiPlan({...known,env:{...known.env,GITHUB_REPOSITORY:'other/repo'}}).build,true);
  assert.equal(releaseCiPlan({...known,cwd:join(folder,'missing')}).build,true);
  const deceptive=merge(base,documentationHead,base);
  assert.equal(releaseCiPlan(context(base,documentationHead,deceptive)).build,true,
    'merge checkout tree drift must never skip builds');

  git('checkout','-B','source',base);
  write('apps/web/src/pages/es/new.astro','<h1>Risky static page</h1>');
  const sourceHead=commit('new public route');
  const sourceMerge=merge(base,sourceHead);
  assert.deepEqual(releaseCiPlan(context(base,sourceHead,sourceMerge)),
    {build:true,reason:'source_or_unknown_file_changed'});
  git('checkout','-B','mixed',base);
  write(path,'Documentation changed\n');write('apps/web/src/data/report.json','{"status":"published"}');
  const mixedHead=commit('docs and web source');
  const mixedMerge=merge(base,mixedHead);
  assert.equal(releaseCiPlan(context(base,mixedHead,mixedMerge)).build,true,
    'mixed documentation and release-related file changes must build');
}finally{
  rmSync(folder,{recursive:true,force:true});
}
console.log('Held release required-check planner PASS: exact PR merge, docs-only fast route, source/mixed full build, spoofed checkout, missing evidence and fork negatives');
