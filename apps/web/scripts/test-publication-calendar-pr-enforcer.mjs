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
}) {
  process.env.GITHUB_TOKEN = 'fixture-token';
  process.env.GITHUB_REPOSITORY = 'usdimpact/usd-impact-site';
  process.env.TARGET_PR = (fullPrPages || multiPrs) ? '' : '123';
  process.env.GUARD_WINDOW_MINUTES = '60';
  process.env.GUARD_STATUS_CONTEXT = 'publication-calendar-freshness';
  process.env.AUTOMATION_BRANCH_PREFIX = 'automation/catalyst-brief-';

  const requests = [];
  const statuses = initialStatuses.map((x) => ({ ...x }));
  let pullReads = 0;
  globalThis.fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.github.com');
    assert.equal(init.headers.Authorization, 'Bearer fixture-token');
    requests.push({ path: parsed.pathname + parsed.search, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : null });
    const json = (value, status = 200) => new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
    if (multiPrs && parsed.pathname.endsWith('/pulls')) {
      const page = Number(parsed.searchParams.get('page'));
      return json(page === 1 ? multiPrs.map((p) => ({
        number: p.number, state: 'open',
        html_url: 'https://github.com/usdimpact/usd-impact-site/pull/' + p.number,
        head: { ref: p.ref, sha: p.sha, repo: { full_name: 'usdimpact/usd-impact-site' } },
      })) : []);
    }
    if (fullPrPages && parsed.pathname.endsWith('/pulls')) {
      return json(Array.from({ length: 100 }, (_, i) => ({
        number: i + 1, state: 'open',
        html_url: 'https://github.com/usdimpact/usd-impact-site/pull/' + (i + 1),
        head: { ref: 'editorial/test', sha: headSha, repo: { full_name: 'usdimpact/usd-impact-site' } },
      })));
    }
    if (parsed.pathname.endsWith('/pulls/123') && (init.method ?? 'GET') === 'GET') {
      pullReads += 1;
      return json({
        number: 123,
        state: 'open',
        html_url: 'https://github.com/usdimpact/usd-impact-site/pull/123',
        head: {
          ref: headRef,
          sha: driftBeforeClose && pullReads > 1 ? 'b'.repeat(40) : headSha,
          repo: { full_name: 'usdimpact/usd-impact-site' },
        },
      });
    }
    const fileMatch = parsed.pathname.match(/\/pulls\/(\d+)\/files$/);
    if (multiPrs && fileMatch) {
      const pr = multiPrs.find((p) => p.number === Number(fileMatch[1]));
      const page = Number(parsed.searchParams.get('page'));
      const files = pr.files.map((filename) => ({ filename, status: 'added' }));
      return json(files.slice((page - 1) * 100, page * 100));
    }
    if (parsed.pathname.endsWith('/pulls/123/files')) {
      if (fullFilePages) return json(Array.from({ length: 100 }, () => ({ filename: catalystPath, status: 'added' })));
      return json([{ filename: nonCatalyst ? 'README.md' : catalystPath, status: 'added' }]);
    }
    if (parsed.pathname.includes('/contents/')) {
      const path = parsed.pathname.split('/contents/')[1].split('/').map(decodeURIComponent).join('/');
      const ref = parsed.searchParams.get('ref');
      const raw = multiPrs ? multiPrs.find((p) => p.sha === ref)?.contents?.[path]
        : source({ releaseAt, calendar, event });
      if (raw === undefined) return json({ message: 'Not Found' }, 404);
      return json({ type: 'file', encoding: 'base64', content: Buffer.from(raw).toString('base64') });
    }
    if (/\/commits\/[a-f0-9]{40}\/statuses$/.test(parsed.pathname) && (init.method ?? 'GET') === 'GET') {
      if (statusReadHttp !== 200) return json({}, statusReadHttp);
      const sha = parsed.pathname.split('/commits/')[1].split('/statuses')[0];
      return json(statuses.filter((item) => item.sha === sha));
    }
    if (/\/statuses\/[a-f0-9]{40}$/.test(parsed.pathname) && init.method === 'POST') {
      const sha = parsed.pathname.split('/statuses/')[1];
      const code = typeof statusHttp === 'function' ? statusHttp(sha) : statusHttp;
      if (code === 201) statuses.unshift({ sha, ...JSON.parse(init.body) });
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
  }
  const status = requests.find((item) => item.path.endsWith('/statuses/' + headSha));
  const close = requests.find((item) => item.method === 'PATCH' && item.path.endsWith('/pulls/123'));
  return { status: status?.body, close, requests, failure, statuses };
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
  fullFilePages: true,
});
assert.match(incompleteFiles.failure ?? '', /HOLD_PR_FILE_SCAN_TRUNCATED/);
assert.equal(incompleteFiles.status?.state, 'failure', 'incomplete file scan must post a conservative failure');
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
assert.equal(older.statuses.find((x) => x.sha === 'a'.repeat(40))?.state, 'failure',
  'oversized PR must receive a conservative failure');

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

console.log('publication calendar PR enforcer API tests pass (15 offline scenarios)');
