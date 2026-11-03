// F1d: conservative build-input closure while original Score Issue #155 is HOLD.
// This prevents a changed template, build hook, Astro source root or new route
// from silently changing historical rendered Score output. It is NOT a license,
// not a semantic copyright scanner and NOT an independently trusted F2 check.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const webRoot=fileURLToPath(new URL('../',import.meta.url));
const manifestPath=fileURLToPath(new URL('./score-held-build-closure-baseline.json',import.meta.url));

export const FROZEN_SOURCE_COMMIT='2588ce25c61e574ad6ce84ec99a557edfcfa2cf1';
export const DYNAMIC_CONTENT_PREFIXES=Object.freeze([
  'src/content/news/',
  'src/content/catalyst-briefs/',
]);
export const AUDIT_ONLY_EXCLUSIONS=Object.freeze([
  'scripts/score-held-build-closure.mjs',
  'scripts/test-score-held-build-closure.mjs',
  'scripts/score-held-build-closure-baseline.json',
]);
export const GENERATED_FONT_SHA256=Object.freeze({
  'public/assets/fonts/inter-latin-wght-normal.woff2':'3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62',
  'public/assets/fonts/inter-latin-ext-wght-normal.woff2':'34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956',
  'public/assets/fonts/playfair-display-latin-wght-normal.woff2':'e0c764a8e9e1cce92163c55bac4b2ad6cd4cf8c696ce2289ab5c41565e65b7e2',
  'public/assets/fonts/playfair-display-latin-ext-wght-normal.woff2':'42898ad49a6b23f32b109243e1df596edf831015ed685f429e4dafbb181d599d',
  'public/assets/fonts/inter-OFL-1.1.txt':'3b0a5fca3d17942cde889069889dedbbbd075e9b599968c82a95f4d944e9b345',
  'public/assets/fonts/playfair-display-OFL-1.1.txt':'c052aafd2a71e90bcee6e69f475029d430a10d548c08ffcae350171f0e9668b1',
});
// These six post-install artifacts are copied by the pinned prepare-font-assets.mjs.
// Accept them only at exactly these paths AND exactly these upstream SHA-256 digests.
const GENERATED_ROOT_DIRS=new Set(['node_modules','dist','.git']);
// A checked-in or stale build-output directory must never be silently ignored.
// In particular .vercel/output can bypass normal Astro dist/ rights checks.
const FORBIDDEN_RUNTIME_ROOT_DIRS=new Set(['.vercel','.astro','.cache','coverage']);
const MAX_FILE_BYTES=64*1024*1024;
const SHA1=/^[a-f0-9]{40}$/;

function gitBlobSha(bytes) {
  return createHash('sha1')
    .update('blob '+bytes.length+'\0')
    .update(bytes)
    .digest('hex');
}

// No dependency install, git metadata, credentials, HTTP or source provider
// requests are needed for this audit. Use file descriptors with O_NOFOLLOW.
export function collectWebBuildInputs(root, options={}) {
  const found=Object.create(null);
  const failures=[];
  const dynamic=options.dynamic??DYNAMIC_CONTENT_PREFIXES;
  const auditOnly=options.auditOnly??AUDIT_ONLY_EXCLUSIONS;
  const {O_RDONLY,O_NOFOLLOW,O_NONBLOCK}=fs.constants;
  if (!Number.isInteger(O_NOFOLLOW) || !Number.isInteger(O_NONBLOCK)) {
    return {files:found,failures:['No-follow file opens unavailable on this platform']};
  }
  function walk(directory,relative='') {
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
      const rel=relative?relative+'/'+entry.name:entry.name;
      const full=path.join(directory,entry.name);
      if(entry.isSymbolicLink()) {
        failures.push('Symlink in held build input: '+rel);
        continue;
      }
      const isDynamic=dynamic.some(prefix=>rel===prefix.slice(0,-1)||rel.startsWith(prefix));
      const isAuditOnly=auditOnly.includes(rel);
      if(isAuditOnly) {
        if(!entry.isFile()) failures.push('Invalid auditor exclusion type: '+rel);
        continue;
      }
      if(entry.isDirectory()) {
        if(!relative && FORBIDDEN_RUNTIME_ROOT_DIRS.has(rel)) {
          failures.push('Forbidden pre-build runtime directory: '+rel);
          continue;
        }
        if(!relative && GENERATED_ROOT_DIRS.has(rel)) continue;
        if(isDynamic) continue; // normal News/Catalyst publication uses separate validators
        walk(full,rel);
      } else if(entry.isFile()) {
        if(isDynamic) continue;
        let descriptor;
        try {
          descriptor=fs.openSync(full,O_RDONLY|O_NOFOLLOW|O_NONBLOCK);
          const opened=fs.fstatSync(descriptor);
          if(!opened.isFile() || opened.size>MAX_FILE_BYTES || (opened.mode & 0o111)!==0) {
            failures.push('Unsupported file mode/size in held build input: '+rel);
          } else {
            const bytes=fs.readFileSync(descriptor);
            const expectedFontSha=Object.hasOwn(GENERATED_FONT_SHA256,rel)?GENERATED_FONT_SHA256[rel]:null;
            if(expectedFontSha){
              if(createHash('sha256').update(bytes).digest('hex')!==expectedFontSha) {
                failures.push('Generated font digest mismatch: '+rel);
              }
            }else{
              found[rel]=gitBlobSha(bytes);
            }
          }
        } catch(err) {
          failures.push('Cannot securely read held build input: '+rel+' ('+String(err?.code||'error')+')');
        } finally {
          if(descriptor!==undefined)fs.closeSync(descriptor);
        }
      } else {
        failures.push('Special filesystem node in held build input: '+rel);
      }
    }
  }
  try{
    if(!fs.statSync(root).isDirectory())throw Error('not a directory');
    walk(root);
  } catch(err){
    failures.push('Cannot enumerate held build inputs ('+String(err?.code||err?.message||'error')+')');
  }
  return {files:found,failures};
}

export function evaluatePinnedBuildInputs(manifest, observed, options={}) {
  const errors=[];
  const minimum=options.minimum??775;
  if(manifest?.schema_version!==1 || manifest?.disposition!=='hold'
     || manifest?.source_commit!==FROZEN_SOURCE_COMMIT
     || manifest?.score_rights_issue!=='https://github.com/usdimpact/usd-impact-pipeline/issues/155'
     || JSON.stringify(manifest?.dynamic_content_prefixes)!==JSON.stringify(DYNAMIC_CONTENT_PREFIXES)
     || JSON.stringify(manifest?.audit_only_exclusions)!==JSON.stringify(AUDIT_ONLY_EXCLUSIONS)
     || !manifest?.pinned_files || typeof manifest.pinned_files!=='object'
     || Array.isArray(manifest.pinned_files)
     || Object.keys(manifest.pinned_files).length<minimum) {
    return ['Unrecognized frozen Score build-input inventory'];
  }
  if(!observed || typeof observed!=='object'||Array.isArray(observed)) {
    return ['Missing observed build-input inventory'];
  }
  const pinned=manifest.pinned_files;
  for(const [name,expectedSha] of Object.entries(pinned)) {
    if(!/^[A-Za-z0-9_.@+\/\[\]-]+$/.test(name)
       || name.split('/').some(part=>part==='..'||part==='.') || name.startsWith('/')
       || DYNAMIC_CONTENT_PREFIXES.some(prefix=>name.startsWith(prefix))
       || AUDIT_ONLY_EXCLUSIONS.includes(name)
       || !SHA1.test(expectedSha)) {
      errors.push('Malformed frozen build-input entry: '+name);
      continue;
    }
    if(!Object.hasOwn(observed,name)) errors.push('Missing frozen build input: '+name);
    else if(observed[name]!==expectedSha) errors.push('Changed frozen build input: '+name);
  }
  for(const name of Object.keys(observed)) {
    if(!Object.hasOwn(pinned,name)) errors.push('New unreviewed build input: '+name);
  }
  return errors;
}

export function verifyHeldBuildInputs(root=webRoot, baselinePath=manifestPath) {
  let baseline;
  try {
    baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
  } catch {
    return ['Missing or invalid frozen Score build-input baseline'];
  }
  const scan=collectWebBuildInputs(root);
  return [...scan.failures,...evaluatePinnedBuildInputs(baseline,scan.files)];
}

// Future F2 trusted-base evaluator: run this already-trusted copy of the guard
// and its baseline against an untrusted PR's web root. --root never loads a
// manifest or evaluator from the candidate directory. Required main ruleset
// and independent workflow execution remain separate owner-controlled gates.
export function selectF2TrustedCandidateRoot(argv=process.argv,defaultRoot=webRoot) {
  const positions=argv.flatMap((a,i)=>a==='--root'?[i]:[]);
  if(positions.length>1)throw Error('F2 --root may be supplied only once');
  if(!positions.length)return defaultRoot;
  const raw=argv[positions[0]+1];
  if(typeof raw!=='string'||!path.isAbsolute(raw)||raw.startsWith('-'))
    throw Error('F2 --root requires one absolute candidate web path');
  const candidate=path.resolve(raw);
  if(!fs.lstatSync(candidate).isDirectory()||fs.lstatSync(candidate).isSymbolicLink())
    throw Error('F2 candidate --root must be a real directory');
  return candidate;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  let failures;
  try {
    failures=verifyHeldBuildInputs(selectF2TrustedCandidateRoot());
  }catch(err){
    failures=['F2 invalid trusted evaluator candidate root: '+String(err?.message||err)];
  }
  if(failures.length) {
    console.error('Score F1d build-input closure FAIL ('+failures.length+' issues):\n- '+failures.slice(0,30).join('\n- '));
    process.exitCode=1;
  } else {
    console.log('Score F1d build-input closure PASS: 775 pinned files; E/E3/F/G build influences frozen; rights HOLD');
  }
}
