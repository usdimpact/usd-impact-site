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
}) {
  process.env.GITHUB_TOKEN = 'fixture-token';
  process.env.GITHUB_REPOSITORY = 'usdimpact/usd-impact-site';
  process.env.TARGET_PR = fullPrPages ? '' : '123';
  process.env.GUARD_WINDOW_MINUTES = '60';
  process.env.GUARD_STATUS_CONTEXT = 'publication-calendar-freshness';
  process.env.AUTOMATION_BRANCH_PREFIX = 'automation/catalyst-brief-';

  const requests = [];
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
    if (parsed.pathname.endsWith('/pulls/123/files')) {
      if (fullFilePages) return json(Array.from({ length: 100 }, () => ({ filename: catalystPath, status: 'added' })));
      return json([{ filename: nonCatalyst ? 'README.md' : catalystPath, status: 'added' }]);
    }
    if (parsed.pathname.includes('/contents/')) {
      const raw = source({ releaseAt, calendar, event });
      return json({ type: 'file', encoding: 'base64', content: Buffer.from(raw).toString('base64') });
    }
    if (parsed.pathname.endsWith('/statuses/' + headSha) && init.method === 'POST') return json({}, statusHttp);
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
  return { status: status?.body, close, requests, failure };
}

const fresh = await scenario(1, {
  headRef: 'automation/catalyst-brief-cpi-future',
  releaseAt: '2099-01-01T13:30:00.000Z',
});
assert.equal(fresh.status.state, 'success');
assert.equal(Boolean(fresh.close), false);

const expired = await scenario(2, {
  headRef: 'automation/catalyst-brief-cpi-expired',
  releaseAt: '2000-01-01T13:30:00.000Z',
});
assert.equal(expired.status.state, 'failure');
assert.equal(Boolean(expired.close), true);

const manual = await scenario(3, {
  headRef: 'editorial/manual-cpi',
  releaseAt: '2000-01-01T13:30:00.000Z',
});
assert.equal(manual.status.state, 'failure');
assert.equal(Boolean(manual.close), false);

const missing = await scenario(4, {
  headRef: 'automation/catalyst-brief-cpi-missing-calendar',
  releaseAt: '2099-01-01T13:30:00.000Z',
  calendar: false,
});
assert.equal(missing.status.state, 'failure');
assert.equal(Boolean(missing.close), true);

const drifted = await scenario(5, {
  headRef: 'automation/catalyst-brief-cpi-expired',
  releaseAt: '2000-01-01T13:30:00.000Z',
  driftBeforeClose: true,
});
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
assert.equal(incompleteFiles.status, undefined);

const incompletePrSweep = await scenario(10, {
  headRef: 'editorial/many-prs', releaseAt: '2099-01-01T13:30:00.000Z',
  fullPrPages: true,
});
assert.match(incompletePrSweep.failure ?? '', /HOLD_OPEN_PR_SCAN_TRUNCATED/);
assert.equal(incompletePrSweep.requests.filter((item) => item.method === 'POST').length, 0);

console.log('publication calendar PR enforcer API tests pass (10 offline scenarios)');
