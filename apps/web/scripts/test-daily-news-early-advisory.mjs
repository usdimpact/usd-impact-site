import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  checkEarlyDaily, formatEarlyReport,
} from './check-daily-news-early-advisory.mjs';

const day = '2026-11-05';
const repo = 'usdimpact/usd-impact-site';
const sourceId = 41888880001;
const pubId = 41888880002;
const prNumber = 987;
const title = 'Daily USD Impact — November 5, 2026: Mock issuer evidence';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  });
}
function text(body, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'text/html' } });
}

function fixture(options = {}) {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    const u = new URL(url);
    const p = u.pathname;
    const whichDate = options.day ?? day;
    const branch = 'automation/daily-usd-impact-' + whichDate + '-' + sourceId;
    if (p.includes('/contents/apps/web/src/content/news/')) {
      return options.missingMain ? json({message:'Not Found'},404) : json({type:'file'});
    }
    if (p.endsWith('/actions/workflows/daily-news.yml/runs')) {
      const s = {
        id: sourceId, path: '.github/workflows/daily-news.yml',
        head_branch: 'main', event: options.manualOnly ? 'workflow_dispatch' :
          options.recovery ? 'workflow_dispatch' : 'schedule',
        actor: {login: options.manualOnly ? 'usdimpact' : 'github-actions[bot]'},
        triggering_actor: {login: options.manualOnly ? 'usdimpact' : 'github-actions[bot]'},
        run_attempt: options.rerun ? 2 : 1,
        status: 'completed', conclusion: 'success',
        created_at: whichDate + 'T09:17:00Z',
      };
      return json({total_count: 1, workflow_runs: [s]});
    }
    if (p.endsWith('/actions/workflows/daily-news-auto-publish.yml/runs')) {
      return options.noPublisher
        ? json({total_count: 0, workflow_runs: []})
        : json({total_count: 1, workflow_runs: [{
            id:pubId, path:'.github/workflows/daily-news-auto-publish.yml',
            head_branch:'main', event:'workflow_dispatch', run_attempt:1,
            status:'completed', conclusion:'success',
            created_at:whichDate+'T12:20:00Z',
          }]});
    }
    if (p.endsWith('/pulls') && u.searchParams.get('head')) {
      if (options.noPr) return json([]);
      return json([{
        number:prNumber, head:{ref:branch}, base:{ref:'main'},
        title:'Publish Daily USD Impact — '+whichDate,
        merged_at:whichDate+'T12:21:00Z',
      }]);
    }
    if (p.endsWith('/pulls/' + prNumber)) {
      return json({
        merged:!options.manualMerge, merged_by:{login:options.manualMerge?'usdimpact':'github-actions[bot]'},
        head:{ref:branch},
      });
    }
    if (p.endsWith('/pulls/' + prNumber + '/files')) {
      return json([{
        filename:'apps/web/src/content/news/'+whichDate+'.md',status:'added',
      }]);
    }
    if (p.endsWith('/news/latest.json')) {
      const actual = options.staleLatest ? '2026-11-04' : whichDate;
      return json({edition:{
        title, date:actual, slug:'/news/'+actual,
      }});
    }
    if (p.endsWith('/news/'+whichDate+'/')) {
      return text('<html><h1>'+title+'</h1></html>');
    }
    if (p.endsWith('/news/feed.xml')) {
      return text('<rss><link>https://www.usd-impact.com/news/'+whichDate+'/</link></rss>');
    }
    if (p.endsWith('/news')) {
      return options.staleIndex
        ? text('<html><h2>Latest edition</h2><a href="/news/2026-11-04">Old</a></html>')
        : text('<html><h2>Latest edition</h2><a href="/news/'+whichDate+'/">'+title+'</a></html>');
    }
    throw new Error('Unexpected fixture request: '+url);
  };
  return {fetchImpl, getCalls:() => calls};
}

function params(opts, overrides = {}) {
  const f = fixture(opts);
  return {
    f, input: {
      date: opts?.day ?? day, repository:repo, token:'test-token',
      now:new Date('2026-11-05T14:00:00Z'),
      fetchImpl:f.fetchImpl, ...overrides,
    },
  };
}

const good = params({});
const pass = await checkEarlyDaily(good.input);
assert.equal(pass.state, 'PRELIMINARY_PASS');
assert.equal(pass.articlePr, prNumber);
assert.equal(pass.sourceRunId, sourceId);
assert.equal(pass.generatorEvent, 'schedule');
assert.ok(good.f.getCalls() >= 10);
assert.match(formatEarlyReport({date:day,result:pass}), /does not attest the exact Vercel SHA/);

const fallback = params({recovery:true});
assert.equal((await checkEarlyDaily(fallback.input)).generatorEvent, 'workflow_dispatch');

const early = params({}, {now:new Date('2026-11-05T12:00:00Z')});
assert.equal((await checkEarlyDaily(early.input)).state, 'BEFORE_CUTOFF');
assert.equal(early.f.getCalls(), 0, 'a manual pre-cutoff observation must not call APIs');

const summerDate = '2026-07-15';
const summer = params({day:summerDate}, {
  now:new Date('2026-07-15T14:00:00Z'),
});
assert.equal((await checkEarlyDaily(summer.input)).usTime, '10:00', 'DST summer 14:00Z is 10:00 EDT');
assert.equal(pass.usTime, '09:00', 'DST winter 14:00Z is 09:00 EST');

for (const [label, opts, expected] of [
  ['missing edition', {missingMain:true}, /missing from protected main/],
  ['manual generator', {manualOnly:true}, /No bounded first-attempt/],
  ['run replay', {rerun:true}, /No bounded first-attempt/],
  ['no publisher', {noPublisher:true}, /No completed successful/],
  ['no original PR', {noPr:true}, /No unique source-linked/],
  ['manual merge', {manualMerge:true}, /No unique source-linked/],
  ['stale latest JSON', {staleLatest:true}, /Latest deployed edition is/],
  ['stale index', {staleIndex:true}, /News index\/latest edition parity/],
]) {
  const p = params(opts);
  await assert.rejects(checkEarlyDaily(p.input), expected, label);
}

await assert.rejects(
  checkEarlyDaily(params({}).input && {...params({}).input,date:'2026-11-04'}),
  /Edition and New York dates differ/,
);
assert.match(formatEarlyReport({date:day,failure:'No valid publisher receipt'}), /HOLD \/ investigate/);

const workflow = readFileSync(new URL('../../../.github/workflows/daily-news-early-advisory.yml',import.meta.url),'utf8');
assert.ok(workflow.includes("cron: '0 14 * * 1-5'"), '14:00 UTC early weekday monitor schedule');
assert.match(workflow, /contents: read[\s\S]*actions: read[\s\S]*pull-requests: read[\s\S]*issues: write/);
assert.match(workflow, /github\.event_name == 'schedule' && github\.run_attempt == 1/);
assert.match(workflow, /gh issue comment 840/, 'only add incident evidence on an eligible failed scheduled check');
assert.doesNotMatch(workflow,/gh workflow run|gh issue close|vercel deploy|force-push|gh pr merge/i);
assert.match(workflow,/if: steps\.check\.outcome == 'failure'/, 'fail checkout on missing Daily');
console.log('early Daily advisory and DST / provenance / public parity negatives PASS');
