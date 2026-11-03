// Engineering-only receipt: compare the 16 original Score <main> bodies
// against a clean pinned Production-main source build. No public publish,
// no rights/license assertion, no production or CI ruleset changes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const trustedMainSha='d1740214f5737996f321a037efe3f2f7d21ecd64';
const originalRoot=path.resolve('qa-pinned-main/apps/web');
const candidateRoot=path.resolve('apps/web');
const inventory=JSON.parse(fs.readFileSync(path.join(candidateRoot,'scripts/score-held-report-source-baseline.json'),'utf8'));
const reports=Object.keys(inventory.existing_reports??{}).sort();
assert.equal(reports.length,16,'expected 13 historical Weekly and 3 Monthly reports');

const sha=buf=>createHash('sha256').update(buf).digest('hex');
function mainDigest(root,relative){
  const filename=path.join(root,'dist',relative,'index.html');
  const html=fs.readFileSync(filename,'utf8');
  const matches=[...html.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/gi)];
  assert.equal(matches.length,1,'exactly one <main> expected in '+relative);
  return sha(Buffer.from(matches[0][1],'utf8'));
}
const verifiedBaseline={};
const differences=[];
for(const name of reports){
  const match=/^(weekly|monthly)-reports\/(\d{4}-\d{2}-\d{2})\.md$/.exec(name);
  assert.ok(match,'unknown Score report source in ledger: '+name);
  const route='reports/'+match[1]+'/'+match[2];
  const trusted=mainDigest(originalRoot,route);
  const candidate=mainDigest(candidateRoot,route);
  verifiedBaseline[route]=trusted;
  if(trusted!==candidate)differences.push({route,trusted,candidate});
}
const receipt={
  schema_version:1,
  intended_status:'draft_evidence_only',
  golden_commit:trustedMainSha,
  algorithm:'sha256_of_html_main_inner_fragment_exact_utf8',
  count:reports.length,
  matching:reports.length-differences.length,
  differences,
  sha256:verifiedBaseline,
};
console.log('SCORE_PRODUCTION_MAIN_BODY_RECEIPT_JSON='+JSON.stringify(receipt));
if(process.env.GITHUB_STEP_SUMMARY){
 const body=[
  '## Private historical Score render receipt — NO RIGHTS GRANT',
  '',
  'Pinned original Production main SHA: '+trustedMainSha,
  '',
  'Compared exactly '+reports.length+' original report <main> bodies with candidate HEAD.',
  '',
  'Matches: '+receipt.matching+'/'+receipt.count,
  'All original Score publishing/source rights and H-15/H-16 remain HOLD.',
  '',
 ];
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,body.join('\n'));
}
if(differences.length)process.exitCode=1;
