// F2 Draft-only Git-tree source containment contract.
// NOT an installed GitHub App, required check, publisher, rights licence or release gate.
// The caller MUST obtain the policy and audit hashes outside the candidate PR trust boundary.
import {createHash} from 'node:crypto';

const REPOSITORY='usdimpact/usd-impact-site';
const WEB='apps/web/';
const COMMIT_SOURCE='2588ce25c61e574ad6ce84ec99a557edfcfa2cf1';
const ISSUE='https://github.com/usdimpact/usd-impact-pipeline/issues/155';
const DYNAMIC=['src/content/news/','src/content/catalyst-briefs/'];
const AUDIT=[
  'scripts/score-held-build-closure.mjs',
  'scripts/test-score-held-build-closure.mjs',
  'scripts/score-held-build-closure-baseline.json',
];
const SHA40=/^[0-9a-f]{40}$/u;
const SHA64=/^[0-9a-f]{64}$/u;
const REL=/^[A-Za-z0-9_.@+/\[\]-]+$/u;
const MAX_TREE_ITEMS=20000;
const MAX_POLICY_BYTES=1048576;
const BLOCKED_RUNTIME=/^(?:\.vercel|\.astro|\.cache|coverage|dist|node_modules)(?:\/|$)/u;

export function policySha256(text){
  return createHash('sha256').update(Buffer.from(text,'utf8')).digest('hex');
}
// Canonical Git blob SHA: never trust caller-supplied observed blob IDs.
export function gitBlobSha1(value){
  const bytes=Buffer.isBuffer(value)?value:Buffer.from(value,'utf8');
  return createHash('sha1').update('blob '+bytes.length+String.fromCharCode(0)).update(bytes).digest('hex');
}
// Canonical sorted audit-map digest; expected digest MUST be owner-controlled.
export function auditBlobsSha256(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const pairs=Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0);
  return createHash('sha256').update(JSON.stringify(pairs),'utf8').digest('hex');
}
function validRel(path){
  return typeof path==='string'&&path.length>0&&path.length<900
    &&REL.test(path)&&!path.startsWith('/')
    &&path.split('/').every(p=>p&&p!=='.'&&p!=='..');
}
function readWebTree(snapshot,label,errors){
  const files=new Map();
  if(!snapshot||snapshot.truncated!==false||!Array.isArray(snapshot.tree)
     ||snapshot.tree.length>MAX_TREE_ITEMS||!SHA40.test(snapshot.sha??'')){
    errors.push(label+': missing, truncated or oversize Git tree');
    return files;
  }
  for(const item of snapshot.tree){
    const name=item?.path;
    if(typeof name!=='string'||(name!==WEB.slice(0,-1)&&!name.startsWith(WEB)))continue;
    if(name===WEB.slice(0,-1))continue;
    const rel=name.slice(WEB.length);
    if(!validRel(rel)){
      errors.push(label+': invalid Git path');
      continue;
    }
    if(item.type==='tree'&&item.mode==='040000')continue;
    if(item.type!=='blob'||item.mode!=='100644'||!SHA40.test(item.sha??'')){
      errors.push(label+': symlink, executable, gitlink or nonregular entry: '+rel);
      continue;
    }
    if(files.has(rel)){
      errors.push(label+': duplicate Git path: '+rel);
      continue;
    }
    files.set(rel,item.sha);
  }
  return files;
}
function sameList(actual,expected){
  return Array.isArray(actual)&&JSON.stringify(actual)===JSON.stringify(expected);
}
export function reviewFrozenScoreTrees(input){
  const errors=[],review=[];
  function hold(){return {disposition:'HOLD',errors,review,checked_frozen:0,rights_granted:false,trusted_check_published:false};}
  if(!input||input.repository!==REPOSITORY||input.baseBranch!=='main'
     ||!SHA40.test(input.expectedHeadSha??'')
     ||input.expectedHeadSha!==input.observedHeadSha
     ||!SHA40.test(input.expectedBaseTreeSha??'')
     ||!SHA40.test(input.expectedCandidateTreeSha??'')
     ||input.baseTree?.sha!==input.expectedBaseTreeSha
     ||input.candidateTree?.sha!==input.expectedCandidateTreeSha){
    errors.push('GitHub repository, exact PR HEAD or Git tree provenance mismatch');
    return hold();
  }
  // Buffer allows canonical raw-byte hashing; trustedPolicyJson is kept as
  // a deprecated UTF-8 alias for older read-only fixtures/callers.
  const value=input.trustedPolicyBytes??input.trustedPolicyJson;
  const bytes=Buffer.isBuffer(value)?value:typeof value==='string'?Buffer.from(value,'utf8'):null;
  const raw=bytes?.toString('utf8')??'';
  if(!bytes||bytes.length===0||bytes.length>MAX_POLICY_BYTES
     ||!SHA40.test(input.expectedPolicyGitBlobSha??'')
     ||!SHA64.test(input.expectedPolicySha256??'')
     ||input.observedPolicyGitBlobSha!==input.expectedPolicyGitBlobSha
     ||gitBlobSha1(bytes)!==input.expectedPolicyGitBlobSha
     ||policySha256(bytes)!==input.expectedPolicySha256){
    errors.push('Protected policy content does not match externally pinned SHA1 and SHA256');
    return hold();
  }
  let policy;
  try{policy=JSON.parse(raw);}catch{errors.push('Malformed trusted policy JSON');return hold();}
  if(policy?.schema_version!==1||policy?.disposition!=='hold'
     ||policy.source_commit!==COMMIT_SOURCE
     ||policy.score_rights_issue!==ISSUE
     ||!sameList(policy.dynamic_content_prefixes,DYNAMIC)
     ||!sameList(policy.audit_only_exclusions,AUDIT)
     ||!policy.pinned_files||typeof policy.pinned_files!=='object'
     ||Array.isArray(policy.pinned_files)
     ||Object.keys(policy.pinned_files).length<775){
    errors.push('Unapproved trusted policy schema, rights state or pinned inventory');
    return hold();
  }
  const frozen=new Map();
  for(const [rel,sha] of Object.entries(policy.pinned_files)){
    if(!validRel(rel)||!SHA40.test(sha)||AUDIT.includes(rel)
       ||DYNAMIC.some(prefix=>rel.startsWith(prefix))||BLOCKED_RUNTIME.test(rel)){
      errors.push('Invalid frozen policy entry');
      return hold();
    }
    frozen.set(rel,sha);
  }
  const expectedAudit=input.trustedAuditBlobs;
  if(!expectedAudit||typeof expectedAudit!=='object'||Array.isArray(expectedAudit)
     ||Object.keys(expectedAudit).sort().join('|')!==[...AUDIT].sort().join('|')
     ||!AUDIT.every(rel=>SHA40.test(expectedAudit[rel]))){
    errors.push('Three externally pinned guard/auditor file blobs required');
    return hold();
  }
  if(!SHA64.test(input.expectedAuditBlobsSha256??'')
     ||auditBlobsSha256(expectedAudit)!==input.expectedAuditBlobsSha256){
    errors.push('Protected audit blobs do not match externally pinned SHA256');
    return hold();
  }
  const base=readWebTree(input.baseTree,'trusted-base',errors);
  const candidate=readWebTree(input.candidateTree,'candidate',errors);
  if(errors.length)return hold();
  for(const [rel,sha] of frozen){
    if(candidate.get(rel)!==sha)errors.push('Missing or modified frozen build input: '+rel);
  }
  for(const rel of AUDIT){
    if(candidate.get(rel)!==expectedAudit[rel]){
      errors.push('Changed self-auditing guard file, regardless of PR self-repin: '+rel);
    }
  }
  const inspected=new Set([...base.keys(),...candidate.keys()]);
  for(const rel of inspected){
    if(frozen.has(rel)||AUDIT.includes(rel))continue;
    if(BLOCKED_RUNTIME.test(rel)){
      errors.push('Git-tracked forbidden build/runtime path: '+rel);
      continue;
    }
    const isDynamic=DYNAMIC.some(prefix=>rel.startsWith(prefix));
    if(isDynamic){
      if(!/^src\/content\/(?:news|catalyst-briefs)\/(?:[^/]+\.md|\.gitkeep)$/u.test(rel)){
        errors.push('Unexpected dynamic content path or extension: '+rel);
      }else if(base.get(rel)!==candidate.get(rel)){
        review.push('News/Catalyst content changed; attributable editorial/source-rights review required: '+rel);
      }
    }else if(candidate.has(rel)){
      errors.push('New unreviewed Score build influence outside pinned inventory: '+rel);
    }
  }
  const pass=errors.length===0&&review.length===0;
  return {
    disposition:pass?'DRAFT_SOURCE_ONLY_PASS':'HOLD',
    errors,review,checked_frozen:frozen.size,
    rights_granted:false,trusted_check_published:false
  };
}
