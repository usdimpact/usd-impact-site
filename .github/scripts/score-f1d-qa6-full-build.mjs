// Supplemental QA6-style full-build differential. Draft-only, unprivileged CI.
// Runs exact source heads in isolated checkouts. Never deploys, posts or uses secrets.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const HEADS=Object.freeze([
  {key:'broad-1089',root:path.resolve('apps/web'),policy:'broad'},
  {key:'focused-1090',root:path.resolve('qa1090/apps/web'),policy:'focused'},
]);
const DATE='2026-10-23';
const MARKER='QA6_CONTROLLED_LAYOUT_TAMPER_NO_RIGHTS';
const routes={
  E:'src/pages/reports/weekly/[date].astro',
  E3:'astro.config.mjs',
  F:'astro.config.mjs',
  G:'src/pages/archivo/semanal/2026-10-23/index.astro',
  H:'src/content/weekly-reports/2026-11-06.md',
  X:'src/layouts/BaseLayout.astro',
};
const cases=['E','E3','F','G','H','X'];
const results=[];
function checksum(text){return createHash('sha256').update(text).digest('hex');}
function excerpt(output){return String(output||'').split('\n').filter(x=>/F1d|Score-derived|rights HOLD|source freeze|unreviewed|Unapproved|unapproved|frozen|Invalid|Error|error/i.test(x)).slice(-5).map(x=>x.slice(0,260));}
function invoke(root,command,timeout=160000){
  // Each adversarial reproduction starts from a clean generated Astro cache.
  // Never delete the cache as part of the real application build command.
  fs.rmSync(path.join(root,'.astro'),{recursive:true,force:true});
  return spawnSync('/bin/bash',['-lc',command],{
    cwd:root,
    env:{...process.env,VERCEL_ENV:'preview',CI:'true'},
    encoding:'utf8',
    timeout,
    maxBuffer:12*1024*1024,
  });
}
function historicalOutput(root){
  const file=path.join(root,'dist','reports','weekly',DATE,'index.html');
  if(!fs.existsSync(file))return {exists:false,digest:null,marker:false};
  const source=fs.readFileSync(file,'utf8');
  return {exists:true,digest:checksum(source),marker:source.includes(MARKER)};
}
function mutate(root,which){
  const relative=routes[which],absolute=path.join(root,relative);
  const existing=fs.existsSync(absolute);
  const old=existing?fs.readFileSync(absolute,'utf8'):null;
  fs.mkdirSync(path.dirname(absolute),{recursive:true});
  let next;
  switch(which){
    case 'E':
      if(!old.includes('<span>USD Impact Score</span>'))throw Error('E fixture anchor missing');
      next=old.replace('<span>USD Impact Score</span>','<span>'+MARKER+'</span>');
      break;
    case 'E3':
      if(!old.includes('  integrations: ['))throw Error('E3 config integration anchor missing');
      next=old.replace('  integrations: [',
        "  integrations: [\n"+
        "    {name:'qa6-score-after-build',hooks:{'astro:build:done': async ({dir}) => {\n"+
        "      const {readFileSync,writeFileSync,existsSync}=await import('node:fs');\n"+
        "      const report=new URL('./reports/weekly/"+DATE+"/index.html',dir);\n"+
        "      if(existsSync(report))writeFileSync(report,readFileSync(report,'utf8')+'\\n<!-- "+MARKER+" -->');\n"+
        "    }}},");
      break;
    case 'F':
      if(!old.includes('export default defineConfig({'))throw Error('F config source anchor missing');
      next=old.replace('export default defineConfig({',
        "export default defineConfig({\n  srcDir: './alternate-src',");
      break;
    case 'G':
      if(existing)throw Error('G alternate route unexpectedly preexists');
      next='---\n// Private QA6 fixture only; never publish\n---\n<main>'+MARKER+'</main>\n';
      break;
    case 'H':{
      if(existing)throw Error('H report unexpectedly preexists');
      const source=fs.readFileSync(path.join(root,'src/content/weekly-reports/'+DATE+'.md'),'utf8');
      next=source.replaceAll(DATE,'2026-11-06');
      break;
    }
    case 'X':
      // Report-only HTML metadata in the shared BaseLayout does not change
      // the exact SEO page title inspected by unrelated learn-card validators.
      // It still modifies the rendered historical Weekly HTML digest.
      if(!old.includes('<meta name="theme-color" content="#0b1f33" />'))
        throw Error('X layout theme metadata anchor missing');
      next=old.replace('<meta name="theme-color" content="#0b1f33" />',
        '<meta name="theme-color" content="#0b1f33" />' +
        '\n    {Astro.url.pathname.startsWith("/reports/weekly/") && <meta name="qa6-score-report" content="'+MARKER+'" />}');
      break;
    default:throw Error('Unknown fixture');
  }
  fs.writeFileSync(absolute,next);
  return ()=>{
    if(existing)fs.writeFileSync(absolute,old);
    else {
      fs.rmSync(absolute,{force:true});
      if(which==='G'){
        // Git tree SHA includes empty directories under src/pages.
        // Remove disposable parent directories before the next attack.
        fs.rmSync(path.join(root,'src/pages/archivo'),{recursive:true,force:true});
      }
    }
  };
}
function checkBuild(head,which,baseline){
  const root=head.root;
  const restore=mutate(root,which);
  let run,output;
  try{
    fs.rmSync(path.join(root,'dist'),{recursive:true,force:true});
    run=invoke(root,'npm run build');
    output=historicalOutput(root);
  }finally{
    restore();
  }
  const text=(run.stdout||'')+'\n'+(run.stderr||'');
  const blocked=run.status!==0 && /F1d|Score-derived source rights HOLD check FAILED|Score F1d build-input closure FAIL|source rights HOLD/.test(text);
  const pass=which==='X'&&head.policy==='focused'
    ? run.status===0 && output.exists && output.marker && output.digest!==baseline.digest
    : blocked && !output.marker;
  return {
    head:head.key,case:which,pass,exit:run.status,signal:run.signal,
    guardBlocked:blocked,generated:output.exists,alteredHistoricalPage:output.marker,
    originalDigest:baseline.digest,changedDigest:output.digest,
    evidence:excerpt(text),
  };
}
for(const head of HEADS){
  if(!fs.existsSync(head.root))throw Error('Missing expected checkout '+head.key+' at '+head.root);
  const pkg=JSON.parse(fs.readFileSync(path.join(head.root,'package.json'),'utf8'));
  const vercel=JSON.parse(fs.readFileSync(path.join(head.root,'vercel.json'),'utf8'));
  if(!/npm run build/.test(vercel.buildCommand))throw Error('Unknown build invocation for '+head.key);
  const baselineRun=invoke(head.root,'npm run build');
  const baseline=historicalOutput(head.root);
  if(baselineRun.status!==0 || !baseline.exists || baseline.marker){
    throw Error('Clean baseline failed for '+head.key+' exit='+baselineRun.status+
       ' evidence='+JSON.stringify(excerpt((baselineRun.stdout||'')+'\n'+(baselineRun.stderr||''))));
  }
  console.log('BASELINE '+head.key+' PASS historical '+DATE+' output sha256='+baseline.digest);
  for(const which of cases){
    const row=checkBuild(head,which,baseline);
    results.push(row);
    console.log('NEGATIVE '+head.key+' '+which+' '+(row.pass?'PASS':'FAIL')+
      ' exit='+row.exit+' blocked='+row.guardBlocked+' changedHistorical='+row.alteredHistoricalPage);
    if(!row.pass)console.log('DIAGNOSTIC '+JSON.stringify(row.evidence));
  }
  // Vercel build command as configured, not merely the npm script.
  // The layout mutation should be blocked by broad policy, yet pass and
  // alter output with only the narrow page/config pins.
  const restore=mutate(head.root,'X');
  let vRun,vOut;
  try{
    fs.rmSync(path.join(head.root,'dist'),{recursive:true,force:true});
    vRun=invoke(head.root,vercel.buildCommand,200000);
    vOut=historicalOutput(head.root);
  }finally{restore();}
  const vText=(vRun.stdout||'')+'\n'+(vRun.stderr||'');
  const vBlocked=vRun.status!==0&&/F1d|Score-derived source rights HOLD check FAILED|Score F1d build-input closure FAIL/.test(vText);
  const vPass=head.policy==='focused'
    ? vRun.status===0 && vOut.marker && vOut.digest!==baseline.digest
    : vBlocked && !vOut.marker;
  results.push({head:head.key,case:'X-Vercel',pass:vPass,exit:vRun.status,
    guardBlocked:vBlocked,generated:vOut.exists,alteredHistoricalPage:vOut.marker,
    originalDigest:baseline.digest,changedDigest:vOut.digest,evidence:excerpt(vText)});
  console.log('VERCEL-BUILDCOMMAND '+head.key+' '+(vPass?'PASS':'FAIL')+
    ' exit='+vRun.status+' blocked='+vBlocked+' changedHistorical='+vOut.marker);
}
// Gate the proposed broad #1089 policy independently. The older focused #1090
// still has a separately confirmed clean Vercel validate:ux build failure:
// it must NOT be mislabeled as a bypass PASS or block the broad candidate's
// test verdict solely because its comparison command exits before rendering.
// Preserve the failed focused check explicitly in the emitted evidence.
const expected=results.length===14;
const broad=results.filter(r=>r.head==='broad-1089');
const focused=results.filter(r=>r.head==='focused-1090');
const focusedVercel=focused.find(r=>r.case==='X-Vercel');
const focusedSource=focused.filter(r=>r.case!=='X-Vercel');
const success=expected && broad.length===7 && broad.every(r=>r.pass)
  && focusedSource.length===6 && focusedSource.every(r=>r.pass);
const comparisonWarning=focusedVercel?.pass!==true
  ? 'Focused #1090 Vercel differential is NOT certified; clean validation fails on its UX build-prefix contract'
  : null;
console.log('QA6 DIFFERENTIAL FULL-BUILD RESULT '+(success?'PASS':'FAIL')+
  ' cases='+results.length+' broadBlocks='+results.filter(r=>r.head==='broad-1089'&&r.guardBlocked).length+
  ' narrowLayoutBypass='+results.some(r=>r.head==='focused-1090'&&r.case==='X'&&r.alteredHistoricalPage)+' comparisonWarning='+String(comparisonWarning));
console.log('QA6_JSON='+JSON.stringify({success,comparisonWarning,summary:'Broad candidate technical check only. Focused Vercel comparison remains uncertified. No rights clearance or trusted F2 assertion.',results}));
if(process.env.GITHUB_STEP_SUMMARY){
 const markdown=['## QA6 isolated full-build differential','',
   '| Head | Scenario | Expected technical outcome | Observation |',
   '|---|---|---|---|',
   ...results.map(r=>'| '+r.head+' | '+r.case+' | '+(r.head==='focused-1090'&&r.case.startsWith('X')?'known layout bypass':'guard rejects tampered inputs')+' | '+(r.pass?'Observed':'NOT VERIFIED')+' (exit '+r.exit+', modified='+r.alteredHistoricalPage+') |'),
   '',comparisonWarning||'Focused comparison command tested as expected',
   '', 'These checkouts are pinned immutable commits with no credentials, deployments or rights authorization.',''];
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown.join('\n'));
}
if(!success)process.exitCode=1;
