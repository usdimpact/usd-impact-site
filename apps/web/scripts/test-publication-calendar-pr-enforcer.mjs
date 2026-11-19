import assert from 'node:assert/strict';

const headSha = 'a'.repeat(40);
const catalystPath = 'apps/web/src/content/catalyst-briefs/2099-01-01-cpi-preview.md';

function source({ releaseAt, calendar = true, event = 'BLS Consumer Price Index (CPI) — December 2098' }) {
  const calendarValue = calendar ? `calendar: ${JSON.stringify({
    publisher: 'BLS',
    series: 'CPI',
    referencePeriod: '2098-12',
    releaseStage: 'initial',
    eventDate: releaseAt.slice(0, 10),
    releaseTime: '08:30',
    timeZone: 'America/New_York',
    releaseAt,
  })}\n` : '';
  return `---
event: "${event}"
phase: "preview"
status: "published"
statusLabel: "scheduled-confirmed"
${calendarValue}---

Body
`;
}

async function scenario(index, {
  headRef, releaseAt, calendar = true, driftBeforeClose = false,
  nonCatalyst = false, statusHttp = 201, fullFilePages = false,
  fullPrPages = false, event = 'BLS Consumer Price Index (CPI) — December 2098',
  initialStatuses = [], statusReadHttp = 200, multiPrs = null,
  fileHttp = 200, statusHistoryOverride = null, clockStartMs = null,
  advanceMsPerRequest = 0, duplicatePrPage = false, omitFirstHead = false,
  contentHttp = 200, driftBeforeStatus = false, statusReadAdvanceMs = 0,
  statusPostAdvanceMs = 0, filePageShape = false,
}) {
  process.env.GITHUB_TOKEN = 'fixture-token';
  process.env.GITHUB_REPOSITORY = 'usdimpact/usd-impact-site';
  process.env.TARGET_PR = (fullPrPages || multiPrs) ? '' : '123';
  process.env.GUARD_WINDOW_MINUTES = '60';
  process.env.GUARD_STATUS_CONTEXT = 'publication-calendar-freshness';
  process.env.AUTOMATION_BRANCH_PREFIX = 'automation/catalyst-brief-';

  const requests = [];
  const statuses = initialStatuses.map((x) => ({ ...x }));
  const realNow = Date.now;
  // The enforcer intentionally throws only the first HOLD after emitting the
  // complete machine-readable sweep summary. Observe that summary directly.
  const realLog = console.log;
  let summary = null;
  console.log = (...args) => {
    const value = String(args[0] ?? '');
    if (args.length === 1 && value.startsWith('{"schema":"publication-calendar-pr-guard/')) {
      summary = JSON.parse(value);
    } else {
      realLog(...args);
    }
  };
  let clock = clockStartMs === null ? null : clockStartMs;
  if (clock !== null) Date.now = () => clock;
  let pullReads = 0;
  globalThis.fetch = async (url, init = {}) => {
    if (clock !== null) clock += advanceMsPerRequest;
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.github.com');
    assert.equal(init.headers.Authorization, 'Bearer fixture-token');
    assert.ok(init.signal instanceof AbortSignal, 'every GitHub request must have a timeout signal');
    requests.push({ path: parsed.pathname + parsed.search, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : null });
    const json = (value, status = 200) => new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
    if (multiPrs && parsed.pathname.endsWith('/pulls')) {
      const page = Number(parsed.searchParams.get('page'));
      const batch = multiPrs.slice((page - 1) * 100, page * 100);
      return json(batch.map((p) => ({
        number: p.number, state: 'open',
        html_url: 'https://github.com/usdimpact/usd-impact-site/pull/' + p.number,
        ...(p.omitHead ? {} : { head: {
          ref: p.ref, sha: p.sha, repo: { full_name: 'usdimpact/usd-impact-site' },
        } }),
      })));
    }
    if (fullPrPages && parsed.pathname.endsWith('/pulls')) {
      const page = Number(parsed.searchParams.get('page'));
      return json(Array.from({ length: 100 }, (_, i) => {
        const number = duplicatePrPage && page === 2 && i === 0
          ? 100 : (page - 1) * 100 + i + 1;
        return {
          number, state: 'open',
          html_url: 'https://github.com/usdimpact/usd-impact-site/pull/' + number,
          head: { ref: 'editorial/test', sha: headSha, repo: { full_name: 'usdimpact/usd-impact-site' } },
        };
      }));
    }
    if (multiPrs && /\/pulls\/\d+$/.test(parsed.pathname) && (init.method ?? 'GET') === 'GET') {
      const number = Number(parsed.pathname.split('/').at(-1));
      const p = multiPrs.find((item) => item.number === number);
      if (!p) return json({ message: 'Not Found' }, 404);
      return json({ number, state: 'open',
        head: { ref: p.ref, sha: p.sha, repo: { full_name: 'usdimpact/usd-impact-site' } },
      });
    }
    if (parsed.pathname.endsWith('/pulls/123') && (init.method ?? 'GET') === 'GET') {
      pullReads += 1;
      return json({
        number: 123,
        state: 'open',
        html_url: 'https://github.com/usdimpact/usd-impact-site/pull/123',
        ...(omitFirstHead ? {} : { head: {
          ref: headRef,
          sha: (driftBeforeClose || driftBeforeStatus) && pullReads > 1 ? 'b'.repeat(40) : headSha,
          repo: { full_name: 'usdimpact/usd-impact-site' },
        } }),
      });
    }
    const fileMatch = parsed.pathname.match(/\/pulls\/(\d+)\/files$/);
    if (multiPrs && fileMatch) {
      const pr = multiPrs.find((p) => p.number === Number(fileMatch[1]));
      const page = Number(parsed.searchParams.get('page'));
      const files = pr.files.map((filename) => ({ filename, status: 'added' }));
      return json(files.slice((page - 1) * 100, page * 100));
    }
    if (fullPrPages && /\/pulls\/[0-9]+\/files$/.test(parsed.pathname)) return json([]);
    if (parsed.pathname.endsWith('/pulls/123/files')) {
      if (fileHttp !== 200) return json({}, fileHttp);
      if (filePageShape) return json({ invalid: true });
      if (fullFilePages) return json(Array.from({ length: 100 }, () => ({
        filename: nonCatalyst ? 'README.md' : catalystPath, status: 'added',
      })));
      return json([{ filename: nonCatalyst ? 'README.md' : catalystPath, status: 'added' }]);
    }
    if (parsed.pathname.includes('/contents/')) {
      if (contentHttp !== 200) return json({ message: 'Source unavailable' }, contentHttp);
      const path = parsed.pathname.split('/contents/')[1].split('/').map(decodeURIComponent).join('/');
      const ref = parsed.searchParams.get('ref');
      const raw = multiPrs ? multiPrs.find((p) => p.sha === ref
        && Object.prototype.hasOwnProperty.call(p.contents ?? {}, path))?.contents?.[path]
        : source({ releaseAt, calendar, event });
      if (raw === undefined) return json({ message: 'Not Found' }, 404);
      return json({ type: 'file', encoding: 'base64', content: Buffer.from(raw).toString('base64') });
    }
    if (/\/commits\/[a-f0-9]{40}\/statuses$/.test(parsed.pathname) && (init.method ?? 'GET') === 'GET') {
      if (clock !== null) clock += statusReadAdvanceMs;
      if (statusReadHttp !== 200) return json({}, statusReadHttp);
      const sha = parsed.pathname.split('/commits/')[1].split('/statuses')[0];
      return json(statusHistoryOverride ?? statuses.filter((item) => item.sha === sha));
    }
    if (/\/statuses\/[a-f0-9]{40}$/.test(parsed.pathname) && init.method === 'POST') {
      const sha = parsed.pathname.split('/statuses/')[1];
      const code = typeof statusHttp === 'function' ? statusHttp(sha) : statusHttp;
      if (clock !== null) clock += statusPostAdvanceMs;
      if (code === 201) statuses.unshift({ sha, ...JSON.parse(init.body), recordedAtMs: clock });
      return json({}, code);
    }
    if (parsed.pathname.endsWith('/pulls/123') && init.method === 'PATCH') return json({ number: 123, state: 'closed' });
    throw new Error(`Unexpected request: ${init.method ?? 'GET'} ${parsed.pathname}`);
  };

  let failure = null;
  try {
    await import(`./enforce-publication-calendar-prs.mjs?scenario=${index}`);
  } catch (error) {
    failure = String(error?.message ?? error);
  } finally {
    Date.now = realNow;
    console.log = realLog;
  }
  const status = requests.find((item) => item.path.endsWith('/statuses/' + headSha));
  const close = requests.find((item) => item.method === 'PATCH' && item.path.endsWith('/pulls/123'));
  return { status: status?.body, close, requests, failure, statuses, summary,
    posted: requests.filter((item) => item.method === 'POST') };
}

const fresh = await scenario(1, {
  headRef: 'automation/catalyst-brief-cpi-future',
  releaseAt: '2099-01-01T13:30:00.000Z',
});
assert.equal(fresh.failure, null);
assert.equal(fresh.status.state, 'success');
assert.equal(Boolean(fresh.close), false);

const expired = await scenario(2, {
  headRef: 'automation/catalyst-brief-cpi-expired',
  releaseAt: '2000-01-01T13:30:00.000Z',
});
assert.equal(expired.failure, null);
assert.equal(expired.status.state, 'failure');
assert.equal(Boolean(expired.close), true);

const manual = await scenario(3, {
  headRef: 'editorial/manual-cpi',
  releaseAt: '2000-01-01T13:30:00.000Z',
});
assert.equal(manual.failure, null);
assert.equal(manual.status.state, 'failure');
assert.equal(Boolean(manual.close), false);

const missing = await scenario(4, {
  headRef: 'automation/catalyst-brief-cpi-missing-calendar',
  releaseAt: '2099-01-01T13:30:00.000Z',
  calendar: false,
});
assert.equal(missing.failure, null);
assert.equal(missing.status.state, 'failure');
assert.equal(Boolean(missing.close), true);

const drifted = await scenario(5, {
  headRef: 'automation/catalyst-brief-cpi-expired',
  releaseAt: '2000-01-01T13:30:00.000Z',
  driftBeforeClose: true,
});
assert.equal(drifted.failure, null);
assert.equal(drifted.status.state, 'failure');
assert.equal(Boolean(drifted.close), false, 'newer PR head must never be closed using an older evaluation');

const unrelated = await scenario(6, {
  headRef: 'editorial/unrelated', releaseAt: '2099-01-01T13:30:00.000Z', nonCatalyst: true,
});
assert.equal(unrelated.failure, null);
assert.equal(unrelated.status, undefined, 'unrelated PR must not receive a recurring success status');
assert.equal(unrelated.requests.some((item) => item.path.includes('/contents/')), false);
assert.equal(Boolean(unrelated.close), false);

const otherIssuer = await scenario(7, {
  headRef: 'editorial/eia-review', releaseAt: '2099-01-01T13:30:00.000Z',
  calendar: false, event: 'EIA Weekly Petroleum Status Report',
});
assert.equal(otherIssuer.failure, null);
assert.equal(otherIssuer.status, undefined, 'uncovered issuer cannot be given a BLS status');
assert.equal(Boolean(otherIssuer.close), false);

const outage = await scenario(8, {
  headRef: 'automation/catalyst-brief-cpi-expired',
  releaseAt: '2000-01-01T13:30:00.000Z', statusHttp: 502,
});
assert.match(outage.failure ?? '', /HOLD_GUARD_STATUS_WRITE_PR_123_HOLD_GITHUB_API_POST_502/);
assert.equal(outage.requests.filter((item) => item.method === 'POST').length, 1, 'ambiguous POST must not retry');
assert.equal(Boolean(outage.close), false, 'failed status must not auto-close an automation PR');

const incompleteFiles = await scenario(9, {
  headRef: 'editorial/many-files', releaseAt: '2099-01-01T13:30:00.000Z',
  fullFilePages: true, nonCatalyst: true,
});
assert.match(incompleteFiles.failure ?? '', /HOLD_PR_FILE_SCAN_TRUNCATED/);
assert.equal(incompleteFiles.status, undefined,
  'unknown file coverage must HOLD without a sticky speculative failure on an unrelated SHA');
assert.equal(Boolean(incompleteFiles.close), false);

const incompletePrSweep = await scenario(10, {
  headRef: 'editorial/many-prs', releaseAt: '2099-01-01T13:30:00.000Z',
  fullPrPages: true,
});
assert.match(incompletePrSweep.failure ?? '', /HOLD_OPEN_PR_SCAN_TRUNCATED/);
assert.equal(incompletePrSweep.requests.filter((item) => item.method === 'POST').length, 0);

const content2 = 'apps/web/src/content/catalyst-briefs/2099-01-02-cpi-preview.md';
const expiredSource = source({ releaseAt: '2000-01-01T13:30:00.000Z' });
const freshSource = source({ releaseAt: '2099-01-01T13:30:00.000Z' });
const older = await scenario(11, {
  releaseAt: '2000-01-01T13:30:00.000Z',
  multiPrs: [
    { number: 124, ref: 'editorial/bulk', sha: 'a'.repeat(40),
      files: Array.from({ length: 450 }, (_, i) => 'docs/file-' + i + '.md'), contents: {} },
    { number: 123, ref: 'automation/catalyst-brief-cpi-expired', sha: 'b'.repeat(40),
      files: [catalystPath], contents: { [catalystPath]: expiredSource } },
  ],
});
assert.match(older.failure ?? '', /HOLD_PR_124_HOLD_PR_FILE_SCAN_TRUNCATED/);
assert.equal(older.statuses.find((x) => x.sha === 'b'.repeat(40))?.state, 'failure',
  'older expired PR must still receive BLOCK after an oversized newer PR');
assert.equal(older.statuses.find((x) => x.sha === 'a'.repeat(40)), undefined,
  'unknown-content infrastructure HOLD must not leave a permanent failure on an unrelated SHA');

const outageContinue = await scenario(12, {
  releaseAt: '2000-01-01T13:30:00.000Z',
  statusHttp: (sha) => sha === 'a'.repeat(40) ? 502 : 201,
  multiPrs: [
    { number: 124, ref: 'editorial/newer', sha: 'a'.repeat(40),
      files: [catalystPath], contents: { [catalystPath]: expiredSource } },
    { number: 123, ref: 'editorial/older', sha: 'b'.repeat(40),
      files: [catalystPath], contents: { [catalystPath]: expiredSource } },
  ],
});
assert.match(outageContinue.failure ?? '', /HOLD_GUARD_STATUS_WRITE_PR_124_HOLD_GITHUB_API_POST_502/);
assert.equal(outageContinue.statuses.find((x) => x.sha === 'b'.repeat(40))?.state, 'failure');
assert.equal(outageContinue.requests.filter((x) => x.method === 'POST' && x.path.endsWith('a'.repeat(40))).length, 1);

const shaGroup = await scenario(13, {
  releaseAt: '2099-01-01T13:30:00.000Z',
  multiPrs: [
    { number: 124, ref: 'editorial/main', sha: headSha,
      files: [catalystPath, content2], contents: { [catalystPath]: expiredSource, [content2]: freshSource } },
    { number: 123, ref: 'editorial/stacked', sha: headSha,
      files: [content2], contents: { [content2]: freshSource } },
  ],
});
assert.equal(shaGroup.failure, null);
assert.equal(shaGroup.statuses.at(-1)?.state, 'failure',
  'one BLOCK must dominate a shared-SHA group');
assert.equal(shaGroup.requests.filter((x) => x.method === 'POST').length, 1,
  'a shared SHA must receive only one status write');

const retained = await scenario(14, {
  headRef: 'editorial/review', releaseAt: '2099-01-01T13:30:00.000Z',
  initialStatuses: [{
    sha: headSha, context: 'publication-calendar-freshness', state: 'success',
    description: 'Freshness lease valid until 2099-01-01T12:30:00.000Z',
    target_url: 'https://github.com/usdimpact/usd-impact-site/pull/123',
  }],
});
assert.equal(retained.failure, null);
assert.equal(retained.requests.filter((x) => x.method === 'POST').length, 0,
  'write-on-change must not consume the per-context commit-status cap');

const readFailure = await scenario(15, {
  headRef: 'editorial/review', releaseAt: '2099-01-01T13:30:00.000Z',
  statusReadHttp: 502,
});
assert.match(readFailure.failure ?? '', /HOLD_GUARD_STATUS_READ_PR_123_HOLD_GITHUB_API_GET_502/);
assert.equal(readFailure.requests.filter((x) => x.method === 'POST').length, 0,
  'unknown prior status must never authorize a positive write');


const blockOnReadOutage = await scenario(16, {
  headRef: 'automation/catalyst-brief-cpi-expired',
  releaseAt: '2000-01-01T13:30:00.000Z', statusReadHttp: 502,
  initialStatuses: [{
    sha: headSha, context: 'publication-calendar-freshness', state: 'success',
    description: 'Freshness lease valid until 2099-01-01T12:30:00.000Z',
    target_url: 'https://github.com/usdimpact/usd-impact-site/pull/123',
  }],
});
assert.match(blockOnReadOutage.failure ?? '', /HOLD_GUARD_STATUS_READ_PR_123_HOLD_GITHUB_API_GET_502/);
assert.equal(blockOnReadOutage.posted.length, 1);
assert.equal(blockOnReadOutage.posted[0].body.state, 'failure');
assert.equal(Boolean(blockOnReadOutage.close), true, 'known expired automation preview must still close after confirmed failure');

const hiddenContext = await scenario(17, {
  headRef: 'editorial/fresh', releaseAt: '2099-01-01T13:30:00.000Z',
  statusHistoryOverride: Array.from({ length: 100 }, (_, i) => ({
    context: 'unrelated-check-' + i, state: 'success',
  })),
});
assert.match(hiddenContext.failure ?? '', /HOLD_STATUS_CONTEXT_UNVERIFIED_PR_123/);
assert.equal(hiddenContext.posted.length, 0,
  '100 other contexts must not authorize a positive status whose prior state is unknown');

const hiddenBlocked = await scenario(18, {
  headRef: 'editorial/expired', releaseAt: '2000-01-01T13:30:00.000Z',
  statusHistoryOverride: Array.from({ length: 100 }, (_, i) => ({
    context: 'unrelated-check-' + i, state: 'success',
  })),
});
assert.match(hiddenBlocked.failure ?? '', /HOLD_STATUS_CONTEXT_UNVERIFIED_PR_123/);
assert.equal(hiddenBlocked.posted.length, 1);
assert.equal(hiddenBlocked.posted[0].body.state, 'failure',
  'known BLOCK must be posted despite an obscured status context');

const transientUnknown = await scenario(19, {
  headRef: 'editorial/readme', releaseAt: '2099-01-01T13:30:00.000Z',
  nonCatalyst: true, fileHttp: 502,
});
assert.match(transientUnknown.failure ?? '', /HOLD_PR_123_HOLD_GITHUB_API_GET_502/);
assert.equal(transientUnknown.posted.length, 0,
  'an unknown-content GET failure must not create a permanent red status on an unrelated PR');

const multiBlockFirst = await scenario(20, {
  releaseAt: '2099-01-01T13:30:00.000Z',
  multiPrs: [
    { number: 125, ref: 'editorial/stacked-fresh', sha: headSha,
      files: [content2], contents: { [content2]: freshSource } },
    { number: 124, ref: 'editorial/main-expired', sha: headSha,
      files: [catalystPath], contents: { [catalystPath]: expiredSource } },
  ],
});
assert.equal(multiBlockFirst.failure, null);
assert.equal(multiBlockFirst.posted.length, 1);
assert.equal(multiBlockFirst.posted[0].body.state, 'failure',
  'shared-SHA BLOCK must win even when the fresh PR is first');

const incompleteShared = await scenario(21, {
  releaseAt: '2000-01-01T13:30:00.000Z',
  multiPrs: [
    { number: 125, ref: 'automation/catalyst-brief-bulk', sha: headSha,
      files: Array.from({ length: 450 }, (_, i) => 'docs/x' + i + '.md'), contents: {} },
    { number: 124, ref: 'automation/catalyst-brief-expired', sha: headSha,
      files: [catalystPath], contents: { [catalystPath]: expiredSource } },
  ],
});
assert.match(incompleteShared.failure ?? '', /HOLD_PR_125_HOLD_PR_FILE_SCAN_TRUNCATED/);
assert.equal(incompleteShared.posted.length, 1);
assert.equal(incompleteShared.posted[0].body.state, 'failure');
assert.equal(incompleteShared.requests.some((x) => x.method === 'PATCH'), false,
  'no automation PR in an incompletely evaluated shared group may auto-close');

const incompleteGlobal = await scenario(22, {
  releaseAt: '2000-01-01T13:30:00.000Z',
  multiPrs: [
    { number: 601, ref: 'editorial/fresh', sha: 'a'.repeat(40),
      files: [content2], contents: { [content2]: freshSource } },
    { number: 600, ref: 'automation/catalyst-brief-expired', sha: 'b'.repeat(40),
      files: [catalystPath], contents: { [catalystPath]: expiredSource } },
    ...Array.from({ length: 499 }, (_, i) => ({
      number: 599 - i, ref: 'editorial/unrelated', sha: 'c'.repeat(40),
      files: ['README.md'], contents: {},
    })),
  ],
});
assert.match(incompleteGlobal.failure ?? '', /HOLD_OPEN_PR_SCAN_TRUNCATED/);
assert.equal(incompleteGlobal.posted.some((x) => x.body.state === 'success'), false,
  'no positive status while the open PR inventory is incomplete');
assert.equal(incompleteGlobal.posted.some((x) => x.body.state === 'failure'), true,
  'known expired preview still receives its failure despite incomplete scan');
assert.equal(incompleteGlobal.requests.some((x) => x.method === 'PATCH'), false,
  'no automatic closure during incomplete global scan');

const duplicatePage = await scenario(23, {
  headRef: 'editorial/pagination', releaseAt: '2099-01-01T13:30:00.000Z',
  fullPrPages: true, duplicatePrPage: true,
});
assert.match(duplicatePage.failure ?? '', /HOLD_OPEN_PR_SCAN_DRIFT/);
assert.equal(duplicatePage.posted.some((x) => x.body.state === 'success'), false);

const missingHead = await scenario(24, {
  headRef: 'editorial/malformed-PR', releaseAt: '2099-01-01T13:30:00.000Z',
  omitFirstHead: true,
});
assert.match(missingHead.failure ?? '', /HOLD_PR_IDENTITY/);
assert.equal(missingHead.posted.length, 0);

const NOW_MS = Date.parse('2026-11-15T18:00:00.000Z');
const atBoundary = new Date(NOW_MS + 60 * 60000 + 90000).toISOString();
const slowSource = source({ releaseAt: atBoundary });
const lateFresh = await scenario(25, {
  releaseAt: atBoundary, clockStartMs: NOW_MS, advanceMsPerRequest: 10000,
  multiPrs: [
    { number: 601, ref: 'editorial/fresh-near-cutoff', sha: 'a'.repeat(40),
      files: [catalystPath], contents: { [catalystPath]: slowSource } },
    ...Array.from({ length: 20 }, (_, i) => ({
      number: 600 - i, ref: 'editorial/readme', sha: 'c'.repeat(40),
      files: ['README.md'], contents: {},
    })),
  ],
});
assert.equal(lateFresh.failure, null);
assert.equal(lateFresh.posted.length, 1);
assert.equal(lateFresh.posted[0].body.state, 'failure',
  'slow scan may never post a fresh success after its freshness boundary');
assert.equal(lateFresh.posted.some((x) => x.body.state === 'success'), false);


// Corrective tests 26-35: regressions found by independent source-only review.
// 26: An expired preview among the first 400 of 450 files must not disappear.
const truncatedKnown = await scenario(26, {
  releaseAt: '2000-01-01T13:30:00.000Z',
  multiPrs: [{
    number: 123, ref: 'automation/catalyst-brief-truncated', sha: headSha,
    files: [catalystPath, ...Array.from({ length: 449 }, (_, i) => 'docs/other-' + i + '.md')],
    contents: { [catalystPath]: expiredSource },
  }],
});
assert.match(truncatedKnown.failure ?? '', /HOLD_PR_123_HOLD_PR_FILE_SCAN_TRUNCATED/);
assert.equal(truncatedKnown.posted.length, 1);
assert.equal(truncatedKnown.posted[0].body.state, 'failure');
assert.equal(truncatedKnown.requests.some((r) => r.method === 'PATCH'), false,
  'known BLOCK on a partial file scan must never auto-close');

// 27-28: Shared-SHA leases must be independent of the order of the PR list.
const lateSource = source({ releaseAt: '2099-01-03T13:30:00.000Z' });
for (const [index, reverse] of [[27, false], [28, true]]) {
  const members = [
    { number: 124, ref: 'editorial/long-lease', sha: headSha,
      files: [content2], contents: { [content2]: lateSource } },
    { number: 123, ref: 'editorial/short-lease', sha: headSha,
      files: [catalystPath], contents: { [catalystPath]: freshSource } },
  ];
  const result = await scenario(index, {
    releaseAt: '2099-01-01T13:30:00.000Z',
    multiPrs: reverse ? members.reverse() : members,
  });
  assert.equal(result.failure, null);
  assert.equal(result.posted.length, 1);
  assert.equal(result.posted[0].body.state, 'success');
  assert.match(result.posted[0].body.description, /2099-01-01T12:30:00.000Z/,
    'shared-SHA success must carry the earliest lease');
}

// 29: The status-history read, not merely the group stage, can cross the cutoff.
const readBoundary = new Date(NOW_MS + 60 * 60000 + 160000).toISOString();
const crossedDuringStatusGet = await scenario(29, {
  headRef: 'editorial/late-read', releaseAt: readBoundary,
  clockStartMs: NOW_MS, statusReadAdvanceMs: 30000,
});
assert.equal(crossedDuringStatusGet.failure, null);
assert.equal(crossedDuringStatusGet.posted[0]?.body.state, 'failure');

// 30: A 30-second request budget is included before any affirmative POST.
const postBoundary = new Date(NOW_MS + 60 * 60000 + 149000).toISOString();
const delayedPost = await scenario(30, {
  headRef: 'editorial/delayed-post', releaseAt: postBoundary,
  clockStartMs: NOW_MS, statusPostAdvanceMs: 29999,
});
assert.equal(delayedPost.failure, null);
assert.equal(delayedPost.posted[0]?.body.state, 'failure',
  'positive POST cannot consume the last 30s of the safety budget');
assert.equal(delayedPost.posted.some((r) => r.body.state === 'success'), false);

// 31: A moved head is never given a conservative infrastructure failure status.
const movedBeforeFailure = await scenario(31, {
  headRef: 'editorial/moved-head', releaseAt: '2000-01-01T13:30:00.000Z',
  contentHttp: 404, driftBeforeStatus: true,
});
assert.match(movedBeforeFailure.failure ?? '', /HOLD_PR_123_HOLD_GITHUB_API_GET_404/,
  'the thrown error retains the first HOLD');
assert.equal(movedBeforeFailure.summary?.complete, false);
assert.ok(movedBeforeFailure.summary?.holds?.includes('HOLD_PR_123_HOLD_PR_HEAD_MOVED'),
  'the complete machine-readable summary must also report the head movement');
assert.equal(movedBeforeFailure.posted.length, 0);
assert.equal(Boolean(movedBeforeFailure.close), false);

// 32: A 422 on one SHA does not suppress a failure for an independent SHA.
const rejectedStatus = await scenario(32, {
  releaseAt: '2000-01-01T13:30:00.000Z',
  statusHttp: (sha) => sha === 'a'.repeat(40) ? 422 : 201,
  multiPrs: [
    { number: 124, ref: 'editorial/422', sha: 'a'.repeat(40),
      files: [catalystPath], contents: { [catalystPath]: expiredSource } },
    { number: 123, ref: 'editorial/independent', sha: 'b'.repeat(40),
      files: [catalystPath], contents: { [catalystPath]: expiredSource } },
  ],
});
assert.match(rejectedStatus.failure ?? '', /HOLD_GUARD_STATUS_WRITE_PR_124_HOLD_GITHUB_API_POST_422/);
assert.equal(rejectedStatus.statuses.find((r) => r.sha === 'b'.repeat(40))?.state, 'failure');

// 33: Invalid frontmatter still blocks even if the guarded count is zero.
const malformedSource = await scenario(33, {
  releaseAt: '2099-01-01T13:30:00.000Z',
  multiPrs: [{
    number: 123, ref: 'editorial/invalid-frontmatter', sha: headSha,
    files: [catalystPath], contents: { [catalystPath]: 'not frontmatter' },
  }],
});
assert.equal(malformedSource.failure, null);
assert.equal(malformedSource.posted[0]?.body.state, 'failure');
assert.match(malformedSource.posted[0]?.body.description ?? '', /HOLD_SOURCE_FRONTMATTER/);

// 34: Malformed files API shape holds without an unsupported status write.
const malformedListing = await scenario(34, {
  headRef: 'editorial/malformed-file-list', releaseAt: '2099-01-01T13:30:00.000Z',
  filePageShape: true,
});
assert.match(malformedListing.failure ?? '', /HOLD_PR_FILE_PAGE_SHAPE/);
assert.equal(malformedListing.posted.length, 0);

// 35: Synthetic replicas of preserved legacy non-BLS PRs have zero write/close.
const preservedLegacy = await scenario(35, {
  releaseAt: '2000-01-01T13:30:00.000Z',
  multiPrs: [916, 939, 1010, 1203, 1206, 1211, 1225].map((number, i) => ({
    number, ref: 'automation/catalyst-brief-legacy-' + number, sha: String(i + 1).repeat(40),
    files: [catalystPath],
    contents: { [catalystPath]: source({
      releaseAt: '2000-01-01T13:30:00.000Z', calendar: false,
      event: 'Treasury or BEA historical non-BLS preview',
    }) },
  })),
});
assert.equal(preservedLegacy.failure, null);
assert.equal(preservedLegacy.posted.length, 0);
assert.equal(preservedLegacy.requests.some((r) => r.method === 'PATCH'), false);

console.log('publication calendar PR enforcer API tests pass (35 offline scenarios)');
