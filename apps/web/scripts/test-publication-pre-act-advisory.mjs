/** Offline-only synthetic S-1 acceptance fixtures: NO live GitHub, BLS or Vercel calls. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPreActAdvisory, statusCode, renderSummary, withoutArchiveNote,
  archiveNoteOnly, ADVISORY_SCOPE } from './publication-pre-act-advisory.mjs';

const MAIN = 'a'.repeat(40), HEAD = 'b'.repeat(40), TARGET = 'c'.repeat(40);
const CAT = 'apps/web/src/content/catalyst-briefs/test-preview.md';
const NEWS = 'apps/web/src/content/news/2026-11-16.md';
const SEP = Date.parse('2026-09-11T12:30:00.000Z');
const NOV = Date.parse('2026-11-10T13:30:00.000Z');
const EARLY = Date.parse('2026-09-09T18:00:00.000Z');
const sha = (s) => createHash('sha1').update('blob ' + Buffer.byteLength(s) + '\0' + s).digest('hex');
const b64 = (text) => Buffer.from(text).toString('base64');

const candidate = (change = {}) => ({ publisher: 'BLS', series: 'CPI', referencePeriod: '2026-08',
  releaseStage: 'initial', eventDate: '2026-09-11', releaseTime: '08:30',
  timeZone: 'America/New_York', releaseAt: '2026-09-11T12:30:00.000Z', ...change });
const eventName = 'BLS Consumer Price Index (CPI) for August 2026';
const source = (cal = candidate(), { phase = 'preview', status = 'published', event = eventName,
  note = '', firstPublishedDate = '2026-09-09' } = {}) => [
  '---', `event: ${JSON.stringify(event)}`, `calendar: ${cal === null ? 'null' : JSON.stringify(cal)}`,
  `phase: ${JSON.stringify(phase)}`, `status: ${JSON.stringify(status)}`,
  `statusLabel: ${JSON.stringify(phase === 'preview' ? 'scheduled-confirmed' : 'released')}`,
  `eventDate: ${JSON.stringify(cal?.eventDate ?? '2026-09-11')}`,
  `firstPublishedDate: ${JSON.stringify(firstPublishedDate)}`,
  ...(note ? ['archiveNote:', `  addedAt: "2026-09-12"`, `  note: ${JSON.stringify(note)}`] : []),
  '---', '', 'Education only.', '',
].join('\n');
function parse(raw) {
  if (!raw.startsWith('---\n') || raw.length > 256000) throw Error('HOLD_SOURCE_BOUNDS');
  const key = (k) => { const m = raw.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')); if (!m) return '';
    return m[1] === 'null' ? null : JSON.parse(m[1]); };
  return { event: key('event'), calendar: key('calendar'), phase: key('phase'),
    status: key('status'), statusLabel: key('statusLabel') };
}
const expectedOfficial = (c) => c.eventDate === '2026-11-10' ? NOV : SEP;
function makePolicy(scenario, clock) {
  const issued = new WeakSet();
  return {
    parse,
    classify: (b, h) => [...new Set([...Object.keys(b), ...Object.keys(h)])].sort().map(file => ({
      file, change: !Object.hasOwn(b,file) ? 'added' : !Object.hasOwn(h,file) ? 'deleted' : b[file] === h[file] ? 'unchanged' : 'modified',
    })),
    verify: async (c, { binding }) => {
      const reject = (decision) => ({ decision, reason: 'Synthetic official evidence rejected this candidate.' });
      if (scenario.sourceFailure) return reject(scenario.sourceFailure);
      if (c.publisher !== 'BLS' || !['CPI','PPI','EMPSIT'].includes(c.series)) return reject('HOLD_UNSUPPORTED_EVENT');
      if (c.referencePeriod !== (c.eventDate === '2026-11-10' ? '2026-10' : '2026-08')) return reject('HOLD_REFERENCE_PERIOD_MISMATCH');
      if (c.series === 'CPI' && !/Consumer Price Index/.test(c.event) || c.series === 'PPI' && !/Producer Price Index/.test(c.event)) return reject('HOLD_IDENTITY_MISMATCH');
      if (c.releaseAt !== new Date(expectedOfficial(c)).toISOString() || c.releaseTime !== '08:30' || c.timeZone !== 'America/New_York') return reject('HOLD_RELEASE_TIME_MISMATCH');
      if (scenario.rescheduled) return reject('HOLD_SCHEDULE_CONFLICT');
      if (c.phase === 'outcome' && (!scenario.outcomeReleased || c.referencePeriod !== scenario.outcomePeriod)) return reject('HOLD_OUTCOME_NOT_RELEASED');
      if (c.phase === 'preview' && clock.now() >= expectedOfficial(c) && !scenario.allowStaleVerification) return reject('HOLD_PREVIEW_EXPIRED');
      const began = clock.now();
      const result = { decision: 'PASS', reason: 'Synthetic official identity confirmed.', checkedAt: new Date(began).toISOString(),
        validUntil: new Date(began + 15*60*1000).toISOString(), binding,
        event: { ...c }, sources: [{ url: 'https://www.bls.gov/schedule/news_release/cpi.htm', fetchedAt: new Date(began).toISOString() }] };
      issued.add(result);
      if (scenario.advanceAfterVerify !== undefined) clock.value = scenario.advanceAfterVerify;
      return scenario.serializeDecision ? JSON.parse(JSON.stringify(result)) : result;
    },
    freshness: (decision, {binding}) => {
      if (!issued.has(decision)) return 'HOLD_UNTRUSTED_EVIDENCE';
      if (JSON.stringify(binding) !== JSON.stringify(decision.binding)) return 'HOLD_REVISION_DRIFT';
      if (scenario.mutateBinding) return 'HOLD_REVISION_DRIFT';
      if (scenario.clockBackwards) return 'HOLD_INVALID_CLOCK';
      if (clock.now() < Date.parse(decision.checkedAt)) return 'HOLD_INVALID_CLOCK';
      if (clock.now() >= Date.parse(decision.event.releaseAt) && decision.event.phase === 'preview') return 'HOLD_PREVIEW_EXPIRED';
      if (clock.now() >= Date.parse(decision.validUntil)) return 'HOLD_EVIDENCE_STALE';
      if (scenario.expiredEvidence) return 'HOLD_EVIDENCE_STALE';
      return 'PASS';
    },
  };
}

function fakeGithub({ mode = 'pre-merge', file = CAT, raw = source(), oldRaw = null,
  files, base = MAIN, head = HEAD, target = TARGET, mainFiles = {}, targetFiles = {},
  headDrift = false, baseDrift = false, fileError = false, treeTruncated = false,
  malformedBlob = false } = {}) {
  const table = new Map();
  const add = (content) => {const id=sha(content);table.set(id,content);return id;};
  let fileList = files ?? [{ filename: file, status: oldRaw ? 'modified' : 'added', sha: add(raw) }];
  for (const f of fileList) {if (f.raw !== undefined) f.sha=add(f.raw);}
  if (oldRaw !== null) add(oldRaw);
  for (const v of Object.values(mainFiles)) add(v);
  for (const v of Object.values(targetFiles)) add(v);
  const mainTree = 'd'.repeat(40), targetTree = 'e'.repeat(40);
  let prCalls=0, mainCalls=0;
  const calls = [];
  const api = async (route) => {
    calls.push(route);
    if (/\/(POST|PUT|DELETE|PATCH)\b/.test(route)) throw Error('unexpected mutation');
    if (route.endsWith('/git/ref/heads/main')) return { object: { sha: baseDrift && ++mainCalls > 1 ? 'f'.repeat(40) : base } };
    if (/\/pulls\/123$/.test(route)) { prCalls += 1; return { number:123,state:'open',base:{ref:'main',sha:base},head:{sha:headDrift && prCalls>1?'f'.repeat(40):head} }; }
    if (route.includes('/pulls/123/files?')) { if(fileError) throw Error('synthetic page error');
      const page = Number(new URL('https://api.github.com' + route).searchParams.get('page'));
      return fileList.slice((page-1)*100,page*100); }
    if (route.includes('/git/blobs/')) { const id = route.split('/').pop(); if(!table.has(id))throw Error('missing synthetic blob');
      return {sha:id,encoding:malformedBlob?'raw':'base64',content:b64(table.get(id))}; }
    if (route.includes('/contents/')) {if(oldRaw===null)throw Error('missing base');return {type:'file',sha:sha(oldRaw),encoding:'base64',content:b64(oldRaw)};}
    if (route.includes('/git/commits/')) {const id=route.split('/').pop();return {sha:id,tree:{sha:id===target?targetTree:mainTree}};}
    if (route.includes('/git/trees/')) { const id=route.match(/\/git\/trees\/([a-f0-9]{40})/)[1],files=id===targetTree?targetFiles:mainFiles;
      return {truncated:treeTruncated,tree:Object.entries(files).map(([p,content])=>({path:p,type:'blob',sha:sha(content)}))}; }
    throw Error('unrecognized synthetic GET ' + route);
  };
  const input=mode==='pre-merge'?{mode,prNumber:123,expectedHeadSha:head,expectedBaseSha:base}:
    {mode,targetSha:target,expectedMainSha:base};
  return {api,input,calls,mutate:(x)=>fileList=x};
}

let total=0;
async function test(id, expected, options={}) {
  const clock={value:options.at ?? EARLY,now(){return this.value}};
  const {scenario={},input={},api={},...fixture}=options;
  const fake=fakeGithub(fixture);
  if(api.override) fake.api=api.override;
  const policy=makePolicy(scenario,clock);
  const r=await runPreActAdvisory({...fake.input,...input}, {api:fake.api, now:()=>clock.now(),...policy});
  assert.equal(r.decision,expected,`${id}: ${r.decision} (${r.reason}) instead of ${expected}`);
  assert.equal(r.publicationAuthorized,false,id);
  assert.equal(r.publicationAttempted,false,id);
  assert.ok(r.scope.includes('not a merge'),id);
  if(!expected.startsWith('HOLD_')&&!expected.startsWith('BLOCK_'))assert.equal(statusCode(r),0,id);
  else assert.equal(statusCode(r),2,id);
  if (id !== 'malformed SHA') assert.equal(fake.calls.some(x=>x.includes('/git/ref/heads/main')),true,id);
  total++;
  return r;
}

// C01-C31 + C20b (32 source/time/revision matrix cases), including four positives.
await test('C01','PASS');
await test('C02','HOLD_FRESHNESS_SAFETY_WINDOW',{at:SEP-30*60000});
await test('C03','HOLD_FRESHNESS_SAFETY_WINDOW',{at:SEP-1});
await test('C04','BLOCK_PREVIEW_EXPIRED',{at:SEP});
await test('C05','BLOCK_PREVIEW_EXPIRED',{at:SEP+1});
await test('C06','HOLD_RELEASE_TIME_MISMATCH',{at:SEP+1,raw:source(candidate({releaseAt:'2099-09-11T12:30:00.000Z'}))});
await test('C07','HOLD_RELEASE_TIME_MISMATCH',{at:SEP+1,raw:source(candidate({eventDate:'2099-09-11',releaseAt:'2099-09-11T12:30:00.000Z'}))});
await test('C08','HOLD_REFERENCE_PERIOD_MISMATCH',{raw:source(candidate({referencePeriod:'2026-09'}))});
await test('C09','HOLD_IDENTITY_MISMATCH',{raw:source(candidate({series:'PPI'}))});
await test('C10','HOLD_UNSUPPORTED_EVENT',{at:SEP+1,raw:source(null,{event:'BLS Employment Cost Index for Third Quarter 2026'})});
await test('C11','HOLD_UNSUPPORTED_EVENT',{raw:source(null,{event:'BLS Real Earnings for August 2026'})});
await test('C12','HOLD_UNSUPPORTED_EVENT',{raw:source(null,{event:'BEA Advance Estimate of Third Quarter 2026 GDP'})});
await test('C13','HOLD_UNSUPPORTED_EVENT',{raw:source(null,{event:'Treasury 10-year note auction'})});
await test('C14','HOLD_UNSUPPORTED_EVENT',{raw:source(candidate({publisher:'Eurostat'}))});
await test('C15','HOLD_SCHEDULE_CONFLICT',{at:Date.parse('2026-09-10T13:00:00Z'),scenario:{rescheduled:true}});
await test('C16','HOLD_SOURCE_UNAVAILABLE',{scenario:{sourceFailure:'HOLD_SOURCE_UNAVAILABLE'}});
await test('C17','HOLD_SOURCE_UNAVAILABLE',{scenario:{sourceFailure:'HOLD_SOURCE_UNAVAILABLE'}});
await test('C18','HOLD_SOURCE_UNAVAILABLE',{scenario:{sourceFailure:'HOLD_SOURCE_UNAVAILABLE'}});
await test('C19','HOLD_SOURCE_SCHEMA',{scenario:{sourceFailure:'HOLD_SOURCE_SCHEMA'}});
await test('C20','HOLD_RELEASE_TIME_MISMATCH',{raw:source(candidate({eventDate:'2026-11-10',referencePeriod:'2026-10',releaseAt:'2026-11-10T14:30:00.000Z'}))});
await test('C20b','HOLD_RELEASE_TIME_MISMATCH',{raw:source(candidate({releaseAt:'2026-09-11T13:30:00.000Z'}))});
await test('C21','PASS',{at:Date.parse('2026-11-09T13:30:00Z'),raw:source(candidate({eventDate:'2026-11-10',referencePeriod:'2026-10',releaseAt:'2026-11-10T13:30:00.000Z'}),{event:'BLS Consumer Price Index (CPI) for October 2026'})});
await test('C22','HOLD_OUTCOME_NOT_RELEASED',{at:SEP+60*60000,raw:source(candidate(),{phase:'outcome'}),scenario:{outcomeReleased:false}});
await test('C23','NO_PUBLICATION_DECISION',{files:[{filename:'README.md',status:'modified'}]});
await test('C24','NO_PUBLICATION_DECISION',{files:[{filename:'docs/notes.md',status:'modified'}]});
await test('C25','BLOCK_PREVIEW_EXPIRED',{scenario:{advanceAfterVerify:SEP+1,allowStaleVerification:true}});
await test('C26','HOLD_REVISION_DRIFT',{headDrift:true});
await test('C27','HOLD_REVISION_DRIFT',{baseDrift:true});
await test('C28','HOLD_REVISION_DRIFT',{scenario:{mutateBinding:true}});
await test('C29','HOLD_UNTRUSTED_EVIDENCE',{scenario:{serializeDecision:true}});
await test('C30','HOLD_EVIDENCE_STALE',{scenario:{advanceAfterVerify:EARLY+16*60000,expiredEvidence:true}});
await test('C31','HOLD_INVALID_CLOCK',{scenario:{clockBackwards:true}});

// D09-D13/D15/D18-D22, plus additional source bounds and fail-closed controls.
await test('D09','HOLD_EVIDENCE_STALE',{scenario:{advanceAfterVerify:EARLY+16*60000}});
await test('D10','HOLD_REVISION_DRIFT',{headDrift:true});
await test('D11','HOLD_REVISION_DRIFT',{baseDrift:true});
await test('D12','BLOCK_PREVIEW_EXPIRED',{at:SEP+1});
await test('D13','PASS'); // Only synthetic blob contents are parsed, never executed as code.
const before=source(candidate());
const after=source(candidate(),{note:'Archive context added after event'});
assert.equal(withoutArchiveNote(before).rest,withoutArchiveNote(after).rest);
assert.equal(archiveNoteOnly(before,after,parse),true);
await test('D15','ARCHIVE_EDIT',{oldRaw:before,raw:after,at:SEP+10*86400000});
assert.equal(archiveNoteOnly(after,before,parse),false,'removing an archive note cannot silently pass');
assert.equal(archiveNoteOnly(before,after.replace('2026-09-12','2026-09-11'),parse),false,'premature archive note cannot silently pass');
await test('D18','HOLD_OUTCOME_NOT_RELEASED',{at:SEP+86400000,raw:source(candidate(),{phase:'outcome'}),scenario:{outcomeReleased:true,outcomePeriod:'2026-07'}});
await test('outcome officially released','PASS',{at:SEP+86400000,raw:source(candidate(),{phase:'outcome'}),scenario:{outcomeReleased:true,outcomePeriod:'2026-08'}});
await test('D19','HOLD_SCHEDULE_CONFLICT',{scenario:{rescheduled:true}});
await test('D20','HOLD_SOURCE_UNAVAILABLE',{scenario:{sourceFailure:'HOLD_SOURCE_UNAVAILABLE'}});
await test('D21','PASS',{mode:'pre-alias',at:EARLY,mainFiles:{},targetFiles:{[CAT]:source()}});
await test('D22','HOLD_CONTENT_REGRESSION',{mode:'pre-alias',at:SEP+86400000,mainFiles:{[CAT]:source()},targetFiles:{}});
await test('pre-alias same sha','NO_CONTENT_CHANGE',{mode:'pre-alias',input:{targetSha:MAIN}});
await test('pre-alias changed unsupported','HOLD_UNSUPPORTED_EVENT',{mode:'pre-alias',targetFiles:{[CAT]:source(null,{event:'BEA GDP estimate'})}});
await test('missing calendar BLS','HOLD_MISSING_CALENDAR_RECORD',{raw:source(null,{event:eventName})});
await test('dirty daily report is not authority','NO_PUBLICATION_DECISION',{files:[{filename:NEWS,status:'added'}]});
await test('malformed SHA','HOLD_INVALID_SHA',{input:{expectedHeadSha:'bad'}});
await test('100 files exact cap','NO_PUBLICATION_DECISION',{files:Array.from({length:100},(_,i)=>({filename:`docs/f${i}.txt`,status:'added'}))});
await test('later page error','HOLD_INCOMPLETE_FILE_LIST',{files:Array.from({length:101},(_,i)=>({filename:`docs/f${i}.txt`,status:'added'}))});
await test('GitHub file-list transport error','HOLD_INTERNAL_ERROR',{fileError:true});
await test('invalid blob encoding','HOLD_CONTENT_READ',{malformedBlob:true});
await test('invalid phase','HOLD_SOURCE_SCHEMA',{raw:source(candidate(),{phase:'unexpected'})});
await test('not-yet-published','NO_PUBLICATION_DECISION',{raw:source(candidate(),{status:'review'})});
await test('multiple mixed, one unsupported','HOLD_UNSUPPORTED_EVENT',{files:[
  {filename:CAT,status:'added',raw:source()},
  {filename:'apps/web/src/content/catalyst-briefs/second-preview.md',status:'added',raw:source(null,{event:'BEA GDP estimate'})},
  {filename:'README.md',status:'modified'},
]});
await test('target lacks recent published','HOLD_CONTENT_REGRESSION',{mode:'pre-alias',mainFiles:{[CAT]:source()},targetFiles:{}});
await test('different nonpublished target','HOLD_TARGET_DIFFERS',{mode:'pre-alias',targetFiles:{[CAT]:source(candidate(),{status:'review'})}});
await test('post-merge nonpublication','NO_PUBLICATION_DECISION',{files:[{filename:'docs/security-note.md',status:'modified'}]});

// Workflow contracts are checked without running Actions, GitHub API or BLS.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const workflow=readFileSync(path.join(root,'.github/workflows/publication-pre-act-advisory.yml'),'utf8');
assert.match(workflow,/^  workflow_dispatch:$/m);
assert.doesNotMatch(workflow,/^  (?:pull_request|push|schedule|workflow_run|issue_comment|repository_dispatch):/m);
assert.match(workflow,/if: github\.ref == 'refs\/heads\/main'/);
assert.match(workflow,/^permissions:\n  contents: read\n  pull-requests: read\n/m);
assert.doesNotMatch(workflow,/\bsecrets\.|\benvironment:|\bstatuses: write|\bchecks: write|\bissues: write|\bcontents: write/i);
assert.match(workflow,/persist-credentials: false/);
assert.match(workflow,/node-version: 24\.x/);
assert.doesNotMatch(workflow,/publication-calendar-pr-guard\.yml/);
assert.match(workflow,/name: S1 manual publication pre-act advisory \(not a release check\)/);
const dir=path.join(root,'.github/workflows');
const jobName='S1 manual publication pre-act advisory (not a release check)';
let duplicates=0;
for(const f of readdirSync(dir).filter(x=>/\.ya?ml$/.test(x))){
  const t=readFileSync(path.join(dir,f),'utf8');
  if(t.includes('name: '+jobName))duplicates++;
}
assert.equal(duplicates,1,'S1 job name must be unique');
for(const old of ['validate-and-build','Dependency review','Reject Development-only Production migration files']) assert.notEqual(jobName,old);
const s=renderSummary({repository:'usdimpact/usd-impact-site',mode:'pre-merge',decision:'PASS',reason:'Synthetic fixture',checkedAt:'2026-09-09T18:00:00.000Z',items:[]});
assert.ok(s.includes(ADVISORY_SCOPE));
assert.equal(statusCode({decision:'OUT_OF_SCOPE_DAILY'}),2,'informational Daily state cannot become passing check');

console.log(`S-1 offline synthetic assertions passed: ${total} scenarios, including C01-C31/C20b, D09-D13/D15/D18-D22, and static workflow contracts.`);
