// N1b pure read-only review fixtures. Never writes to repo or to Production.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {reviewText,compareCorpora} from './n1b-held-score-dynamic-review.mjs';

const safe=[
 'impactScore: 5', // Catalyst impact score is IMPORTANCE, not original Score
 'The BLS ECI grew 0.8% during the third quarter.',
 'Three Dials v2: use eligible USD, real rate and liquidity inputs, not intraday proxies.',
 'This article does not publish a current numerical Three Dials reading or an original Weekly Score.',
 'An educational weekly checklist can be replicated with rights-cleared licensed datasets.',
 'The 2026-11-03 Daily draws on published Treasury facts and BLS calendar entries.',
 'Original USD Impact Score methodology is described in a separate held source contract.',
];
for(const example of safe){
  const got=reviewText(example);
  assert.deepEqual(got.holds,[],'Safe editorial content was blocked: '+example);
  assert.deepEqual(got.reviews,[],'Ordinary methodology or dated source facts should not require review: '+example);
}
const blocked=[
 ['USD Impact Weekly Score: 8.3/10','original_weekly_score_value_or_regime'],
 ['Original Weekly Score is 7','original_weekly_score_value_or_regime'],
 ['Our Weekly Score now reads 4/5','original_weekly_score_value_or_regime'],
 ['Weekly Score is bearish','original_weekly_score_value_or_regime'],
 ['USD Impact Score value: 9.99','original_weekly_score_value_or_regime'],
 ['Three Dials reading is 4/5','unverified_three_dials_numeric_or_regime'],
 ['Tres Diales: 4/5','unverified_three_dials_numeric_or_regime'],
 ['Three Dials regime is bullish','unverified_three_dials_numeric_or_regime'],
 ['USD Impact Weekly Score: ８.３/１０','original_weekly_score_value_or_regime'],
 ['Our Week\u200bly Score: 5/10','original_weekly_score_value_or_regime'],
 ['Source: /data/usd_impact_score_v2.json','held_score_derived_file_link'],
 ['https://usd-impact.com/data/weekly_input_latest.json','held_score_derived_file_link'],
 ['see /data/research/score_v2_point_in_time_latest.json','held_score_derived_file_link'],
 ['Puntuación semanal de USD Impact: 8/10','original_weekly_score_value_or_regime'],
 ['Puntaje de USD Impact: bajista','original_weekly_score_value_or_regime'],
 ['Original Weekly Score:\n8/10','original_weekly_score_value_or_regime'],
 ['impactScore: 4, USD Impact Weekly Score: 8/10','original_weekly_score_value_or_regime'],
 ['X'.repeat(4200)+' USD Impact Weekly Score: 8/10','original_weekly_score_value_or_regime'],
];
for(const [example,rule] of blocked){
  const got=reviewText(example);
  assert.ok(got.holds.some(x=>x.rule===rule),'N1b failed to flag high-confidence risk: '+example);
}
const note=reviewText('Weekly Score was described as a method during 2026, but no live reading was claimed.');
assert.deepEqual(note.holds,[]);
assert.ok(note.reviews.length>0,'Ambiguous historical mention should prompt an editorial review, not publication clearance');
const ambiguous=reviewText('Original Weekly Score for November 2026 was 8.3');
assert.deepEqual(ambiguous.holds,[]);
assert.ok(ambiguous.reviews.length,'Contextual Score numbers must require manual review');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'n1b-readonly-'));
const base=path.join(tmp,'base'),pr=path.join(tmp,'candidate');
function mkdirRoot(root){
  fs.mkdirSync(path.join(root,'src/content/news'),{recursive:true});
  fs.mkdirSync(path.join(root,'src/content/catalyst-briefs'),{recursive:true});
}
function put(root,group,file,content){
  const p=path.join(root,'src/content',group,file);
  fs.writeFileSync(p,content);
}
try{
  mkdirRoot(base);mkdirRoot(pr);
  const simple='---\nstatus: published\n---\nPrimary-source evidence and no original Score value.\n';
  put(base,'news','2026-11-02.md',simple);
  put(pr,'news','2026-11-02.md',simple);
  const ok=compareCorpora(base,pr);
  assert.equal(ok.pass,true);
  assert.equal(ok.changed.length,0);
  const source='---\nstatus: published\nimpactScore: 5\n---\nBLS data rose 0.8%; generic Three Dials methodology only.\n';
  put(pr,'news','2026-11-03.md',source);
  put(pr,'catalyst-briefs','2026-11-03-test-outcome.md',source);
  const good=compareCorpora(base,pr,{expectChanges:true});
  assert.equal(good.pass,true,'Unrelated verified economics and catalyst impact importance must remain publishable');
  assert.equal(good.changed.length,2);
  put(pr,'news','2026-11-03.md',source+'\nOriginal Weekly Score is 9.99/10\n');
  const bad=compareCorpora(base,pr);
  assert.equal(bad.pass,false);
  assert.equal(bad.holds.length,1);
  assert.equal(bad.holds[0].file,'news/2026-11-03.md');
  // Even an edited old story must be checked, not only new filenames.
  put(pr,'news','2026-11-02.md',simple+'Weekly Score: 8/10\n');
  assert.equal(compareCorpora(base,pr).holds.length,2);
  assert.equal(compareCorpora(base,pr,{expectChanges:true}).pass,false);
  // A score mention that is not a high-confidence literal detection must NOT
  // be reported as a clean policy review.
  put(pr,'news','2026-11-02.md',simple);
  put(pr,'news','2026-11-03.md',source+'Original Weekly Score for November 2026 was 8.3\n');
  const ambiguousCorpus=compareCorpora(base,pr);
  assert.equal(ambiguousCorpus.holds.length,0);
  assert.ok(ambiguousCorpus.reviews.length>0);
  assert.equal(ambiguousCorpus.pass,false,'Manual review cannot be silently approved');
  put(pr,'news','2026-11-03.md',source);
  put(pr,'news','2026-11-02.md',simple);
  const restored=compareCorpora(base,pr);
  assert.equal(restored.pass,true);
  fs.unlinkSync(path.join(pr,'src/content/news/2026-11-02.md'));
  const removed=compareCorpora(base,pr);
  assert.deepEqual(removed.deleted,['news/2026-11-02.md']);
  assert.equal(removed.pass,false,'Unexpected deletion must request editorial review');
  put(pr,'news','2026-11-02.md',simple);
  // Explicit missing context must fail rather than silently assume a valid root.
  assert.throws(()=>compareCorpora('relative',pr),/Absolute web-root/);
  // Symlink inside the dynamic content folder must block read-only scans.
  const dest=path.join(pr,'src/content/news','2026-11-02.md');
  fs.symlinkSync(dest,path.join(pr,'src/content/news','2026-11-04.md'));
  assert.throws(()=>compareCorpora(base,pr),/Unsupported dynamic content entry/);
  fs.unlinkSync(path.join(pr,'src/content/news','2026-11-04.md'));
  // Files with an allowed ignore-name must still be ordinary regular files.
  fs.symlinkSync(dest,path.join(pr,'src/content/news/.gitkeep'));
  assert.throws(()=>compareCorpora(base,pr),/Unsafe \.gitkeep/);
  fs.unlinkSync(path.join(pr,'src/content/news/.gitkeep'));
  // No intermediate source-folder symlinks may escape the checkout.
  const srcDir=path.join(pr,'src'),temporary=path.join(pr,'src-for-qa-test');
  fs.renameSync(srcDir,temporary);
  fs.symlinkSync(temporary,srcDir);
  assert.throws(()=>compareCorpora(base,pr),/Invalid dynamic content ancestor/);
  fs.unlinkSync(srcDir);
  fs.renameSync(temporary,srcDir);
  // A malformed UTF-8 document must not be decoded with replacement characters.
  fs.writeFileSync(path.join(pr,'src/content/news','2026-11-03.md'),Buffer.from([0xc3,0x28]));
  assert.throws(()=>compareCorpora(base,pr),/encoded|valid|UTF|data|encoding/i);
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}
console.log('N1B_TEST_PASS safe='+safe.length+' blocked='+blocked.length+
  ' changed_content=2 long_line=blocked mixed_importance=blocked' +
  ' adjacent_line=blocked ambiguous=manual_review deletion=review_required' +
  ' source_ancestor_symlink=blocked malformed_utf8=blocked license_granted=false');
