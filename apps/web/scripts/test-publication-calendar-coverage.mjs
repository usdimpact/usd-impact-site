import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditCalendarCoverage, coverageFamily } from './audit-publication-calendar-coverage.mjs';
let tests = 0;
const test = (name, fn) => { fn(); tests++; };
for (const [name, expected] of [['BLS Consumer Price Index for August 2026','BLS:CPI'], ['BLS Producer Price Index (PPI) for August 2026','BLS:PPI'], ['BLS Employment Situation August','BLS:EMPSIT'], ['BEA PCE','BEA:UNSUPPORTED'], ['FOMC minutes','FED:UNSUPPORTED'], ['EIA petroleum','EIA:UNSUPPORTED'], ['Treasury buybacks','TREASURY:UNSUPPORTED'], ['BLS JOLTS','BLS:OTHER_UNSUPPORTED'], ['something else','UNKNOWN']]) test('bounded non-authoritative family hint', () => assert.equal(coverageFamily(name), expected));
const directory=mkdtempSync(join(tmpdir(),'calendar-coverage-'));
const source = (date, event) => `---\nstatus: "published"\ndate: "${date}"\ncatalysts: ${JSON.stringify([{date:'2026-09-11',event,calendar:null}])}\n---\nBody\n`;
try {
  writeFileSync(join(directory,'2026-09-09.md'),source('2026-09-09','BLS Consumer Price Index for August 2026'));
  writeFileSync(join(directory,'2026-09-08.md'),source('2026-09-08','Federal Reserve FOMC'));
  test('recognized series is not verified or authorized',()=>{
    const report=auditCalendarCoverage({directory,asOf:'2026-09-09',limit:1});
    assert.equal(report.decision,'DIAGNOSTIC_ONLY');assert.equal(report.rows.length,1);
    assert.equal(report.rows[0].recordState,'HOLD_MISSING_CALENDAR_RECORD');assert.equal(report.publicationAuthorized,false);assert.equal(report.rows[0].freshSourceVerified,false);
  });
  test('unsupported family remains in the inventory',()=>{
    const report=auditCalendarCoverage({directory,asOf:'2026-09-09',limit:12});
    assert.equal(report.familyCounts['FED:UNSUPPORTED'],1);assert.equal(report.rows[1].recordState,'HOLD_UNSUPPORTED_EVENT');
  });
  test('diagnostic date limits scope but cannot authorize publication',()=>{
    const report=auditCalendarCoverage({directory,asOf:'2026-09-08',limit:12});assert.equal(report.editions.length,1);assert.equal(report.publicationAuthorized,false);
  });
  test('invalid dates are rejected',()=>assert.throws(()=>auditCalendarCoverage({directory,asOf:'2026-02-30'})));
  test('unbounded inventory selection rejected',()=>assert.throws(()=>auditCalendarCoverage({directory,limit:1000})));
  writeFileSync(join(directory,'2026-09-10.md'),'---\nstatus: "published"\nstatus: "review"\n---\n');
  test('ambiguous metadata is an explicit incomplete audit',()=>assert.equal(auditCalendarCoverage({directory,asOf:'2026-09-10'}).decision,'HOLD_COVERAGE_INCOMPLETE'));
  symlinkSync(join(directory,'2026-09-09.md'),join(directory,'2026-09-11.md'));
  test('symlink cannot become coverage evidence',()=>assert.ok(auditCalendarCoverage({directory,asOf:'2026-09-11'}).errors.some(x=>x.file==='2026-09-11.md')));
} finally { rmSync(directory,{recursive:true,force:true}); }
console.log(`Publication calendar coverage audit: ${tests} regression groups passed (temporary local fixtures; not publication evidence).`);
