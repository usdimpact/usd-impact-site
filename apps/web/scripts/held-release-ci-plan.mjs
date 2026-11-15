// Conservative, low-cost PR route for the held-release security check.
// Only tightly-scoped governance Markdown edits may skip the two static builds.
// Every uncertain diff, unknown event, stale checkout, or source change builds both modes.
import { appendFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPOSITORY = 'usdimpact/usd-impact-site';
const SHA = /^[a-f0-9]{40}$/;
const MAX_CHANGED = 32;
const MAX_BUFFER = 4 * 1024 * 1024;
const full = (reason) => ({ build: true, reason });

function validSha(value) { return typeof value === 'string' && SHA.test(value); }
function git(args, cwd, { binary=false }={}) {
  const result=spawnSync('git', args, {
    cwd, encoding: binary ? 'buffer' : 'utf8', timeout: 20000, maxBuffer: MAX_BUFFER,
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_TERMINAL_PROMPT: '0' },
  });
  if(result.error || result.status !== 0) throw new Error('Git evidence unavailable');
  return result.stdout;
}

export function parseRawGitDiff(raw) {
  if (typeof raw !== 'string' || !raw.endsWith('\0')) return null;
  const parts=raw.slice(0,-1).split('\0');
  if(!parts.length || parts.length%2 || parts.length>MAX_CHANGED*2) return null;
  const out=[];
  for(let i=0;i<parts.length;i+=2){
    const m=parts[i].match(/^:([0-7]{6}) ([0-7]{6}) ([0-9a-f]{40}) ([0-9a-f]{40}) ([A-Z])$/);
    const filename=parts[i+1];
    if(!m || !filename || filename.includes('\0') || out.some(x=>x.path===filename)) return null;
    out.push({path:filename,oldMode:m[1],newMode:m[2],status:m[5]});
  }
  return out.length?out:null;
}

export function isGovernanceMarkdownOnly(entries) {
  if(!Array.isArray(entries) || entries.length===0 || entries.length>MAX_CHANGED) return false;
  return entries.every(({path:filename,oldMode,newMode,status})=>{
    if(typeof filename!=='string' || typeof status!=='string'
      || !/^docs\/operations\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.md$/.test(filename)
      || filename.split('/').some(x=>x==='.' || x==='..')) return false;
    // Symlinks, mode changes, renamed files and deletes cannot opt out.
    if(!['A','M'].includes(status) || newMode!=='100644')return false;
    return status==='A' ? oldMode==='000000' : oldMode==='100644';
  });
}

export function releaseCiPlan({env=process.env,event={},cwd=process.cwd()}={}) {
  try{
    if(env.GITHUB_EVENT_NAME!=='pull_request') return full('manual_or_non_pr_event');
    if(env.GITHUB_REPOSITORY!==REPOSITORY) return full('unknown_repository');
    const pr=event?.pull_request;
    const base=pr?.base?.sha, head=pr?.head?.sha, checkout=env.GITHUB_SHA;
    if(pr?.state!=='open' || !validSha(base) || !validSha(head) || !validSha(checkout)
      || pr?.base?.repo?.full_name!==REPOSITORY
      || pr?.head?.repo?.full_name!==REPOSITORY) return full('unverified_pr_context');
    if(git(['rev-parse','HEAD'],cwd).trim()!==checkout) return full('checkout_revision_drift');
    // Only GitHub's exact two-parent PR merge checkout can opt out.
    if(checkout===head || git(['show','-s','--format=%P',checkout],cwd).trim()!==base+' '+head) {
      return full('unbound_pr_merge_checkout');
    }
    if(git(['rev-parse',base+'^{commit}'],cwd).trim()!==base
      || git(['rev-parse',head+'^{commit}'],cwd).trim()!==head) {
      return full('unavailable_pr_commit');
    }
    git(['merge-base','--is-ancestor',base,head],cwd);
    if(git(['rev-parse',checkout+'^{tree}'],cwd).trim()
      !==git(['rev-parse',head+'^{tree}'],cwd).trim()){
      return full('merged_tree_differs_from_head');
    }
    const raw=git(['diff','--raw','-z','--no-renames','--no-ext-diff',
      '--no-textconv','--abbrev=40',base,head,'--'],cwd,{binary:true});
    // Fatal UTF-8 decoding: unknown file names must never trigger a fast route.
    const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);
    const files=parseRawGitDiff(text);
    if(!files) return full('unrecognized_pr_diff');
    if(!isGovernanceMarkdownOnly(files))return full('source_or_unknown_file_changed');
    return {build:false,reason:'verified_operations_markdown_only',files:files.map(x=>x.path)};
  }catch{
    return full('diff_or_checkout_evidence_unavailable');
  }
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let event={};
  try{event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));}
  catch{ /* full validation if event evidence unavailable */ }
  const plan=releaseCiPlan({event});
  const build=plan.build?'true':'false';
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,
    'build='+build+'\nreason='+plan.reason+'\n');
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '## Held release check route\n\nBuild: '+build+'; reason: '+plan.reason
    +'\n\nThis is not release authority, rights clearance, host authentication or public publishing approval.\n');
  console.log('Held release check: build='+build+' reason='+plan.reason);
}
