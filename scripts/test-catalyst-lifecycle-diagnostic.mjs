import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { diagnoseCatalystLifecycle as diagnose } from './catalyst-lifecycle-diagnostic.mjs';

globalThis.fetch = () => { throw new Error('NETWORK_DISABLED_IN_OFFLINE_TESTS'); };
const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40), D = 'd'.repeat(64);
const NOW = '2026-09-17T00:30:00.000Z';
const SLOT = '2026-09-16T22:45:00.000Z';
const WORKFLOW = '.github/workflows/catalyst-brief.yml';
const KEY = '2026-09-16-fomc-policy-decision';
const CANONICAL = `https://www.usd-impact.com/news/catalysts/${KEY}-outcome`;
function base() {
  return {
    schemaVersion: 2, now: NOW,
    expected: {
      repository: 'usdimpact/usd-impact-site', workflowPath: WORKFLOW, branch: 'main', generationSourceSha: A, observationHeadSha: A,
      eventKey: KEY, eventDate: '2026-09-16', phase: 'outcome', scheduledAt: SLOT,
      maxObservationAgeMs: 60000, executionGraceMs: null, publicationDueAt: null, hold: null,
    },
    observations: {
      repositoryHeadStartSha: A, repositoryHeadEndSha: A,
      runs: { observedAt: NOW, complete: true, nextPage: null, totalCount: 0, records: [], windowStart: '2026-09-16T00:00:00.000Z', windowEnd: NOW },
      publications: { observedAt: NOW, complete: true, nextPage: null, totalCount: 0, records: [] },
      deployment: null, livePage: null,
    },
  };
}
function run(overrides = {}) {
  return {
    id: 101, attempt: 1, workflowPath: WORKFLOW, branch: 'main', sourceSha: A, event: 'schedule',
    createdAt: '2026-09-16T22:50:00.000Z', status: 'completed', conclusion: 'success',
    association: { eventKey: KEY, eventDate: '2026-09-16', phase: 'outcome', scheduledAt: SLOT, asOf: '2026-09-16', evidenceRef: 'run:101:attempt:1' },
    decision: null, ...overrides,
  };
}
function withRuns(s, records) { s.observations.runs.records = records; s.observations.runs.totalCount = records.length; return s; }
function pub(overrides = {}) {
  return { prNumber: 901, eventKey: KEY, eventDate: '2026-09-16', phase: 'outcome', state: 'open', headSha: B, mergeSha: null,
    contentPath: `apps/web/src/content/catalyst-briefs/${KEY}-outcome.md`, articleDigest: D, digestScheme: 'catalyst-projection-v1',
    canonicalUrl: CANONICAL, qualityHeadSha: B, qualityConclusion: 'success', ...overrides };
}
function withPubs(s, records) { s.observations.publications.records = records; s.observations.publications.totalCount = records.length; return s; }
function live() {
  const s = withPubs(base(), [pub({ state: 'merged', mergeSha: C })]);
  s.observations.deployment = { observedAt: NOW, deploymentId: 'dpl_test1', gitSha: C, target: 'production', state: 'READY', canonicalHost: 'www.usd-impact.com' };
  s.observations.livePage = { observedAt: NOW, statusCode: 200, finalUrl: CANONICAL, eventKey: KEY, eventDate: '2026-09-16', phase: 'outcome', articleDigest: D, digestScheme: 'catalyst-projection-v1', deploymentId: 'dpl_test1', accessMode: 'anonymous', complete: true };
  return s;
}
function decision(r, kind) {
  r.decision = { kind, runId: r.id, attempt: r.attempt, sourceSha: r.sourceSha, recordedAt: '2026-09-16T22:55:00.000Z', reasonCode: 'SYNTHETIC_TEST' };
  return r;
}
function check(name, mutate, expected, make = base) {
  test(name, () => {
    const s = make(); mutate(s);
    const actual = diagnose(s);
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value, key);
    for (const key of ['observationAuthenticityVerified','publicationVerified','publicationAuthorized','workflowDispatched','incidentClosureAuthorized','enforcementActive']) assert.equal(actual.safety[key], false, key);
  });
}
check('missing expected run is not old-run success', () => {}, { scheduler: 'EXPECTED_RUN_NOT_OBSERVED', execution: 'NOT_STARTED', publication: 'NO_CANDIDATE_IN_OBSERVATION', schedulerTiming: 'POLICY_UNSPECIFIED', publicationTiming: 'POLICY_UNSPECIFIED' });
check('explicit grace not yet ended', s => { s.expected.executionGraceMs = 7200000; }, { schedulerTiming: 'WITHIN_GRACE' });
check('explicit grace ended', s => { s.expected.executionGraceMs = 0; }, { schedulerTiming: 'GRACE_ENDED' });
check('exact grace boundary is not before boundary', s => { s.expected.executionGraceMs = 6300000; }, { schedulerTiming: 'GRACE_ENDED' });
check('one millisecond before grace boundary', s => { s.expected.executionGraceMs = 6300001; }, { schedulerTiming: 'WITHIN_GRACE' });
check('before due without inventing a missing-run incident', s => { s.now = s.observations.runs.observedAt = s.observations.runs.windowEnd = s.observations.publications.observedAt = '2026-09-16T22:44:59.999Z'; }, { scheduler: 'NOT_DUE', execution: 'NOT_STARTED' });
check('at slot becomes an observation not deadline breach', s => { s.now = s.observations.runs.observedAt = s.observations.runs.windowEnd = s.observations.publications.observedAt = SLOT; }, { scheduler: 'EXPECTED_RUN_NOT_OBSERVED', schedulerTiming: 'POLICY_UNSPECIFIED' });
check('earlier preview cannot satisfy outcome', s => { const r = run(); r.association.phase = 'preview'; r.association.scheduledAt = '2026-09-16T06:45:00.000Z'; r.createdAt = '2026-09-16T12:06:40.000Z'; withRuns(s,[r]); }, { scheduler: 'EXPECTED_RUN_NOT_OBSERVED', execution: 'NOT_STARTED', ignoredRunIds: [101] });
check('phase not inferred from creation time', s => withRuns(s,[run({association:null})]), { scheduler: 'RUN_ASSOCIATION_UNKNOWN', unresolvedRunIds:[101] });
check('delayed schedule crossing midnight uses explicit association', s => { const r=run({createdAt:'2026-09-17T00:01:00.000Z'}); r.association.asOf='2026-09-17'; withRuns(s,[r]); }, { scheduler:'SCHEDULED_RUN_REPORTED', execution:'SUCCESS_WITHOUT_PUBLICATION_EVIDENCE' });
check('wrong event cannot count', s => { const r=run(); r.association.eventKey='different-event'; withRuns(s,[r]); }, { scheduler:'EXPECTED_RUN_NOT_OBSERVED' });
check('wrong event date cannot count', s => { const r=run(); r.association.eventDate='2026-09-15'; withRuns(s,[r]); }, { scheduler:'EXPECTED_RUN_NOT_OBSERVED' });
check('wrong scheduled slot cannot count', s => { const r=run(); r.association.scheduledAt='2026-09-15T22:45:00.000Z'; withRuns(s,[r]); }, { scheduler:'EXPECTED_RUN_NOT_OBSERVED' });
check('wrong workflow cannot count', s => withRuns(s,[run({workflowPath:'.github/workflows/quality.yml'})]), { scheduler:'EXPECTED_RUN_NOT_OBSERVED' });
check('feature branch cannot count', s => withRuns(s,[run({branch:'test'})]), { scheduler:'EXPECTED_RUN_NOT_OBSERVED' });
check('push cannot impersonate schedule', s => withRuns(s,[run({event:'push'})]), { scheduler:'EXPECTED_RUN_NOT_OBSERVED' });
check('source revision drift holds', s => withRuns(s,[run({sourceSha:B})]), { scheduler:'RUN_SOURCE_DRIFT' });
check('repository drift holds every stage', s => { s.observations.repositoryHeadEndSha=B; }, { evidenceState:'SCOPE_DRIFT', publication:'UNKNOWN' });
for (const state of ['queued','waiting','requested','pending']) check(`matching ${state} is not completion`, s => withRuns(s,[run({status:state,conclusion:null})]), { scheduler:'SCHEDULED_RUN_REPORTED', execution:'QUEUED_OR_WAITING' });
check('matching running is not completion', s => withRuns(s,[run({status:'in_progress',conclusion:null})]), { execution:'IN_PROGRESS' });
check('successful run alone is not publication', s => withRuns(s,[run()]), { execution:'SUCCESS_WITHOUT_PUBLICATION_EVIDENCE', publication:'NO_CANDIDATE_IN_OBSERVATION' });
for (const conclusion of ['failure','cancelled','timed_out','skipped','neutral','action_required']) check(`completed ${conclusion} not publication`, s=>withRuns(s,[run({conclusion})]),{execution:'COMPLETED_WITHOUT_SUCCESS'});
check('source HOLD preserved separately', s=>withRuns(s,[decision(run(),'source_hold')]),{execution:'SOURCE_HOLD_REPORTED', publication:'NO_CANDIDATE_IN_OBSERVATION'});
check('no-candidate report is not recovery', s=>withRuns(s,[decision(run(),'no_candidate')]),{execution:'NO_CANDIDATE_REPORTED',publication:'NO_CANDIDATE_IN_OBSERVATION'});
check('generation report is not recovery', s=>withRuns(s,[decision(run(),'generated')]),{execution:'GENERATION_REPORTED',publication:'NO_CANDIDATE_IN_OBSERVATION'});
check('wrong run-attempt decision rejected', s=>{const r=decision(run(),'generated');r.decision.attempt=2;withRuns(s,[r]);},{evidenceState:'INVALID_SNAPSHOT'});
check('wrong decision source SHA rejected', s=>{const r=decision(run(),'generated');r.decision.sourceSha=B;withRuns(s,[r]);},{evidenceState:'INVALID_SNAPSHOT'});
check('manual recovery does not repair scheduler evidence', s=>withRuns(s,[run({event:'workflow_dispatch'})]),{scheduler:'EXPECTED_RUN_NOT_OBSERVED',execution:'SUCCESS_WITHOUT_PUBLICATION_EVIDENCE'});
check('two potential executions are surfaced not first-picked', s=>{const r=run({id:102,event:'workflow_dispatch'});r.association.evidenceRef='run:102:attempt:1';withRuns(s,[run(),r]);},{execution:'MULTIPLE_MATCHING_RUNS'});
check('two schedules flagged', s=>{const r=run({id:102});r.association.evidenceRef='run:102:attempt:1';withRuns(s,[run(),r]);},{scheduler:'DUPLICATE_SCHEDULED_RUNS'});
for (const mutate of [s=>{s.observations.runs.complete=false;},s=>{s.observations.runs.nextPage=2;},s=>{s.observations.runs.totalCount=1;},s=>{s.observations.runs.observedAt='2026-09-17T00:28:00.000Z';s.observations.runs.windowEnd=s.observations.runs.observedAt;},s=>{s.observations.runs.windowStart='2026-09-17T00:00:00.000Z';}]) {
  check(`incomplete run evidence variant ${mutate.toString()}`, mutate,{scheduler:'EXECUTION_EVIDENCE_INCOMPLETE'});
}
check('abbreviated publication list not evidence of absence',s=>{s.observations.publications.complete=false;},{publication:'PUBLICATION_EVIDENCE_INCOMPLETE'});
check('open candidate requires review',s=>withPubs(s,[pub()]),{publication:'CANDIDATE_AWAITING_REVIEW'});
check('wrong-phase candidate ignored',s=>withPubs(s,[pub({phase:'preview',canonicalUrl:CANONICAL.replace(/outcome$/,'preview'),contentPath:`apps/web/src/content/catalyst-briefs/${KEY}-preview.md`})]),{publication:'NO_CANDIDATE_IN_OBSERVATION'});
check('closed unmerged preview not reopened',s=>withPubs(s,[pub({state:'closed'})]),{publication:'NO_CANDIDATE_IN_OBSERVATION'});
check('two candidate records create conflict',s=>withPubs(s,[pub(),pub({prNumber:902})]),{publication:'CONFLICTING_PUBLICATION_RECORDS'});
check('old-head green insufficient',s=>withPubs(s,[pub({qualityHeadSha:A})]),{publication:'EXACT_HEAD_QUALITY_NOT_CONFIRMED'});
check('pending quality insufficient',s=>withPubs(s,[pub({qualityConclusion:'pending'})]),{publication:'EXACT_HEAD_QUALITY_NOT_CONFIRMED'});
check('merge alone not live',s=>withPubs(s,[pub({state:'merged',mergeSha:C})]),{publication:'MERGED_DEPLOYMENT_EVIDENCE_MISSING'});
check('wrong deployment revision',s=>{s.observations.deployment.gitSha=B;},{publication:'MERGED_AWAITING_MATCHING_PRODUCTION'},live);
check('preview deployment is not Production',s=>{s.observations.deployment.target='preview';},{publication:'MERGED_AWAITING_MATCHING_PRODUCTION'},live);
check('unready deployment is not live',s=>{s.observations.deployment.state='BUILDING';},{publication:'MERGED_AWAITING_MATCHING_PRODUCTION'},live);
check('alternate host not canonical',s=>{s.observations.deployment.canonicalHost='example.com';},{publication:'MERGED_AWAITING_MATCHING_PRODUCTION'},live);
check('stale deployment evidence',s=>{s.observations.deployment.observedAt='2026-09-17T00:28:00.000Z';},{publication:'DEPLOYMENT_EVIDENCE_STALE'},live);
check('deployment without page observation',s=>{s.observations.livePage=null;},{publication:'DEPLOYED_LIVE_EVIDENCE_MISSING'},live);
check('abbreviated page evidence',s=>{s.observations.livePage.complete=false;},{publication:'LIVE_EVIDENCE_INCOMPLETE'},live);
check('stale page evidence',s=>{s.observations.livePage.observedAt='2026-09-17T00:28:00.000Z';},{publication:'LIVE_EVIDENCE_INCOMPLETE'},live);
for (const [name,key,value] of [
  ['wrong phase','phase','preview'],['wrong event','eventKey','wrong-event'],['wrong date','eventDate','2026-09-15'],['wrong digest','articleDigest','e'.repeat(64)],['wrong deployment','deploymentId','dpl_wrong'],['login with HTTP 200','finalUrl','https://www.usd-impact.com/login'],['unauthorized page','statusCode',401],['authenticated view','accessMode','authenticated'],['unknown access','accessMode','unknown']
]) check(name,s=>{s.observations.livePage[key]=value;},{publication:'LIVE_BINDING_MISMATCH'},live);
check('fully matching supplied evidence still NOT verified',()=>{},{publication:'LIVE_MATCH_REPORTED_NOT_VERIFIED',scheduler:'EXPECTED_RUN_NOT_OBSERVED'},live);
check('manual live recovery leaves missing schedule visible',s=>withRuns(s,[run({event:'workflow_dispatch'})]),{publication:'LIVE_MATCH_REPORTED_NOT_VERIFIED',scheduler:'EXPECTED_RUN_NOT_OBSERVED'},live);
check('freshness exact age boundary accepted',s=>{s.observations.livePage.observedAt='2026-09-17T00:29:00.000Z';},{publication:'LIVE_MATCH_REPORTED_NOT_VERIFIED'},live);
check('future evidence not accepted',s=>{s.observations.livePage.observedAt='2026-09-17T00:30:00.001Z';},{publication:'LIVE_EVIDENCE_INCOMPLETE'},live);
check('explicit hold tracked separately',s=>{s.expected.hold={eventKey:KEY,eventDate:'2026-09-16',phase:'outcome',reference:'issue:558:comment:100',validUntil:'2026-09-17T01:00:00.000Z'};},{disposition:'INTENTIONALLY_HELD_REPORTED',scheduler:'EXPECTED_RUN_NOT_OBSERVED'});
check('expired hold not silently extended',s=>{s.expected.hold={eventKey:KEY,eventDate:'2026-09-16',phase:'outcome',reference:'issue:558:comment:100',validUntil:NOW};},{disposition:'HOLD_EXPIRED'});
check('hold versus live surfaced as conflict',s=>{s.expected.hold={eventKey:KEY,eventDate:'2026-09-16',phase:'outcome',reference:'issue:558:comment:100',validUntil:'2026-09-17T01:00:00.000Z'};},{evidenceState:'HOLD_PUBLICATION_CONFLICT'},live);
check('explicit publication deadline',s=>{s.expected.publicationDueAt='2026-09-17T01:00:00.000Z';},{publicationTiming:'BEFORE_DEADLINE'});
check('explicit publication deadline reached',s=>{s.expected.publicationDueAt=NOW;},{publicationTiming:'DEADLINE_REACHED'});
for (const [name,mutate] of [
  ['boolean string',s=>{s.observations.runs.complete='true';}],
  ['negative grace',s=>{s.expected.executionGraceMs=-1;}],
  ['missing grace policy',s=>{delete s.expected.executionGraceMs;}],
  ['missing evidence-age policy',s=>{delete s.expected.maxObservationAgeMs;}],
  ['invalid leap day',s=>{s.expected.eventDate='2026-02-29';}],
  ['timezone-less instant',s=>{s.expected.scheduledAt='2026-09-16T22:45:00';}],
  ['duplicate run id',s=>withRuns(s,[run(),run()])],
  ['incomplete run with success',s=>withRuns(s,[run({status:'queued'})])],
  ['future run',s=>withRuns(s,[run({createdAt:'2026-09-18T00:00:00.000Z'})])],
  ['forged authorization property',s=>{s.publicationAuthorized=true;}],
  ['forged nested provider claim',s=>{s.observations.verified=true;}],
  ['wrong repo',s=>{s.expected.repository='other/repo';}],
  ['unknown enum',s=>withRuns(s,[run({status:'magically-approved'})])],
  ['invalid approved URL',s=>withPubs(s,[pub({canonicalUrl:'https://evil.example/news'})])],
  ['unknown digest scheme',s=>withPubs(s,[pub({digestScheme:'arbitrary'})])],
  ['decision from another run',s=>{const r=decision(run(),'source_hold');r.decision.runId=999;withRuns(s,[r]);}],
]) check(`reject ${name}`,mutate,{evidenceState:'INVALID_SNAPSHOT'});
test('input is not mutated and output deeply frozen',()=>{const s=live(),before=JSON.stringify(s),out=diagnose(s);assert.equal(JSON.stringify(s),before);assert(Object.isFrozen(out));assert(Object.isFrozen(out.safety));assert(Object.isFrozen(out.matchingRuns));});
test('deterministic output for same supplied clock and records',()=>assert.deepEqual(diagnose(live()),diagnose(live())));
test('non-data property rejected without evaluating its getter',()=>{const s=base();let called=false;Object.defineProperty(s,'now',{enumerable:true,get(){called=true;return NOW;}});assert.equal(diagnose(s).evidenceState,'INVALID_SNAPSHOT');assert.equal(called,false);});
test('invalid input never echoes arbitrary supplied messages',()=>{const s=base();s.password='SENSITIVE_MARKER';const out=JSON.stringify(diagnose(s));assert(!out.includes('SENSITIVE_MARKER'));});
test('module contains no imports, network, IO or acquired clock',async()=>{const src=await readFile(new URL('./catalyst-lifecycle-diagnostic.mjs',import.meta.url),'utf8');assert(!/^\s*import\s/m.test(src));assert(!/\b(?:fetch|require|setTimeout|setInterval|Date\.now|process|eval)\s*\(/.test(src));assert(!/new Date\(\s*\)/.test(src));});
check('scheduled run claimed before its slot is conflicting evidence', s=>withRuns(s,[run({createdAt:'2026-09-16T22:44:00.000Z'})]), {scheduler:'SLOT_CONFLICT'});
check('page without a candidate binding is not ignored or approved',s=>withPubs(s,[]),{publication:'LIVE_OBSERVATION_WITHOUT_CANDIDATE_BINDING'},live);
check('unknown run cannot be hidden by known successful run',s=>{const r=run({id:102,association:null});withRuns(s,[run(),r]);},{scheduler:'RUN_ASSOCIATION_UNKNOWN'});
check('incomplete evidence persists despite supplied live match',s=>{s.observations.runs.complete=false;},{scheduler:'EXECUTION_EVIDENCE_INCOMPLETE',publication:'LIVE_MATCH_REPORTED_NOT_VERIFIED'},live);
check('overstated record counts remain incomplete',s=>{s.observations.publications.totalCount=5;},{publication:'PUBLICATION_EVIDENCE_INCOMPLETE'});
check('stale decision from prior attempt not used',s=>{const r=decision(run(),'generated');r.attempt=2;r.association.evidenceRef='run:101:attempt:2';withRuns(s,[r]);},{evidenceState:'INVALID_SNAPSHOT'});
test('array count limit rejects oversized snapshots',()=>{const s=base();s.observations.runs.records=Array.from({length:201},(_,i)=>run({id:i+1}));s.observations.runs.totalCount=201;assert.equal(diagnose(s).evidenceState,'INVALID_SNAPSHOT');});

check('query ending at old slot cannot imply current absence',s=>{s.observations.runs.windowEnd=SLOT;},{scheduler:'EXECUTION_EVIDENCE_INCOMPLETE'});
check('wrong content path cannot masquerade as canonical article',s=>withPubs(s,[pub({contentPath:'apps/web/src/content/catalyst-briefs/other.md'})]),{evidenceState:'INVALID_SNAPSHOT'});
check('candidate phase and slug conflict is rejected',s=>withPubs(s,[pub({phase:'preview'})]),{evidenceState:'INVALID_SNAPSHOT'});

test('normal publishing validator invokes the offline suite in a bounded child process', async () => {
  const source = await readFile(new URL('../apps/web/scripts/validate-publishing.mjs', import.meta.url), 'utf8');
  assert.equal(source.split('../../../scripts/test-catalyst-lifecycle-diagnostic.mjs').length - 1, 1);
  assert.match(source, /spawnSync\(process\.execPath, \[lifecycleTestPath\],/);
  assert.match(source, /shell: false/);
  assert.match(source, /timeout: 30_000/);
  assert.match(source, /lifecycleTest\.error \|\| lifecycleTest\.signal \|\| lifecycleTest\.status !== 0/);
  assert.doesNotMatch(source, /(?:from\s*|import\s*\()\s*['"][^'"\n]*test-catalyst-lifecycle-diagnostic/);
});


// All v2 cases remain supplied-record diagnostics, not authenticated live replays.
function postMerge() {
  const s = live();
  s.expected.observationHeadSha = C;
  s.observations.repositoryHeadStartSha = C;
  s.observations.repositoryHeadEndSha = C;
  return withRuns(s, [decision(run(), 'generated')]);
}
check('v2 separates generator A, reviewed head B and observed merge C', () => {}, {
  schemaVersion: 2, evidenceState: 'SUPPLIED_RECORDS_ONLY',
  scheduler: 'SCHEDULED_RUN_REPORTED', execution: 'GENERATION_REPORTED',
  publication: 'LIVE_MATCH_REPORTED_NOT_VERIFIED',
}, postMerge);
check('v2 allows generation and observation at the same revision', s => {
  s.expected.observationHeadSha = A;
  s.observations.repositoryHeadStartSha = A;
  s.observations.repositoryHeadEndSha = A;
}, { scheduler: 'SCHEDULED_RUN_REPORTED', execution: 'GENERATION_REPORTED' }, postMerge);
check('v2 historical scheduled source is not compared with the observation head', s => {
  s.expected.observationHeadSha = 'e'.repeat(40);
  s.observations.repositoryHeadStartSha = s.expected.observationHeadSha;
  s.observations.repositoryHeadEndSha = s.expected.observationHeadSha;
}, { scheduler: 'SCHEDULED_RUN_REPORTED', publication: 'LIVE_MATCH_REPORTED_NOT_VERIFIED' }, postMerge);
check('v2 repinning generation to current main still reports run source drift', s => {
  s.expected.generationSourceSha = C;
}, { scheduler: 'RUN_SOURCE_DRIFT', execution: 'RUN_SOURCE_DRIFT', publication: 'LIVE_MATCH_REPORTED_NOT_VERIFIED' }, postMerge);
check('v2 unreviewed run source does not erase independently supplied publication state', s => {
  const r = decision(run({ sourceSha: B }), 'generated');
  withRuns(s, [r]);
}, { scheduler: 'RUN_SOURCE_DRIFT', publication: 'LIVE_MATCH_REPORTED_NOT_VERIFIED' }, postMerge);
for (const [name, start, end] of [
  ['changed after collection started', C, B],
  ['start differs even though end matches', B, C],
  ['both agree on wrong revision', B, B],
  ['both falsified as historical generator', A, A],
  ['both differ from scope and each other', A, B],
]) check(`v2 observation scope rejects ${name}`, s => {
  s.observations.repositoryHeadStartSha = start;
  s.observations.repositoryHeadEndSha = end;
}, { schemaVersion: 2, evidenceState: 'SCOPE_DRIFT', scheduler: 'UNKNOWN', execution: 'UNKNOWN', publication: 'UNKNOWN' }, postMerge);
check('v2 observation race also holds an open candidate', s => {
  s.observations.repositoryHeadEndSha = B;
  withPubs(s, [pub()]); s.observations.deployment = s.observations.livePage = null;
}, { evidenceState: 'SCOPE_DRIFT', publication: 'UNKNOWN' }, postMerge);
check('v2 historical generated run can coexist with an open reviewed candidate', s => {
  withPubs(s, [pub()]); s.observations.deployment = s.observations.livePage = null;
}, { scheduler: 'SCHEDULED_RUN_REPORTED', execution: 'GENERATION_REPORTED', publication: 'CANDIDATE_AWAITING_REVIEW' }, postMerge);
check('v2 later deployment is not implicitly approved by current-head equality', s => {
  const later = 'e'.repeat(40);
  s.expected.observationHeadSha = later;
  s.observations.repositoryHeadStartSha = s.observations.repositoryHeadEndSha = later;
  s.observations.deployment.gitSha = later;
}, { scheduler: 'SCHEDULED_RUN_REPORTED', publication: 'MERGED_AWAITING_MATCHING_PRODUCTION' }, postMerge);
check('v2 historical source does not weaken editorial exact-head quality', s => {
  s.observations.publications.records[0].qualityHeadSha = A;
}, { execution: 'GENERATION_REPORTED', publication: 'EXACT_HEAD_QUALITY_NOT_CONFIRMED' }, postMerge);
check('v2 historical source does not weaken article digest binding', s => {
  s.observations.livePage.articleDigest = 'e'.repeat(64);
}, { scheduler: 'SCHEDULED_RUN_REPORTED', publication: 'LIVE_BINDING_MISMATCH' }, postMerge);
check('v2 historical source does not accept partial page evidence', s => {
  s.observations.livePage.complete = false;
}, { scheduler: 'SCHEDULED_RUN_REPORTED', publication: 'LIVE_EVIDENCE_INCOMPLETE' }, postMerge);
check('v2 historical source does not accept a truncated run list', s => {
  s.observations.runs.nextPage = 2;
}, { scheduler: 'EXECUTION_EVIDENCE_INCOMPLETE', publication: 'LIVE_MATCH_REPORTED_NOT_VERIFIED' }, postMerge);
check('v2 manual recovery still cannot establish scheduled execution', s => {
  s.observations.runs.records[0].event = 'workflow_dispatch';
}, { scheduler: 'EXPECTED_RUN_NOT_OBSERVED', execution: 'GENERATION_REPORTED', publication: 'LIVE_MATCH_REPORTED_NOT_VERIFIED' }, postMerge);
check('v2 prior preview at historical source cannot establish an outcome run', s => {
  const r = s.observations.runs.records[0];
  r.association.phase = 'preview'; r.association.scheduledAt = '2026-09-16T06:45:00.000Z';
}, { scheduler: 'EXPECTED_RUN_NOT_OBSERVED', execution: 'NOT_STARTED' }, postMerge);
check('v2 source decision must remain bound to the actual run source', s => {
  s.observations.runs.records[0].decision.sourceSha = C;
}, { evidenceState: 'INVALID_SNAPSHOT' }, postMerge);
check('v2 attempt-bound decision remains strict after observation advances', s => {
  const r = s.observations.runs.records[0]; r.attempt = 2;
  r.association.evidenceRef = 'run:101:attempt:2';
}, { evidenceState: 'INVALID_SNAPSHOT' }, postMerge);
check('v2 explicit hold is not erased by a matching historical publication', s => {
  s.expected.hold = { eventKey: KEY, eventDate: '2026-09-16', phase: 'outcome', reference: 'issue:558:comment:100', validUntil: '2026-09-17T01:00:00.000Z' };
}, { evidenceState: 'HOLD_PUBLICATION_CONFLICT' }, postMerge);

function legacyShape(s) {
  s.schemaVersion = 1;
  s.expected.sourceSha = s.expected.generationSourceSha;
  delete s.expected.generationSourceSha; delete s.expected.observationHeadSha;
  s.observations.repositoryHeadSha = s.observations.repositoryHeadStartSha;
  delete s.observations.repositoryHeadStartSha; delete s.observations.repositoryHeadEndSha;
}
for (const version of [1, 0, 3, '2', null]) {
  check(`v2 rejects unsupported schema version ${JSON.stringify(version)}`, s => { s.schemaVersion = version; }, { schemaVersion: 2, evidenceState: 'INVALID_SNAPSHOT' });
}
check('v2 does not coerce a complete legacy schema-v1 snapshot', legacyShape, { schemaVersion: 2, evidenceState: 'INVALID_SNAPSHOT' });
check('v2 rejects legacy keys relabeled as schema v2', s => { legacyShape(s); s.schemaVersion = 2; }, { evidenceState: 'INVALID_SNAPSHOT' });
check('v2 rejects mixed expected sourceSha alias', s => { s.expected.sourceSha = A; }, { evidenceState: 'INVALID_SNAPSHOT' });
check('v2 rejects mixed repositoryHeadSha alias', s => { s.observations.repositoryHeadSha = C; }, { evidenceState: 'INVALID_SNAPSHOT' }, postMerge);
for (const [section, key] of [
  ['expected', 'generationSourceSha'], ['expected', 'observationHeadSha'],
  ['observations', 'repositoryHeadStartSha'], ['observations', 'repositoryHeadEndSha'],
]) {
  check(`v2 requires ${section}.${key}`, s => { delete s[section][key]; }, { evidenceState: 'INVALID_SNAPSHOT' }, postMerge);
  for (const [name, value] of [['null', null], ['uppercase', 'A'.repeat(40)], ['short', 'a'.repeat(39)], ['object', {}]]) {
    check(`v2 rejects ${name} ${section}.${key}`, s => { s[section][key] = value; }, { evidenceState: 'INVALID_SNAPSHOT' }, postMerge);
  }
  test(`v2 does not evaluate ${section}.${key} accessor`, () => {
    const s = postMerge(); let called = false;
    Object.defineProperty(s[section], key, { enumerable: true, get() { called = true; return C; } });
    assert.equal(diagnose(s).evidenceState, 'INVALID_SNAPSHOT'); assert.equal(called, false);
  });
}
test('v2 post-merge classification is deterministic, non-mutating and deeply frozen', () => {
  const s = postMerge(), before = JSON.stringify(s), a = diagnose(s), b = diagnose(s);
  assert.deepEqual(a, b); assert.equal(JSON.stringify(s), before);
  assert(Object.isFrozen(a)); assert(Object.isFrozen(a.safety));
  assert(Object.isFrozen(a.matchingRuns)); assert(Object.isFrozen(a.matchingRuns[0]));
  assert.equal(a.schemaVersion, 2); assert.equal(a.safety.diagnosticOnly, true);
});
