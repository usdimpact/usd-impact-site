// Historical Score-derived published source freeze while Issue #155 rights HOLD is active.
// This is a new-publication CI guard, not a provider license or retroactive approval.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readGate } from './score-derived-publication-rights-gate.mjs';

const webRoot=fileURLToPath(new URL('../',import.meta.url));
const baselineFile=fileURLToPath(new URL('./score-held-report-source-baseline.json',import.meta.url));
export const gitBlobSha1=(contents)=>{
  const bytes=Buffer.isBuffer(contents)?contents:Buffer.from(String(contents),'utf8');
  return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
};

export function evaluateScoreContentFreeze(baseline, current, rightsHold=true) {
  const failures=[];
  // Only this pinned inventory may identify historical, already-existing files.
  // The additional non-report entry is the unchanged monthly .gitkeep, not
  // an extension wildcard or a permission to publish.
  const reports=baseline?.existing_reports;
  const other=baseline?.existing_other_files;
  if (!baseline || baseline.version!==2 || baseline.disposition!=='hold'
    || baseline.source_main_commit!=='d1740214f5737996f321a037efe3f2f7d21ecd64'
    || baseline.score_rights_issue!=='https://github.com/usdimpact/usd-impact-pipeline/issues/155'
    || !reports || typeof reports!=='object' || Array.isArray(reports)
    || !other || typeof other!=='object' || Array.isArray(other)
    || Object.keys(other).length!==1
    || other['monthly-reports/.gitkeep']!=='8b137891791fe96927ad78e64b0aad7bded08bdc') {
    return ['Unrecognized Score-derived HOLD inventory'];
  }
  if (rightsHold!==true) failures.push('Rights gate must explicitly remain HOLD');
  if (!current || typeof current!=='object' || Array.isArray(current)) {
    return [...failures,'No Score-derived content inventory supplied'];
  }
  for (const [name,expectedSha] of Object.entries(reports)) {
    if (!/^(?:weekly|monthly)-reports\/\d{4}-\d{2}-\d{2}\.md$/.test(name)
        || !/^[a-f0-9]{40}$/.test(expectedSha)) {
      failures.push('Malformed historical rights inventory entry: '+name);
    }
  }
  for (const [name,contents] of Object.entries(current)) {
    const knownReport=Object.hasOwn(reports,name);
    const knownOther=Object.hasOwn(other,name);
    if (!knownReport && !knownOther) {
      if (/^(?:weekly|monthly)-reports\/\d{4}-\d{2}-\d{2}\.md$/.test(name)) {
        failures.push('New Score-derived report source on rights HOLD: '+name);
      } else {
        // Nested Markdown, MDX, hidden files, templates, and arbitrary
        // extensions all fail instead of being silently ignored.
        failures.push('Unexpected Score report source path: '+name);
      }
      continue;
    }
    const expectedSha=knownReport?reports[name]:other[name];
    if (gitBlobSha1(contents)!==expectedSha) {
      failures.push('Changed historical Score-derived report source on rights HOLD: '+name);
    }
  }
  // Deleting a prior file does not create a new publication. Its removal is
  // not evidence of rights clearance or permission to republish elsewhere.
  return failures;
}

export function collectScoreContents(root=webRoot) {
  const contents=Object.create(null);
  for(const dir of ['weekly-reports','monthly-reports']){
    const location=path.join(root,'src','content',dir);
    // Check the source roots as well: a symlinked entire collection would
    // otherwise evade a purely per-file symlink check.
    const top=fs.lstatSync(location);
    if (!top.isDirectory() || top.isSymbolicLink()) {
      throw Error('Score report collection directory is not a real directory: '+dir);
    }
    function visit(absolute, relative='') {
      // Dirent classification avoids a separate path-based stat/read sequence.
      // Always open files by descriptor with O_NOFOLLOW, then verify the opened
      // object. A path replaced by a symlink between enumeration and open
      // cannot redirect this rights audit to an unexpected file.
      const {O_RDONLY,O_NOFOLLOW,O_NONBLOCK,O_DIRECTORY}=fs.constants;
      if(!Number.isInteger(O_NOFOLLOW) || !Number.isInteger(O_DIRECTORY)) {
        throw Error('Filesystem cannot enforce no-follow Score audit');
      }
      for(const entry of fs.readdirSync(absolute,{withFileTypes:true})){
        const full=path.join(absolute,entry.name);
        const child=relative?relative+'/'+entry.name:entry.name;
        if(entry.isSymbolicLink())throw Error('Symlink forbidden under Score report source: '+dir+'/'+child);
        if(entry.isDirectory()){
          const descriptor=fs.openSync(full,O_RDONLY|O_NOFOLLOW|O_DIRECTORY);
          try {
            if(!fs.fstatSync(descriptor).isDirectory()){
              throw Error('Unsupported Score report filesystem entry: '+dir+'/'+child);
            }
          }finally{fs.closeSync(descriptor);}
          visit(full,child);
        }else if(entry.isFile()){
          const descriptor=fs.openSync(full,O_RDONLY|O_NOFOLLOW|O_NONBLOCK);
          try {
            if(!fs.fstatSync(descriptor).isFile()){
              throw Error('Unsupported Score report filesystem entry: '+dir+'/'+child);
            }
            contents[dir+'/'+child]=fs.readFileSync(descriptor);
          }finally{fs.closeSync(descriptor);}
        }else{
          throw Error('Unsupported Score report filesystem entry: '+dir+'/'+child);
        }
      }
    }
    visit(location);
  }
  return contents;
}

// F1b: source directory scanning alone cannot protect content if the Astro
// Score report loader is repointed to a different, un-inventoried directory.
export const PINNED_SCORE_LOADERS=Object.freeze([
  "loader: glob({ pattern: '**/*.md', base: './src/content/weekly-reports' }),",
  "loader: glob({ pattern: '**/*.md', base: './src/content/monthly-reports' }),",
]);
export const PINNED_SCORE_CONTENT_CONFIG_BLOB='dc34afdf430a074d4118d55a4f7001564d7bcc2c';
export function checkScoreLoaderContract(configSource) {
  const failures=[];
  if(typeof configSource!=='string') return ['Missing content collection config'];
  // Exact Git-blob identity blocks commented-out original loaders, indirect
  // aliases and other untracked sources that string matching cannot detect.
  // This freezes the WHOLE collection configuration while Score rights HOLD.
  // A future legitimate schema edit needs explicit policy review and rebase.
  if(gitBlobSha1(configSource)!==PINNED_SCORE_CONTENT_CONFIG_BLOB) {
    failures.push('Unapproved Astro content collection configuration changed from locked Production main');
  }
  for(const line of PINNED_SCORE_LOADERS){
    if(configSource.split(line).length!==2) failures.push('Score report loader declaration changed or duplicated: '+line);
  }
  for(const m of configSource.matchAll(/glob\(\{[^}]*\}\)/g)){
    if(/reports|score/i.test(m[0]) && !PINNED_SCORE_LOADERS.some(l=>l.includes(m[0]))){
      failures.push('Unexpected report-like content loader: '+m[0]);
    }
  }
  return failures;
}

// Independent inspection of actual generated report pages, newsletters and
// sitemaps: a new publication date cannot be introduced while rights HOLD.
const SCORE_ARTIFACT_FAMILIES=Object.freeze([
  {dir:'reports/weekly',source:'weekly-reports',entry:/^(\d{4}-\d{2}-\d{2})$/,kind:'dir'},
  {dir:'reports/monthly',source:'monthly-reports',entry:/^(\d{4}-\d{2}-\d{2})$/,kind:'dir'},
  {dir:'newsletter/weekly',source:'weekly-reports',entry:/^(\d{4}-\d{2}-\d{2})\.json$/,kind:'file'},
  {dir:'newsletter/progress',source:'weekly-reports',entry:/^(\d{4}-\d{2}-\d{2})\.json$/,kind:'file'},
]);
export function checkBuiltScoreArtifacts(baseline, distRoot) {
  const failures=[];
  const reports=baseline?.existing_reports;
  if(!reports || typeof reports!=='object') return ['Unrecognized Score-derived HOLD inventory'];
  if(!distRoot || !fs.existsSync(distRoot)) return ['Missing built output directory'];
  const allowed=(source)=>new Set(Object.keys(reports)
    .filter(name=>name.startsWith(source+'/'))
    .map(name=>name.slice(source.length+1,-3)));
  for(const family of SCORE_ARTIFACT_FAMILIES){
    const location=path.join(distRoot,family.dir);
    if(!fs.existsSync(location)) continue;
    const dates=allowed(family.source);
    for(const entry of fs.readdirSync(location,{withFileTypes:true})){
      const match=entry.name.match(family.entry);
      const kindOk=family.kind==='dir'?entry.isDirectory():entry.isFile();
      if(!match || !kindOk){
        failures.push('Unexpected built Score-derived artifact: '+family.dir+'/'+entry.name);
      } else if(!dates.has(match[1])){
        failures.push('New built Score-derived publication on rights HOLD: '+family.dir+'/'+entry.name);
      }
    }
  }
  const weekly=allowed('weekly-reports'),monthly=allowed('monthly-reports');
  for(const name of fs.readdirSync(distRoot).filter(n=>/^sitemap(?:-[\w-]+)?\.xml$/.test(n))){
    const xml=fs.readFileSync(path.join(distRoot,name),'utf8');
    for(const found of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)){
      let pathname;
      try{pathname=new URL(found[1].replaceAll('&amp;','&')).pathname.replace(/\/+$/,'');}
      catch{failures.push('Invalid sitemap location');continue;}
      const m=pathname.match(/^\/reports\/(weekly|monthly)\/([^/]+)$/);
      if(m && !(m[1]==='weekly'?weekly:monthly).has(m[2])){
        failures.push('New Score-derived report in sitemap on rights HOLD: '+pathname);
      }
    }
  }
  return failures;
}

// Rights-HOLD provenance: 16 historical report main-body hashes obtained by
// compiling pinned Production main d1740214 and comparing the candidate under
// the exact Vercel command. This protects outputs even when source pins are
// changed, but trusted-base enforcement (F2) is a separate required gate.
export function checkFrozenHistoricalMainBodies(inventory,distRoot) {
  const failures=[];
  const historical=inventory?.rendered_main_sha256;
  const sourceNames=Object.keys(inventory?.existing_reports??{});
  const names=sourceNames.map(name=>{
    const match=/^(weekly|monthly)-reports\/(\d{4}-\d{2}-\d{2})\.md$/.exec(name);
    return match?'reports/'+match[1]+'/'+match[2]:null;
  });
  const digests=historical?.sha256;
  if(!historical||historical.source_main_commit!=='d1740214f5737996f321a037efe3f2f7d21ecd64'
    ||historical.algorithm!=='sha256_of_html_main_inner_fragment_exact_utf8'
    ||!digests||typeof digests!=='object'||Array.isArray(digests)
    ||names.length!==16||names.some(name=>!name)
    ||Object.keys(digests).length!==16
    ||names.some(name=>!Object.hasOwn(digests,name)
      ||!/^[a-f0-9]{64}$/.test(digests[name]))) {
    return ['Missing or invalid original Production historical Score body hash inventory'];
  }
  if(!distRoot||!fs.existsSync(distRoot))return ['Missing compiled Score output tree for historical body integrity'];
  for(const name of names) {
    const target=path.join(distRoot,name,'index.html');
    let html;
    try {
      if(!fs.lstatSync(target).isFile()||fs.lstatSync(target).isSymbolicLink())
        throw Error('not a real HTML file');
      html=fs.readFileSync(target,'utf8');
    }catch {
      failures.push('Missing historical Score report body on rights HOLD: '+name);
      continue;
    }
    const matches=[...html.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/gi)];
    if(matches.length!==1) {
      failures.push('Unexpected historical Score report main-body structure: '+name);
      continue;
    }
    const digest=createHash('sha256').update(Buffer.from(matches[0][1],'utf8')).digest('hex');
    if(digest!==digests[name])
      failures.push('Changed original Production historical Score report main-body on rights HOLD: '+name);
  }
  return failures;
}

// P1-A partial closure: the immutable original Score body ledger protects <main>,
// but some original Score summary facts render in the report hero, outside main.
// Pin those original-main hero and metadata regions plus 13 weekly + 13 progress
// newsletter JSON artifacts. The COMPLETE body intentionally stays HOLD: all
// 16 original-main vs current integration whole-body hashes differ, and owner
// has not approved those global-shell differences. F2 policy is still PR-owned.
const scoreRegionSha256=(value)=>createHash('sha256').update(value).digest('hex');
function normalizeHeldScoreHtmlAttributes(value) {
  return value.replace(/<[a-z][^>]*>/gi,tag=>tag
    .replace(/(\snonce\s*=\s*)(?:"[^"]*"|'[^']*')/gi,'$1"__CSP_NONCE__"')
    .replace(/(\sintegrity\s*=\s*)(?:"[^"]*"|'[^']*')/gi,'$1"__SRI_VALUE__"'));
}
function scoreHtmlAttributes(tag) {
  const values=new Map();
  for(const field of tag.matchAll(/([a-z][a-z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)){
    const name=field[1].toLowerCase();
    if(values.has(name))throw Error('Duplicate report HTML attribute: '+name);
    values.set(name,field[2]??field[3]??'');
  }
  return values;
}
export function digestFrozenScoreEnvelope(html) {
  if(typeof html!=='string')throw Error('Historical Score HTML required');
  const one=(items,label)=>{
    if(items.length!==1)throw Error('Historical Score requires one '+label);
    return items[0];
  };
  const body=one([...html.matchAll(/<body\b[^>]*>[\s\S]*?<\/body\s*>/gi)].map(m=>m[0]),'body');
  const head=one([...html.matchAll(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi)].map(m=>m[0]),'head');
  const hero=one([...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section\s*>/gi)]
    .map(m=>m[0])
    .filter(section=>/^<section\b[^>]*class\s*=\s*(?:"[^"]*reports-hero[^"]*"|'[^']*reports-hero[^']*')/i.test(section)),
    'report hero');
  const title=one([...html.matchAll(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi)].map(m=>m[0]),'title');
  const desc=one([...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(m=>m[0]).filter(meta=>scoreHtmlAttributes(meta).get('name')?.toLowerCase()==='description'),
    'description meta tag');
  const jsonld=[...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)]
    .map(m=>m[0]).filter(script=>{
      const opening=/^<script\b[^>]*>/i.exec(script);
      return opening&&scoreHtmlAttributes(opening[0]).get('type')?.toLowerCase()==='application/ld+json';
    }).map(normalizeHeldScoreHtmlAttributes);
  return {
    body:scoreRegionSha256(normalizeHeldScoreHtmlAttributes(body)),
    head:scoreRegionSha256(normalizeHeldScoreHtmlAttributes(head)),
    hero:scoreRegionSha256(normalizeHeldScoreHtmlAttributes(hero)),
    title:scoreRegionSha256(normalizeHeldScoreHtmlAttributes(title)),
    meta_description:scoreRegionSha256(normalizeHeldScoreHtmlAttributes(desc)),
    jsonld:scoreRegionSha256(JSON.stringify(jsonld)),
    jsonld_count:jsonld.length,
  };
}
export function checkFrozenScorePublishedEnvelope(inventory,distRoot) {
  const failures=[];
  const frozen=inventory?.rendered_score_envelope_sha256;
  const sourceReports=Object.keys(inventory?.existing_reports??{});
  const reportNames=sourceReports.map(x=>{
    const m=/^(weekly|monthly)-reports\/(\d{4}-\d{2}-\d{2})\.md$/.exec(x);
    return m?'reports/'+m[1]+'/'+m[2]:null;
  }).sort();
  const weeklyDates=sourceReports.map(x=>/^weekly-reports\/(\d{4}-\d{2}-\d{2})\.md$/.exec(x)?.[1]).filter(Boolean).sort();
  const expectedJson=weeklyDates.flatMap(d=>['newsletter/weekly/'+d+'.json','newsletter/progress/'+d+'.json']).sort();
  const actualReports=Object.keys(frozen?.reports??{}).sort();
  const actualJson=Object.keys(frozen?.newsletter_json??{}).sort();
  const expectedBody=Object.keys(frozen?.original_whole_body_reference_sha256??{}).sort();
  const draftWholeBody=frozen?.draft_containment_whole_body_sha256;
  const draftBodyNames=Object.keys(draftWholeBody?.sha256??{}).sort();
  const draftWholeHead=frozen?.draft_containment_whole_head_sha256;
  const draftHeadNames=Object.keys(draftWholeHead?.sha256??{}).sort();
  const originalHeadNames=Object.keys(frozen?.original_whole_head_reference_sha256??{}).sort();
  const shaOk=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
  if(!frozen||frozen.source_main_commit!=='d1740214f5737996f321a037efe3f2f7d21ecd64'
    ||frozen.normalization!=='HTML_ATTR_NONCE_INTEGRITY_VALUE_ONLY_V1'
    ||frozen.region_algorithm!=='SHA256_HTML_REPORT_HERO_TITLE_META_JSONLD_AND_RAW_NEWSLETTER_JSON_V1'
    ||frozen.whole_body_release_status!=='HOLD_16_UNAPPROVED_DIFFERENCES_FROM_PINNED_MAIN'
    ||reportNames.length!==16||reportNames.some(x=>!x)
    ||weeklyDates.length!==13||expectedJson.length!==26
    ||actualReports.join('|')!==reportNames.join('|')
    ||actualJson.join('|')!==expectedJson.join('|')
    ||expectedBody.join('|')!==reportNames.join('|')
    ||!draftWholeBody
    ||draftWholeBody.evidence_commit!=='6af6c6ce62eb86bb3712a6b7f6d977777ff86761'
    ||draftWholeBody.evidence_workflow_run!==41689499564
    ||draftWholeBody.scope!=='DRAFT_ONLY_BYTE_INTEGRITY_NOT_ORIGINAL_MAIN_LICENSE'
    ||draftWholeBody.classification_match!=='PRODUCTION_PREVIEW_16_OF_16'
    ||draftBodyNames.join('|')!==reportNames.join('|')
    ||!draftBodyNames.every(name=>shaOk(draftWholeBody.sha256[name])
      &&draftWholeBody.sha256[name]!==frozen.original_whole_body_reference_sha256[name])
    ||!draftWholeHead
    ||draftWholeHead.evidence_commit!=='3d7694260f29d16eb67bd83f65c12e8ca1cee7c3'
    ||draftWholeHead.evidence_workflow_run!==41695519712
    ||draftWholeHead.scope!=='DRAFT_ONLY_HEAD_INTEGRITY_NOT_ORIGINAL_MAIN_LICENSE'
    ||draftWholeHead.classification_match!=='PRODUCTION_PREVIEW_16_OF_16'
    ||frozen.whole_head_release_status!=='HOLD_16_UNAPPROVED_DIFFERENCES_FROM_PINNED_MAIN'
    ||originalHeadNames.join('|')!==reportNames.join('|')
    ||draftHeadNames.join('|')!==reportNames.join('|')
    ||!draftHeadNames.every(name=>shaOk(draftWholeHead.sha256[name])
      &&shaOk(frozen.original_whole_head_reference_sha256[name])
      &&draftWholeHead.sha256[name]!==frozen.original_whole_head_reference_sha256[name])
    ||!actualReports.every(name=>{
      const r=frozen.reports[name];
      return r&&['hero','title','meta_description','jsonld'].every(key=>shaOk(r[key]))
        &&Number.isInteger(r.jsonld_count)&&r.jsonld_count>=0
        &&shaOk(frozen.original_whole_body_reference_sha256[name]);
    })
    ||!actualJson.every(name=>shaOk(frozen.newsletter_json[name]))) {
    return ['Invalid original Production Score hero, metadata or newsletter digest ledger'];
  }
  if(!distRoot||!fs.existsSync(distRoot))return ['Missing output tree for original Score regions'];
  const readRegular=filename=>{
    const meta=fs.lstatSync(filename);
    if(!meta.isFile()||meta.isSymbolicLink()||meta.size>16*1024*1024)
      throw Error('not a regular bounded output');
    return fs.readFileSync(filename);
  };
  for(const name of reportNames) {
    let actual;
    try {actual=digestFrozenScoreEnvelope(readRegular(path.join(distRoot,name,'index.html')).toString('utf8'));}
    catch(err){failures.push('Missing/malformed historical Score envelope on rights HOLD: '+name);continue;}
    const golden=frozen.reports[name];
    // This Draft body snapshot is separate from original pinned Production.
    // It detects changed output anywhere in the page body, without treating
    // #1088's unapproved navigation differences as release permission.
    if(actual.body!==draftWholeBody.sha256[name])
      failures.push('Changed Draft-frozen historical Score whole body on rights HOLD: '+name);
    // B8/B9: reject unapproved head additions (Open Graph, link titles, etc.)
    // even when the Score source closure was legitimately re-pinned.
    if(actual.head!==draftWholeHead.sha256[name])
      failures.push('Changed Draft-frozen historical Score whole head on rights HOLD: '+name);
    for(const field of ['hero','title','meta_description','jsonld','jsonld_count']) {
      if(actual[field]!==golden[field])
        failures.push('Changed original Production historical Score '+field+' on rights HOLD: '+name);
    }
    // Original-vs-Draft whole-body mismatch remains owner HOLD even when
    // this within-Draft integrity comparison passes.
  }
  for(const family of ['weekly','progress']) {
    try {
      const dirname=path.join(distRoot,'newsletter',family);
      const st=fs.lstatSync(dirname);
      if(!st.isDirectory()||st.isSymbolicLink())throw Error('invalid output family');
      const current=fs.readdirSync(dirname).sort();
      const allowed=weeklyDates.map(d=>d+'.json').sort();
      if(current.join('|')!==allowed.join('|'))
        failures.push('Unapproved original Score newsletter JSON artifact list: '+family);
    } catch {failures.push('Missing original Score newsletter JSON family: '+family);}
  }
  for(const name of expectedJson) {
    try{
      const actual=scoreRegionSha256(readRegular(path.join(distRoot,name)));
      if(actual!==frozen.newsletter_json[name])
        failures.push('Changed original Production historical Score newsletter JSON on rights HOLD: '+name);
    }catch {failures.push('Missing/unreadable original Score newsletter JSON: '+name);}
  }
  return failures;
}

export function verifyCurrentScoreHold(root=webRoot) {
  const inventory=JSON.parse(fs.readFileSync(baselineFile,'utf8'));
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'scripts/score-rights-consumer-manifest.json'),'utf8'));
  const rightsHold=readGate().hold===true && manifest.state==='hold'
    && manifest.production_change_authorized===false
    && manifest.weekly_report_publication_hold_required===true
    && manifest.manual_monthly_publication_requires_rights_review===true
    && manifest.historical_content_treatment_unresolved===true;
  return [
    ...evaluateScoreContentFreeze(inventory,collectScoreContents(root),rightsHold),
    ...checkScoreLoaderContract(fs.readFileSync(path.join(root,'src','content.config.ts'),'utf8')),
  ];
}

// Staged F2 trusted checkout interface. When this module is invoked from a
// separate protected-base checkout, --root points at candidate web files;
// rights ledger, verifier and golden digests stay anchored to this module.
// Current Draft workflows do NOT constitute independent trusted F2 enforcement.
export function selectTrustedScoreSourceRoot(argv=process.argv,defaultRoot=webRoot) {
  const indices=argv.flatMap((arg,i)=>arg==='--root'?[i]:[]);
  if(indices.length>1)throw Error('Score --root may occur only once');
  if(!indices.length)return defaultRoot;
  const value=argv[indices[0]+1];
  if(typeof value!=='string'||!path.isAbsolute(value)||value.startsWith('-'))
    throw Error('Score --root requires a single absolute candidate web path');
  const target=path.resolve(value);
  if(!fs.lstatSync(target).isDirectory()||fs.lstatSync(target).isSymbolicLink())
    throw Error('Score --root must name a real directory');
  return target;
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let failures=[];
  try {
    const sourceRoot=selectTrustedScoreSourceRoot();
    failures=verifyCurrentScoreHold(sourceRoot);
    if(process.argv.includes('--built')){
      const inventory=JSON.parse(fs.readFileSync(baselineFile,'utf8'));
      failures.push(...checkBuiltScoreArtifacts(inventory,path.join(sourceRoot,'dist')));
      failures.push(...checkFrozenHistoricalMainBodies(inventory,path.join(sourceRoot,'dist')));
      failures.push(...checkFrozenScorePublishedEnvelope(inventory,path.join(sourceRoot,'dist')));
    }
  }catch(err){
    failures.push('Score trusted source/root evaluation failed: '+String(err?.message||err));
  }
  if(failures.length){
    console.error('Score-derived source rights HOLD check FAILED:\n- '+failures.join('\n- '));
    process.exitCode=1;
  }else{
    console.log('Score-derived source freeze PASS: existing 13 Weekly and 3 Monthly blobs unchanged; no new Score-derived publication; rights remain HOLD');
  }
}
