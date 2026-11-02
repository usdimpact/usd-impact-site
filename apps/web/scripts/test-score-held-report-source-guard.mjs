import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  gitBlobSha1, evaluateScoreContentFreeze, verifyCurrentScoreHold,
} from './score-held-report-source-guard.mjs';

assert.deepEqual(verifyCurrentScoreHold(), [], 'all existing historical Score sources must match the trusted main baseline');
const issue='https://github.com/usdimpact/usd-impact-pipeline/issues/155';
const fixtureBaseline={
  version:1,disposition:'hold',
  source_main_commit:'d1740214f5737996f321a037efe3f2f7d21ecd64',
  score_rights_issue:issue,
  existing_reports:{'weekly-reports/2026-07-31.md':gitBlobSha1('historical')},
};
const historical={'weekly-reports/2026-07-31.md':'historical'};
assert.deepEqual(evaluateScoreContentFreeze(fixtureBaseline,historical),[]);
assert.deepEqual(evaluateScoreContentFreeze(fixtureBaseline,{}),[], 'retiring old rights-sensitive files is not new publication');
assert.ok(evaluateScoreContentFreeze(fixtureBaseline,{...historical,'weekly-reports/2026-11-06.md':'status: published'})
  .some(s=>s.includes('New Score-derived report')));
assert.ok(evaluateScoreContentFreeze(fixtureBaseline,{...historical,'monthly-reports/2026-07-31.md':'status: published'})
  .some(s=>s.includes('New Score-derived report')));
assert.ok(evaluateScoreContentFreeze(fixtureBaseline,{'weekly-reports/2026-07-31.md':'historical\nedit'})
  .some(s=>s.includes('Changed historical')));
assert.ok(evaluateScoreContentFreeze(fixtureBaseline,historical,false)
  .some(s=>s.includes('explicitly remain HOLD')));
assert.ok(evaluateScoreContentFreeze({...fixtureBaseline,disposition:'allow'},historical)
  .some(s=>s.includes('Unrecognized Score')));
assert.ok(evaluateScoreContentFreeze({...fixtureBaseline,source_main_commit:'a'.repeat(40)},historical)
  .some(s=>s.includes('Unrecognized Score')));

// N4: unlike the earlier inconsistent synthetic example, build a fully
// date/score-consistent 4-Friday Monthly candidate. The existing structural
// validator ACCEPTS it. The rights-specific source baseline must REJECT it.
// No fixture is written into src/content or published; all files are in /tmp.
const work=fs.mkdtempSync(path.join(os.tmpdir(),'score-rights-consistent-monthly-'));
const weeklyRoot=path.join(work,'weekly');
const monthlyRoot=path.join(work,'monthly');
const weeks=[
  {start:'2026-07-06',end:'2026-07-10',value:-0.1,regime:'Balanced regime'},
  {start:'2026-07-13',end:'2026-07-17',value:-0.2,regime:'Balanced regime'},
  {start:'2026-07-20',end:'2026-07-24',value:-0.4,regime:'Soft dollar regime'},
  {start:'2026-07-27',end:'2026-07-31',value:-0.5,regime:'Soft dollar regime'},
];
function weekly(w) {
  return [
    '---','title: "Weekly '+w.end+'"','slug: "/reports/weekly/'+w.end+'"',
    'periodStart: "'+w.start+'"','periodEnd: "'+w.end+'"',
    'status: "published"','score:','  value: '+w.value,
    '  regime: "'+w.regime+'"','---','','## Methodology note','','Four source inputs.',
  ].join('\n');
}
function monthly() {
  return [
    '---','title: "Synthetic Monthly (test-only)"',
    'slug: "/reports/monthly/2026-07-31"',
    'periodStart: "2026-07-06"','periodEnd: "2026-07-31"',
    'generatedAt: "2026-08-03T12:00:00Z"',
    'lastReviewed: "2026-08-03"','status: "published"',
    'scorePath:',
    ...weeks.flatMap(w=>['  - periodEnd: "'+w.end+'"','    value: '+w.value,'    regime: "'+w.regime+'"']),
    'themes:',
    '  - title: "Policy transmission"','    summary: "First theme."',
    '    weeklyReportDates:','      - "2026-07-10"','      - "2026-07-17"',
    '  - title: "Regime path"','    summary: "Second theme."',
    '    weeklyReportDates:','      - "2026-07-24"',
    '  - title: "Cross-asset evidence"','    summary: "Third theme."',
    '    weeklyReportDates:','      - "2026-07-31"',
    'sourceWeeklyReports:',
    ...weeks.flatMap(w=>['  - periodEnd: "'+w.end+'"','    title: "Weekly '+w.end+'"','    url: "/reports/weekly/'+w.end+'"']),
    'complianceNote: "For testing only"','---','','## Methodology note','','Test-only, not a publication or a license.',
  ].join('\n');
}
try {
  fs.mkdirSync(weeklyRoot);
  fs.mkdirSync(monthlyRoot);
  for(const w of weeks)fs.writeFileSync(path.join(weeklyRoot,w.end+'.md'),weekly(w));
  const candidate=monthly();
  fs.writeFileSync(path.join(monthlyRoot,'2026-07-31.md'),candidate);
  const validator=fileURLToPath(new URL('./validate-monthly-reports.mjs',import.meta.url));
  const execution=spawnSync(process.execPath,[validator],{
    encoding:'utf8',timeout:10000,
    env:{...process.env,WEEKLY_REPORT_ROOT:weeklyRoot,MONTHLY_REPORT_ROOT:monthlyRoot},
  });
  assert.ifError(execution.error);
  assert.equal(execution.status,0,'date-consistent synthetic Monthly must demonstrate structural validator acceptance: '+execution.stderr);
  const guarded=evaluateScoreContentFreeze(fixtureBaseline,{
    ...historical,'monthly-reports/2026-07-31.md':candidate,
  });
  assert.ok(guarded.some(s=>s.includes('New Score-derived report source on rights HOLD')),
    'even structurally valid hand-committed Score Monthly must be rejected during HOLD');
}finally{
  fs.rmSync(work,{recursive:true,force:true});
}
console.log('Score rights N4 PASS: structurally valid manually prepared Score Monthly accepted by schema validator but REJECTED by new rights/source baseline; existing historical sources unchanged');
