// QA7-style full-build negatives. Supplemental PR-owned engineering evidence,
// NOT an independent F2 security check, Score-rights licence, or release approval.
// Runs only in isolated GitHub Actions checkouts without deploy credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve('apps/web');
const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
assert.equal(vercel.buildCommand,'npm run validate && npm run build');
const command=vercel.buildCommand;
const MARKER='QA7_HELD_REPORT_ADVERSARIAL_FIXTURE_NOT_FOR_RELEASE';
const DATE='2026-10-23';
const historic='dist/reports/weekly/'+DATE+'/index.html';
const issue='https://github.com/usdimpact/usd-impact-pipeline/issues/155';
const baseline=JSON.parse(fs.readFileSync(path.join(root,'scripts/score-held-report-source-baseline.json'),'utf8'));
assert.equal(baseline.score_rights_issue,issue);
assert.equal(Object.keys(baseline.existing_reports||{}).length,16);
const fixture={
  E4:{file:'src/lib/localization-policy.js',trigger:'Changed frozen build input: src/lib/localization-policy.js'},
  E5:{file:'src/components/FrameworkEvidenceChain.astro',trigger:'Changed frozen build input: src/components/FrameworkEvidenceChain.astro'},
  E6:{file:'src/layouts/BaseLayout.astro',trigger:'Changed frozen build input: src/layouts/BaseLayout.astro'},
  G2b:{file:'public/data/score-archive/2026-11-06.json',trigger:'New unreviewed build input: public/data/score-archive/2026-11-06.json'},
  G3:{file:'vercel.json',trigger:'Changed frozen build input: vercel.json'},
};
const outcomes=[],hashes={};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function run(mode){
  // Reproduce a clean checkout for each case; a prior Astro build populates
  // .astro and must not mask the specific malicious input being tested.
  fs.rmSync(path.join(root,'.astro'),{recursive:true,force:true});
  return spawnSync('/bin/bash',['-lc',command],{
    cwd:root,env:{...process.env,VERCEL_ENV:mode,CI:'true'},
    encoding:'utf8',maxBuffer:16*1024*1024,timeout:240000,
  });
}
function rendered(){
  const p=path.join(root,historic);
  if(!fs.existsSync(p))return {exists:false,marker:false,sha:null};
  const b=fs.readFileSync(p);
  return {exists:true,marker:b.includes(Buffer.from(MARKER)),sha:digest(b)};
}
function reportHashes(){
  const result={};
  for(const name of Object.keys(baseline.existing_reports)){
    const m=/^(weekly|monthly)-reports\/(\d{4}-\d{2}-\d{2})\.md$/.exec(name);
    if(!m)throw Error('Unexpected Score source baseline name: '+name);
    const p=path.join(root,'dist','reports',m[1],m[2],'index.html');
    result[m[1]+'/'+m[2]]=fs.existsSync(p)?digest(fs.readFileSync(p)):null;
  }
  return result;
}
function mutate(name){
  const meta=fixture[name],p=path.join(root,meta.file);
  const beforeExists=fs.existsSync(p);
  const previous=beforeExists?fs.readFileSync(p,'utf8'):null;
  if(name==='G2b'&&beforeExists)throw Error('G2b collision: refusing to alter preexisting public file');
  let edited;
  if(name==='E4'){
    assert.ok(previous.includes('export'),'E4 target must be a JS module');
    edited=previous+"\nimport { existsSync as qa7Exists, readFileSync as qa7Read, writeFileSync as qa7Write } from 'node:fs';\n"+
      "process.once('exit',()=>{const p=process.cwd()+'/dist/reports/weekly/"+DATE+
      "/index.html';if(qa7Exists(p))qa7Write(p,qa7Read(p,'utf8')+'\\n<!-- "+MARKER+" -->');});\n";
  }else if(name==='E5'){
    assert.ok(previous.includes('USD Impact evidence chain'),'E5 component anchor missing');
    edited=previous.replace('USD Impact evidence chain','USD Impact evidence chain '+MARKER);
  }else if(name==='E6'){
    const anchor='<meta name="theme-color" content="#0b1f33" />';
    assert.ok(previous.includes(anchor),'E6 shared layout anchor missing');
    edited=previous.replace(anchor,anchor+
      '\n    {Astro.url.pathname.startsWith("/reports/weekly/") && <meta name="qa7-score-report" content="'+MARKER+'" />}');
  }else if(name==='G2b'){
    edited=JSON.stringify({date:'2026-11-06',note:MARKER,
      provenance:'UNAPPROVED SOURCE/RIGHTS QA FIXTURE',score:9.99})+'\n';
  }else if(name==='G3'){
    const v=JSON.parse(previous);
    if(!Array.isArray(v.rewrites))throw Error('G3 source rewrites not array');
    v.rewrites.unshift({source:'/reports/weekly/:d',destination:'/api/account?action='+MARKER});
    edited=JSON.stringify(v,null,2)+'\n';
    JSON.parse(edited);
  }else throw Error('Unknown QA7 scenario');
  fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p,edited,'utf8');
  return ()=>{
    if(beforeExists)fs.writeFileSync(p,previous,'utf8');
    else{
      fs.rmSync(p,{force:true});
      // Remove only the temporary test directory created in an empty path.
      fs.rmSync(path.join(root,'public/data/score-archive'),{force:true,recursive:true});
    }
  };
}
function printFailure(out){
  return String(out).split('\n').filter(line=>/Score F1d|Changed frozen build input|New unreviewed build input|Error:|error|FAIL/.test(line)).slice(-7).map(l=>l.slice(0,310));
}
function attempt(mode,name){
  const restore=mutate(name);
  let result,page,leaked;
  try{
    fs.rmSync(path.join(root,'dist'),{recursive:true,force:true});
    result=run(mode);
    page=rendered();
    leaked=fs.existsSync(path.join(root,'dist/data/score-archive/2026-11-06.json'));
  }finally{restore();}
  const log=(result.stdout||'')+'\n'+(result.stderr||'');
  const trigger=fixture[name].trigger;
  const pass=result.status!==0 && !result.signal &&
    log.includes('Score F1d build-input closure FAIL') && log.includes(trigger) &&
    !page.marker && !leaked;
  const value={mode,case:name,status:result.status,signal:result.signal,
    guard:'F1d build-input closure',expected:trigger,rejected:pass,
    historicalPageExists:page.exists,historicalPageSha256:page.sha,
    markerInHistoricalPage:page.marker,scoreJSONCopied:leaked,
    evidence:printFailure(log)};
  outcomes.push(value);
  console.log('QA7_ATTACK '+mode+' '+name+' '+(pass?'REJECTED_AS_EXPECTED':'UNEXPECTED')+
    ' exit='+result.status+' marker='+page.marker+' jsonCopied='+leaked);
  if(!pass)console.log('QA7_DIAGNOSTIC '+JSON.stringify(value));
}
for(const mode of ['production','preview']){
  fs.rmSync(path.join(root,'dist'),{recursive:true,force:true});
  const good=run(mode);
  const page=rendered();
  if(good.status!==0||!page.exists||page.marker){
    console.error('QA7_CLEAN_FAILURE '+mode+' '+JSON.stringify(printFailure((good.stdout||'')+'\n'+(good.stderr||''))));
    process.exit(1);
  }
  const reports=reportHashes();
  hashes[mode]=reports;
  const created=Object.values(reports).filter(Boolean).length;
  console.log('QA7_CLEAN '+mode+' PASS historical_sha256='+page.sha+' historical_reports='+created+
    '/16 rights_HOLD='+issue);
  for(const name of Object.keys(fixture))attempt(mode,name);
}
const unchanged=Object.keys(hashes.production).filter(n=>hashes.production[n]!==null&&hashes.production[n]===hashes.preview[n]);
const changed=Object.keys(hashes.production).filter(n=>hashes.production[n]!==hashes.preview[n]);
const complete=outcomes.length===10 && outcomes.every(x=>x.rejected);
console.log('QA7_FULL_BUILD '+(complete?'TEN_OF_TEN_REJECTED':'FAILED')+
  ' guarded='+outcomes.filter(x=>x.rejected).length+
  ' cleanHistoricalMatchesAcrossEnvs='+unchanged.length+
  ' environmentDependentOrMissing='+changed.length);
console.log('QA7_JSON='+JSON.stringify({complete,scoreRights:'HOLD',f2:'UNTRUSTED_PR_OWNED',
  cases:outcomes,cleanReportHashes:{production:hashes.production,preview:hashes.preview},
  crossMode:{same:unchanged,changed}}));
if(process.env.GITHUB_STEP_SUMMARY){
  const lines=['## Supplemental QA7 actual Vercel-build-command negatives','',
   '**PR-owned test only — not independent Claude QA, F2 certification, provider rights or release permission.**','',
   '| Mode | Case | Result | Exit | Historical marker | Extra JSON |',
   '|---|---|---|---:|---|---|',
   ...outcomes.map(x=>'| '+x.mode+' | '+x.case+' | '+(x.rejected?'Source guard blocked':'FAIL / requires investigation')+
     ' | '+x.status+' | '+x.markerInHistoricalPage+' | '+x.scoreJSONCopied+' |'),
   '', 'Observed report outputs matching between Production and Preview classification: '+unchanged.length,
   'Changed or absent between classifications: '+changed.length,
   '', 'Original Score source redistribution rights, semantic derived content and independent F2 remain HOLD.',''];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n'));
}
if(!complete)process.exitCode=1;

// QA9 B8/B9: actual Astro full-build negatives even if the candidate
// re-pins its own F1d source manifest. This is not trusted F2 enforcement.
// Changed report heads reach local dist; the --built rights guard must fail.
const layoutRelative='src/layouts/BaseLayout.astro';
const closureRelative='scripts/score-held-build-closure-baseline.json';
function gitBlobSha1(contents) {
  return createHash('sha1').update(Buffer.from('blob '+contents.length+'\0')).update(contents).digest('hex');
}
function attemptRePinnedHead(mode,name,newTag) {
  const layoutFile=path.join(root,layoutRelative);
  const manifestFile=path.join(root,closureRelative);
  const layoutOriginal=fs.readFileSync(layoutFile,'utf8');
  const manifestOriginal=fs.readFileSync(manifestFile,'utf8');
  const anchor='<meta name="theme-color" content="#0b1f33" />';
  let result,html='',testPassed=false;
  try {
    assert.ok(layoutOriginal.includes(anchor),name+' expected layout source anchor');
    const insertion='\n    {Astro.url.pathname.startsWith("/reports/") && '+newTag+'}';
    const modified=layoutOriginal.replace(anchor,anchor+insertion);
    fs.writeFileSync(layoutFile,modified,'utf8');
    const manifest=JSON.parse(manifestOriginal);
    assert.ok(manifest.pinned_files?.[layoutRelative],name+' layout pin missing');
    manifest.pinned_files[layoutRelative]=gitBlobSha1(Buffer.from(modified));
    fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
    fs.rmSync(path.join(root,'dist'),{recursive:true,force:true});
    result=run(mode);
    const resultPath=path.join(root,historic);
    html=fs.existsSync(resultPath)?fs.readFileSync(resultPath,'utf8'):'';
    const logs=(result.stdout??'')+'\n'+(result.stderr??'');
    const denied=logs.includes('Score-derived source rights HOLD check FAILED')
      &&logs.includes('Changed Draft-frozen historical Score whole head on rights HOLD');
    const sourceDidNotBlock=!logs.includes('Score F1d build-input closure FAIL');
    const renderReachedDist=html.includes('QA9-HEAD-ONLY-'+name);
    testPassed=result.status!==0&&!result.signal&&denied&&sourceDidNotBlock&&renderReachedDist;
    const evidence={mode,case:name,exit:result.status,headGuardDenied:denied,
      sourceClosureRePinned:sourceDidNotBlock,alteredHeadReachedLocalDist:renderReachedDist,
      accepted:testPassed,logs:printFailure(logs)};
    console.log('QA9_HEAD_ACTUAL_BUILD '+JSON.stringify(evidence));
    return evidence;
  }finally{
    fs.writeFileSync(layoutFile,layoutOriginal,'utf8');
    fs.writeFileSync(manifestFile,manifestOriginal,'utf8');
    fs.rmSync(path.join(root,'dist'),{recursive:true,force:true});
    fs.rmSync(path.join(root,'.astro'),{recursive:true,force:true});
  }
}
const headAttacks=[
  attemptRePinnedHead('preview','B8','<meta property="og:description" content="QA9-HEAD-ONLY-B8 USD Impact Weekly Score is 9.99" />'),
  attemptRePinnedHead('preview','B9','<link rel="alternate" href="/qa9-held-score" title="QA9-HEAD-ONLY-B9 Weekly Score: 9.99/10" />'),
];
const headPass=headAttacks.length===2&&headAttacks.every(x=>x.accepted);
console.log('QA9_B8_B9_ACTUAL_HEAD_REPIN_JSON='+JSON.stringify({headPass,
  exactBuild:command,rights:'HOLD',f2:'UNTRUSTED_PR_OWNED',attacks:headAttacks}));
if(!headPass)process.exitCode=1;

// QA10 B10: genuine local Astro build with the candidate's BaseLayout source
// hash deliberately self-repinned. An out-of-body visible Score paragraph
// must reach isolated dist, and fail specifically at whole-document built
// rights verification, not at an unrelated validator or source freeze.
function attemptRePinnedDocumentTail(mode) {
  const layoutFile=path.join(root,layoutRelative);
  const manifestFile=path.join(root,closureRelative);
  const originalLayout=fs.readFileSync(layoutFile,'utf8');
  const originalManifest=fs.readFileSync(manifestFile,'utf8');
  const anchor='  </body>\n</html>';
  const marker='QA10-B10-OUTSIDE-BODY-SCORE-9.99';
  let outcome;
  try {
    assert.ok(originalLayout.includes(anchor),'QA10 B10 expected Astro outer document tail');
    const modified=originalLayout.replace(anchor,
      '  </body>\n    {Astro.url.pathname.startsWith("/reports/") && <p>'+marker+'</p>}\n</html>');
    fs.writeFileSync(layoutFile,modified,'utf8');
    const manifest=JSON.parse(originalManifest);
    assert.ok(manifest.pinned_files?.[layoutRelative],'QA10 layout must have an F1d source pin');
    manifest.pinned_files[layoutRelative]=gitBlobSha1(Buffer.from(modified));
    fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
    fs.rmSync(path.join(root,'dist'),{recursive:true,force:true});
    const result=run(mode);
    const generated=path.join(root,historic);
    const html=fs.existsSync(generated)?fs.readFileSync(generated,'utf8'):'';
    const logs=(result.stdout??'')+'\n'+(result.stderr??'');
    const rightsDenied=logs.includes('Score-derived source rights HOLD check FAILED')
      &&logs.includes('Changed Draft-frozen historical Score complete document on rights HOLD');
    const inputRepinAccepted=!logs.includes('Score F1d build-input closure FAIL');
    const locallyRendered=html.includes(marker);
    outcome={case:'B10',mode,exit:result.status,signal:result.signal,
      sourceRepinAccepted:inputRepinAccepted,scoreDocumentGuardDenied:rightsDenied,
      alteredHtmlInLocalDist:locallyRendered,
      accepted:result.status!==0&&!result.signal&&rightsDenied&&inputRepinAccepted&&locallyRendered,
      logs:printFailure(logs)};
    console.log('QA10_B10_ACTUAL_BUILD '+JSON.stringify(outcome));
  }finally {
    fs.writeFileSync(layoutFile,originalLayout,'utf8');
    fs.writeFileSync(manifestFile,originalManifest,'utf8');
    fs.rmSync(path.join(root,'dist'),{recursive:true,force:true});
    fs.rmSync(path.join(root,'.astro'),{recursive:true,force:true});
  }
  return outcome;
}
const b10=attemptRePinnedDocumentTail('preview');
console.log('QA10_B10_ACTUAL_DOCUMENT_REPIN_JSON='+JSON.stringify({accepted:b10.accepted,
  exactBuild:command,rights:'HOLD',f2:'UNTRUSTED_PR_OWNED',case:b10}));
if(!b10.accepted)process.exitCode=1;


