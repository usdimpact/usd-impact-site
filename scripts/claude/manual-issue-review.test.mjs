import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectIssue, parseIssueNumber, requireExactApproval, validateReview,
  readIssue, previewSummary, modelSummary, runOneModelCall, REPOSITORY, REPOSITORY_ID,
} from './manual-issue-review.mjs';
const repo = { id: REPOSITORY_ID, full_name: REPOSITORY, private: false };
const raw = { number: 3333, id: 6103772877, repository_url: `https://api.github.com/repos/${REPOSITORY}`,
  html_url: `https://github.com/${REPOSITORY}/issues/3333`, state: 'open', locked: false,
  title: 'Review keyboard navigation checklist', body: 'Check focus order on an isolated demo page.',
  updated_at: '2026-11-06T15:30:00Z', labels: [{ name: 'claude-review-safe' }] };
const issue = inspectIssue(raw, repo, 3333);
const env = {
  MODE: 'model_review', EXPECTED_ISSUE_ID: String(raw.id), EXPECTED_SOURCE_DIGEST: issue.source_digest,
  MODEL_APPROVAL_CONFIRMATION: 'I_APPROVE_ONE_CLAUDE_ISSUE_REVIEW', BILLING_READY: 'yes',
  GITHUB_RUN_ATTEMPT: '1', APPROVED_RUN_NUMBER: '3', GITHUB_RUN_NUMBER: '3',
  GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main',
  GITHUB_REPOSITORY: REPOSITORY, GITHUB_SHA: 'a'.repeat(40),
};
function failOf(fn, code) { assert.throws(fn, e => e.message === code); }

test('public allowlisted issue creates stable source hash but not execution authority', () => {
  assert.equal(issue.model_eligible, true);
  assert.match(issue.source_digest, /^[0-9a-f]{64}$/);
  assert.equal(issue.id, 6103772877);
  assert.equal(requireExactApproval(issue, env), true);
  assert.equal(inspectIssue({ ...raw }, repo, 3333).source_digest, issue.source_digest);
  assert.equal(Object.isFrozen(issue), true);
});

test('reject malformed issue selectors', () => {
  for(const v of ['', '0', '-1', '1.2', '3 && rm -rf', '1e2', '00', '1234567890', ' 3 ', null]) {
    failOf(() => parseIssueNumber(v), 'INVALID_ISSUE_NUMBER');
  }
  assert.equal(parseIssueNumber('3333'), 3333);
});

test('pin repository identity and public visibility', () => {
  for(const change of [{ id: 1 }, { full_name: 'attacker/repo' }, { private: true }]) {
    failOf(() => inspectIssue(raw, { ...repo, ...change }, 3333), 'REPOSITORY_IDENTITY_HOLD');
  }
});

test('reject PRs, wrong issue IDs, closed or locked sources', () => {
  for(const change of [{number:3334}, {id:0}, {pull_request:{url:'fake'}}, {state:'closed'},
    {locked:true}, {html_url:'https://example.com/3333'}, {updated_at:'garbage'}]) {
    failOf(() => inspectIssue({...raw,...change},repo,3333),'ISSUE_IDENTITY_HOLD');
  }
});

test('labels, content length and held categories prevent model eligibility', () => {
  for(const change of [
    {labels:[]}, {labels:[{name:'anyone'}]}, {title:'Research checkout fix'},
    {body:'Please rotate a secret token'}, {body:'foo@example.com'},
    {body:'sk-ant-verySecret123456'}, {body:'x'.repeat(1601)},
    {title:'x'.repeat(181)}, {body:'Bad\u001bescape'}, {body:''},
  ]) {
    assert.equal(inspectIssue({...raw,...change},repo,3333).model_eligible,false);
  }
});

test('all label and content changes alter source digest', () => {
  for(const change of [{body:'a new paragraph'}, {title:'a different title'},
    {updated_at:'2026-11-06T15:30:02Z'}, {labels:[{name:'claude-review-safe'},{name:'extra'}]}]) {
    assert.notEqual(inspectIssue({...raw,...change},repo,3333).source_digest,issue.source_digest);
  }
});

test('model approval requires exact issue ID and source digest', () => {
  for(const change of [
    {EXPECTED_ISSUE_ID:'6103772878'}, {EXPECTED_ISSUE_ID:'0'},
    {EXPECTED_SOURCE_DIGEST:'a'.repeat(64)}, {EXPECTED_SOURCE_DIGEST:'INVALID'},
  ]) assert.throws(()=>requireExactApproval(issue,{...env,...change}));
  failOf(() => requireExactApproval(inspectIssue({...raw,labels:[]},repo,3333),env),'ISSUE_NOT_ELIGIBLE_FOR_MODEL');
});

test('paid gate requires explicit confirmation, exact run and disabled reruns', () => {
  for(const change of [{MODEL_APPROVAL_CONFIRMATION:'yes'}, {MODE:'preflight'},
    {BILLING_READY:'no'}, {GITHUB_RUN_ATTEMPT:'2'},
    {APPROVED_RUN_NUMBER:'2'}, {GITHUB_RUN_NUMBER:'4'}, {GITHUB_REF:'refs/heads/development'},
    {GITHUB_REPOSITORY:'attacker/repo'}, {GITHUB_EVENT_NAME:'push'}, {GITHUB_SHA:'bad'}]) {
    assert.throws(()=>requireExactApproval(issue,{...env,...change}));
  }
});

test('strict JSON advisory output cannot approve execution or perform tool calls',()=>{
  const valid={recommendation:'REVIEW_ONLY',summary:'Review the checklist',next_step:'Owner inspect draft',risks:[]};
  assert.equal(validateReview(valid).recommendation,'REVIEW_ONLY');
  for(const bad of [{...valid,recommendation:'EXECUTE'}, {...valid,approved:true},
    {...valid,summary:'x'.repeat(451)}, {...valid,next_step:'send\nmail'},
    {...valid,risks:['a','b','c','d']}, {...valid,risks:['x'.repeat(161)]},
    null,[],{recommendation:'HOLD'}]) assert.throws(()=>validateReview(bad));
});

test('preflight summary exposes identity and digest but never issue body/title',()=>{
  const s=previewSummary(issue);
  assert.match(s,/6103772877/);
  assert.match(s,/ELIGIBLE_FOR_OWNER_REVIEW/);
  assert.ok(s.includes(issue.source_digest));
  assert.ok(!s.includes(issue.title)); assert.ok(!s.includes(issue.body));
  const m=modelSummary(issue,{recommendation:'HOLD',summary:'<script>Risk</script>',next_step:'Review only',risks:[]},{input_tokens:60,output_tokens:20});
  assert.ok(!m.includes('<script>'));assert.ok(!m.includes(issue.body));
});

test('GitHub API read must validate origin and response fields (mocked, no network)',async()=>{
  const old=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,opts)=>{
    calls.push({url,method:opts.method||'GET'});
    const data=calls.length===1?repo:raw;
    return {ok:true,text:async()=>JSON.stringify(data)};
  };
  try{
    const r=await readIssue('a'.repeat(30),3333);
    assert.equal(r.id,raw.id);assert.equal(calls.length,2);
    assert.equal(calls[1].url,`https://api.github.com/repos/${REPOSITORY}/issues/3333`);
    assert.ok(calls.every(x=>x.method==='GET'));
  }finally{globalThis.fetch=old;}
});

test('no model request, OIDC token, or source fetch before all paid gates pass',async()=>{
  const old=globalThis.fetch;let calls=0;
  globalThis.fetch=()=>{calls++;throw Error('network called');};
  try{
    await assert.rejects(runOneModelCall(issue,{...env,BILLING_READY:'no'}),/BILLING_DISABLED/);
    await assert.rejects(runOneModelCall(issue,{...env,EXPECTED_SOURCE_DIGEST:'a'.repeat(64)}),/SOURCE_CHANGED/);
    assert.equal(calls,0);
  }finally{globalThis.fetch=old;}
});

test('wrong federation config aborts before token exchange',async()=>{
  const old=globalThis.fetch;let calls=0;globalThis.fetch=()=>{calls++;throw Error('network called');};
  try{
    await assert.rejects(runOneModelCall(issue,{...env,FEDERATION_RULE_ID:'wrong'}),/FEDERATION_CONFIG_HOLD/);
    assert.equal(calls,0);
  }finally{globalThis.fetch=old;}
});
