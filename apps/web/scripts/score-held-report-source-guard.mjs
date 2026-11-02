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
  if (!baseline || baseline.version!==1 || baseline.disposition!=='hold'
    || baseline.source_main_commit!=='d1740214f5737996f321a037efe3f2f7d21ecd64'
    || baseline.score_rights_issue!=='https://github.com/usdimpact/usd-impact-pipeline/issues/155'
    || !baseline.existing_reports || typeof baseline.existing_reports!=='object') {
    failures.push('Unrecognized Score-derived HOLD inventory');
    return failures;
  }
  if (rightsHold!==true) failures.push('Rights gate must explicitly remain HOLD');
  if (!current || typeof current!=='object' || Array.isArray(current)) {
    return [...failures,'No Score-derived content inventory supplied'];
  }
  for (const [name,expectedSha] of Object.entries(baseline.existing_reports)) {
    if (!/^(?:weekly|monthly)-reports\/\d{4}-\d{2}-\d{2}\.md$/.test(name)
        || !/^[a-f0-9]{40}$/.test(expectedSha)) {
      failures.push('Malformed historical rights inventory entry: '+name);
    }
  }
  for (const [name,contents] of Object.entries(current)) {
    if (!/^(?:weekly|monthly)-reports\/\d{4}-\d{2}-\d{2}\.md$/.test(name)) {
      failures.push('Unexpected Score report source path: '+name);
      continue;
    }
    const expected=baseline.existing_reports[name];
    if (!expected) failures.push('New Score-derived report source on rights HOLD: '+name);
    else if (gitBlobSha1(contents)!==expected) {
      failures.push('Changed historical Score-derived report source on rights HOLD: '+name);
    }
  }
  // Deleting an old report does not introduce a new publication; allowing
  // its deletion is NOT approval to republish it elsewhere.
  return failures;
}

export function collectScoreContents(root=webRoot) {
  const contents={};
  for(const dir of ['weekly-reports','monthly-reports']){
    const location=path.join(root,'src','content',dir);
    if(!fs.existsSync(location)) throw Error('Missing Score report source directory: '+dir);
    for(const file of fs.readdirSync(location)){
      if(!file.endsWith('.md'))continue;
      contents[dir+'/'+file]=fs.readFileSync(path.join(location,file));
    }
  }
  return contents;
}

export function verifyCurrentScoreHold(root=webRoot) {
  const inventory=JSON.parse(fs.readFileSync(baselineFile,'utf8'));
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'scripts/score-rights-consumer-manifest.json'),'utf8'));
  const rightsHold=readGate().hold===true && manifest.state==='hold'
    && manifest.production_change_authorized===false
    && manifest.weekly_report_publication_hold_required===true
    && manifest.manual_monthly_publication_requires_rights_review===true
    && manifest.historical_content_treatment_unresolved===true;
  return evaluateScoreContentFreeze(inventory,collectScoreContents(root),rightsHold);
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const failures=verifyCurrentScoreHold();
  if(failures.length){
    console.error('Score-derived source rights HOLD check FAILED:\n- '+failures.join('\n- '));
    process.exitCode=1;
  }else{
    console.log('Score-derived source freeze PASS: existing 13 Weekly and 3 Monthly blobs unchanged; no new Score-derived publication; rights remain HOLD');
  }
}
