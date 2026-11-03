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
      for(const entry of fs.readdirSync(absolute,{withFileTypes:true})){
        const full=path.join(absolute,entry.name);
        const child=relative?relative+'/'+entry.name:entry.name;
        const info=fs.lstatSync(full);
        if(info.isSymbolicLink())throw Error('Symlink forbidden under Score report source: '+dir+'/'+child);
        if(info.isDirectory())visit(full,child);
        else if(info.isFile())contents[dir+'/'+child]=fs.readFileSync(full);
        else throw Error('Unsupported Score report filesystem entry: '+dir+'/'+child);
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


// F1d: freeze the Astro renderer and route surface as Git-identity snapshots.
// Includes ALL src/pages files: a new alternate Score route, an edited report
// template, or an Astro build hook must fail even if it reuses a held date.
// Two explicitly reviewed snapshots are allowed: #1087's security stack and
// #1088's main-compatible branded Monthly integration. Neither is a license.
// This is strict during rights HOLD: new/changed legitimate routes require a
// separately reviewed policy update before their build may pass.
export const F1D_RENDER_PINS=Object.freeze({
  astroConfig:'4c0313a910f85402af9e0421048cac1d0e328b4e',
  pageTrees:Object.freeze([
    '8cf3d1fd29a3d4b7fc4f1aacfbd52ac828064c25', // #1087
    'f6baaba42ab4d04e122f071f3d942e4890d36816', // #1088
  ]),
  vercelBuildCommand:'node scripts/score-held-report-source-guard.mjs && npm run validate && npm run build && node scripts/score-held-report-source-guard.mjs --built',
});

// Reconstruct the git tree object independently of .git availability, which
// is not guaranteed inside Vercel's source checkout.
export function gitTreeSha1(directory) {
  const items=fs.readdirSync(directory,{withFileTypes:true}).map(entry=>{
    const full=path.join(directory,entry.name);
    const stat=fs.lstatSync(full);
    if(stat.isSymbolicLink()) throw Error('Symlink forbidden in protected route tree: '+entry.name);
    if(stat.isDirectory()) return {name:entry.name,sort:entry.name+'/',mode:'40000',sha:gitTreeSha1(full)};
    if(stat.isFile()) return {
      name:entry.name,sort:entry.name,
      mode:(stat.mode&0o111)?'100755':'100644',
      sha:gitBlobSha1(fs.readFileSync(full)),
    };
    throw Error('Unsupported protected route entry: '+entry.name);
  }).sort((a,b)=>Buffer.compare(Buffer.from(a.sort),Buffer.from(b.sort)));
  const bytes=Buffer.concat(items.map(item=>Buffer.concat([
    Buffer.from(item.mode+' '+item.name+'\0'),
    Buffer.from(item.sha,'hex'),
  ])));
  return createHash('sha1').update('tree '+bytes.length+'\0').update(bytes).digest('hex');
}

export function checkFrozenScoreRenderSurfaces(root=webRoot,pins=F1D_RENDER_PINS) {
  const failures=[];
  try{
    const astro=fs.readFileSync(path.join(root,'astro.config.mjs'));
    if(gitBlobSha1(astro)!==pins.astroConfig)
      failures.push('F1d: unapproved Astro config / srcDir / build hook modification');
  }catch{
    failures.push('F1d: missing or unreadable Astro config');
  }
  try{
    const pages=path.join(root,'src','pages');
    if(!fs.lstatSync(pages).isDirectory() || fs.lstatSync(pages).isSymbolicLink())
      throw Error('Invalid protected route directory');
    if(!pins.pageTrees.includes(gitTreeSha1(pages)))
      failures.push('F1d: unapproved page templates or alternate route tree');
  }catch{
    failures.push('F1d: missing, symlinked or unreadable protected route tree');
  }
  try{
    const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
    if(vercel.buildCommand!==pins.vercelBuildCommand)
      failures.push('F1d/F3: Vercel build must run source and built rights guards');
    if(vercel.git?.deploymentEnabled?.['agent/*']!==false)
      failures.push('F1d/F3: held agent branches must not deploy automatically');
  }catch{
    failures.push('F1d/F3: missing or invalid Vercel deployment policy');
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
    ...checkFrozenScoreRenderSurfaces(root),
  ];
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const failures=verifyCurrentScoreHold();
  if(process.argv.includes('--built')){
    const inventory=JSON.parse(fs.readFileSync(baselineFile,'utf8'));
    failures.push(...checkBuiltScoreArtifacts(inventory,path.join(webRoot,'dist')));
  }
  if(failures.length){
    console.error('Score-derived source rights HOLD check FAILED:\n- '+failures.join('\n- '));
    process.exitCode=1;
  }else{
    console.log('Score-derived source freeze PASS: existing 13 Weekly and 3 Monthly blobs unchanged; no new Score-derived publication; rights remain HOLD');
  }
}
