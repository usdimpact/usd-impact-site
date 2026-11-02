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
