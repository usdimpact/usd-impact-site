import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { createRecordedPublicationHandler } from '../src/lib/publication-response-boundary.js';
import { SERVING_SCOPE } from '../src/lib/publication-serving-policy.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const iso = (value) => new Date(value).toISOString();
const end = Date.parse('2026-09-11T12:30:00.000Z');
const route = '/news/catalysts/cpi-august-preview';
const routes = { homepage: '/', 'news-current': '/news', 'news-archive': '/news/archive',
  feed: '/news/feed.xml', 'latest-json': '/news/latest.json', sitemap: '/sitemap-0.xml' };
const event = { publisher: 'BLS', series: 'CPI', referencePeriod: '2026-08', releaseStage: 'initial',
  eventDate: '2026-09-11', releaseTime: '08:30', timeZone: 'America/New_York', releaseAt: iso(end) };
function article(slug = route, title = 'VISIBLE_TITLE') {
  const fields = { status: 'published', slug, category: 'USD Impact Catalyst Brief', title,
    summary: `${title}_SUMMARY`, event: 'BLS Consumer Price Index (CPI) for August 2026',
    phase: 'preview', statusLabel: 'scheduled-confirmed', eventDate: '2026-09-11', calendar: event };
  return `---\n${Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n${title}_BODY`;
}
function history(source, path) {
  return { ...SERVING_SCOPE, schema: 'publication-admission/v1', path, sourceSha256: hash(source),
    state: 'admitted', basis: 'calendar-verified', calendarVerified: true, deploymentId: 'dpl_previousfixture',
    commitSha: 'a'.repeat(40), artifactSha256: 'b'.repeat(64), evidenceSha256: 'c'.repeat(64),
    calendarCheckedAt: iso(end - 60_000), admittedAt: iso(end - 30_000), calendarValidUntil: iso(end), previewDeadline: iso(end) };
}
function fixture({ time = end - 1, surface = 'article', state = 'admitted', mixed = false } = {}) {
  const sources = [article()]; if (mixed) sources.push(article('/news/catalysts/hidden-item', 'HIDDEN_SENTINEL'));
  const entries = sources.map((source) => ({ path: JSON.parse(source.match(/^slug: (.*)$/m)[1]), sourceSha256: hash(source) }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const records = entries.map((entry) => ({ ...entry, record: entry.path.includes('hidden') || state === null ? null
    : { ...history(sources.find((source) => hash(source) === entry.sourceSha256), entry.path), state } }));
  let clock = time;
  const authority = { ...SERVING_SCOPE, schema: 'publication-serving-authority/v1', target: 'production',
    exposure: 'public-approved', deploymentId: 'dpl_currentfixture', commitSha: 'd'.repeat(40), artifactSha256: 'e'.repeat(64),
    historyRevision: 'history1', legacyBaseline: null, entries, manifestSha256: hash(JSON.stringify(entries)),
    observedAt: iso(time - 1), validUntil: iso(time + 10_000) };
  const stats = { sources: 0, authority: 0, history: 0, renders: 0 };
  const options = { surface, path: surface === 'article' ? route : routes[surface], now: () => clock,
    loadSources: async () => { stats.sources++; return sources; },
    loadAuthority: async () => { stats.authority++; return authority; },
    readHistory: async ({ revision, entries: requested }) => { stats.history++;
      return { revision, records: requested.map((key) => records.find((item) => item.path === key.path)) }; },
    render: async (view) => { stats.renders++; return JSON.stringify(view); },
  };
  return { options, stats, authority, records, sources, advance: (value) => { clock = value; } };
}
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
async function httpTest(env, operation, { before, duplicate = false } = {}) {
  const handler = createRecordedPublicationHandler(env.options);
  const completed = [];
  const server = createServer((req, res) => {
    before?.(req, res);
    const task = handler(req, res); completed.push(task);
    if (duplicate) completed.push(handler(req, res));
    task.catch(() => { if (!res.destroyed) res.destroy(); });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port;
  const send = ({ path = env.options.path, method = 'GET', headers = {}, onRequest } = {}) => new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: '127.0.0.1', port, path, method, headers, agent: false }, (res) => {
      const chunks = []; res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('error', reject); onRequest?.(req); req.end();
  });
  try { await operation(send, completed); await Promise.all(completed); }
  finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}
let groups = 0;
async function check(name, run) {
  try { await run(); groups++; }
  catch (error) { throw new Error(`Publication response boundary: ${name}`, { cause: error }); }
}
function noStore(result) {
  assert.equal(result.headers['cache-control'], 'private, no-store');
  assert.equal(result.headers['cdn-cache-control'], 'no-store');
  assert.equal(result.headers['vercel-cdn-cache-control'], 'no-store');
}
function cleanHold(result, status = 503) {
  assert.equal(result.status, status); noStore(result);
  assert.doesNotMatch(JSON.stringify(result), /VISIBLE_TITLE|HIDDEN_SENTINEL|SECRET_SENTINEL|cpi-august-preview/);
}

await check('stable recorded response is dispatched with exact byte length and fresh reread', async () => {
  const env = fixture(); await httpTest(env, async (send, tasks) => {
    const result = await send(); assert.equal(result.status, 200); assert.match(result.body, /VISIBLE_TITLE_BODY/);
    assert.equal(Number(result.headers['content-length']), Buffer.byteLength(result.body)); noStore(result);
    assert.equal(env.stats.authority, 4); assert.equal(env.stats.history, 2);
    assert.equal((await tasks[0]).decision, 'DISPATCHED_RECORDED_RESPONSE');
    assert.equal((await tasks[0]).publicationAuthorized, false);
  });
});
for (const time of [end - 1, end, end + 1]) {
  await check(`never-admitted article holds at ${time}`, async () => {
    const env = fixture({ time, state: null }); await httpTest(env, async (send) => cleanHold(await send(), 404));
    assert.equal(env.stats.renders, 0);
  });
}
for (const state of ['pending', 'revoked', 'preflight-passed']) {
  await check(`nonadmitted state ${state} never reaches the renderer`, async () => {
    const env = fixture({ state }); await httpTest(env, async (send) => cleanHold(await send(), 404)); assert.equal(env.stats.renders, 0);
  });
}
await check('recorded expired article is served as archive', async () => {
  const env = fixture({ time: end }); await httpTest(env, async (send) => {
    const result = await send(); assert.equal(result.status, 200); assert.match(result.body, /"publicationPresentation":"archive"/);
  });
});
for (const surface of ['homepage', 'news-current', 'feed', 'latest-json']) {
  await check(`expired current output is filtered on ${surface}`, async () => {
    const env = fixture({ time: end, surface }); await httpTest(env, async (send) => {
      const result = await send(); assert.equal(result.status, 200); assert.equal(result.body, '{"items":[]}'); noStore(result);
    });
  });
}
for (const surface of ['news-archive', 'sitemap']) {
  await check(`recorded archives stay on ${surface}`, async () => {
    const env = fixture({ time: end, surface }); await httpTest(env, async (send) => {
      const result = await send(); assert.equal(result.status, 200); assert.match(result.body, /VISIBLE_TITLE_BODY/);
    });
  });
}
await check('held content never reaches a mixed aggregate renderer', async () => {
  const env = fixture({ mixed: true, surface: 'homepage' }); const original = env.options.render;
  env.options.render = async (view, options) => { assert.doesNotMatch(JSON.stringify(view), /HIDDEN_SENTINEL|hidden-item/);
    assert(Object.isFrozen(view.items)); assert(Object.isFrozen(view.items[0])); return original(view, options); };
  await httpTest(env, async (send) => { const result = await send(); assert.equal(result.status, 200);
    assert.match(result.body, /VISIBLE_TITLE/); assert.doesNotMatch(result.body, /HIDDEN_SENTINEL/); });
});
for (const surface of ['homepage', 'news-current', 'feed', 'latest-json']) {
  await check(`render crossing expiry discards stale bytes on ${surface}`, async () => {
    const env = fixture({ surface });
    env.options.render = async (view) => { env.stats.renders++; const text = JSON.stringify(view); await Promise.resolve(); env.advance(end); return text; };
    await httpTest(env, async (send) => { const result = await send(); assert.equal(result.status, 200);
      assert.equal(result.body, '{"items":[]}'); assert.equal(env.stats.renders, 2); });
  });
}
await check('article presentation is rerendered as archive if deadline crosses', async () => {
  const env = fixture(); env.options.render = async (view) => {
    env.stats.renders++; const output = JSON.stringify(view); await Promise.resolve(); env.advance(end); return output;
  };
  await httpTest(env, async (send) => { const result = await send(); assert.equal(result.status, 200);
    assert.match(result.body, /"publicationPresentation":"archive"/); assert.doesNotMatch(result.body, /"publicationPresentation":"current"/); });
});
for (const patch of [{ historyRevision: 'history2' }, { deploymentId: 'dpl_changedfixture' },
  { commitSha: 'f'.repeat(40) }, { artifactSha256: 'f'.repeat(64) }]) {
  await check(`authority drift after buffered render holds ${Object.keys(patch)[0]}`, async () => {
    const env = fixture(); env.options.render = async (view) => { Object.assign(env.authority, patch); return JSON.stringify(view); };
    await httpTest(env, async (send) => cleanHold(await send()));
  });
}
await check('history revocation during render discards the buffered article', async () => {
  const env = fixture(); env.options.render = async (view) => { env.records[0].record.state = 'revoked'; return JSON.stringify(view); };
  await httpTest(env, async (send) => cleanHold(await send(), 404));
});
await check('authority failure after render discards buffered bytes', async () => {
  const env = fixture(); const original = env.options.loadAuthority;
  env.options.loadAuthority = async (args) => { if (env.stats.authority >= 2) throw new Error('SECRET_SENTINEL'); return original(args); };
  await httpTest(env, async (send) => cleanHold(await send()));
});
await check('expired authority after render cannot be renewed for old bytes', async () => {
  const env = fixture(); env.options.render = async (view) => { env.advance(end + 20_000); return JSON.stringify(view); };
  await httpTest(env, async (send) => cleanHold(await send()));
});
await check('renderer exceptions and invented internal error fields are sanitized', async () => {
  const env = fixture(); env.options.render = () => { const e = new Error('SECRET_SENTINEL'); e.boundaryCode = 'SECRET_SENTINEL'; e.httpStatus = 404; throw e; };
  await httpTest(env, async (send, tasks) => { cleanHold(await send()); assert.doesNotMatch(JSON.stringify(await tasks[0]), /SECRET_SENTINEL/); });
});
for (const value of [Buffer.from('SECRET_SENTINEL'), new Response('SECRET_SENTINEL'), Readable.from(['SECRET_SENTINEL']), { body: 'SECRET_SENTINEL' }, 'x'.repeat(1_000_001)]) {
  await check(`unbounded or streaming renderer rejected ${typeof value}:${value.constructor.name}`, async () => {
    const env = fixture(); env.options.render = async () => value; await httpTest(env, async (send) => cleanHold(await send()));
  });
}
await check('HEAD performs eligibility rereads without a body or render', async () => {
  const env = fixture(); await httpTest(env, async (send) => {
    const result = await send({ method: 'HEAD' }); assert.equal(result.status, 200); assert.equal(result.body, ''); noStore(result);
    assert.equal(env.stats.renders, 0); assert.equal(env.stats.authority, 4);
  });
});
await check('HEAD on held article does not disclose a body', async () => {
  const env = fixture({ state: null }); await httpTest(env, async (send) => { const result = await send({ method: 'HEAD' }); cleanHold(result, 404); assert.equal(result.body, ''); });
});
for (const method of ['POST', 'PUT', 'OPTIONS', 'TRACE']) {
  await check(`method ${method} rejects without reading authority`, async () => {
    const env = fixture(); await httpTest(env, async (send) => { const result = await send({ method }); cleanHold(result, 405); assert.equal(result.headers.allow, 'GET, HEAD'); });
    assert.equal(env.stats.sources, 0);
  });
}
for (const path of [route + '/', route + '.html', route + '/index.html', '/news/catalysts/%63pi-august-preview', '//example.test' + route]) {
  await check(`unregistered path ${path} rejects before reading sources`, async () => {
    const env = fixture(); await httpTest(env, async (send) => cleanHold(await send({ path }), 404)); assert.equal(env.stats.sources, 0);
  });
}
await check('query and client Host headers do not grant private-preview authority', async () => {
  const env = fixture(); env.authority.exposure = 'private-preview';
  await httpTest(env, async (send) => cleanHold(await send({ path: route + '?surface=archive&verified=true&now=0',
    headers: { Host: 'www.usd-impact.com', 'X-Forwarded-Host': 'www.usd-impact.com', 'X-Verified': 'true' } })));
});
for (const state of ['admitted', null]) {
  await check(`queued headers cannot leak content or change caching (${state})`, async () => {
    const env = fixture({ state }); await httpTest(env, async (send) => {
      const result = await send({ headers: { 'If-None-Match': 'old-value', Range: 'bytes=0-10' } });
      assert.equal(result.status, state ? 200 : 404); noStore(result);
      assert.doesNotMatch(JSON.stringify(result.headers), /SECRET_SENTINEL|old-value/);
      for (const name of ['etag', 'last-modified', 'link', 'set-cookie', 'location', 'content-range']) assert.equal(result.headers[name], undefined);
    }, { before: (_, res) => { for (const name of ['ETag', 'Last-Modified', 'Link', 'Set-Cookie', 'Location', 'Content-Range', 'X-Old-Title']) res.setHeader(name, 'SECRET_SENTINEL'); res.setHeader('Cache-Control', 'public, max-age=900'); } });
  });
}
await check('concurrent invocation on the same response is refused', async () => {
  const env = fixture(); await httpTest(env, async (send, tasks) => { const result = await send(); assert.equal(result.status, 200);
    assert.equal((await tasks[1]).decision, 'HOLD_RESPONSE_ALREADY_CLAIMED'); assert.equal(env.stats.sources, 1); }, { duplicate: true });
});
await check('independent concurrent requests do not share inspection tickets', async () => {
  const env = fixture(); await httpTest(env, async (send) => { const results = await Promise.all([send(), send(), send()]);
    assert(results.every((result) => result.status === 200)); });
});
for (const stage of ['loadSources', 'loadAuthority', 'readHistory', 'render']) {
  await check(`timeout in ${stage} cannot later dispatch buffered bytes`, async () => {
    const env = fixture(); const gate = deferred(); const original = env.options[stage]; env.options.timeoutMs = 30;
    env.options[stage] = async (...args) => { await gate.promise; return original(...args); };
    await httpTest(env, async (send, tasks) => { const result = await send(); cleanHold(result);
      assert.equal((await tasks[0]).decision, 'HOLD_PREPARATION_TIMEOUT'); gate.resolve();
      await new Promise((resolve) => setImmediate(resolve)); });
  });
}
await check('caller source-array mutation during render cannot replace the snapshot', async () => {
  const env = fixture(); env.options.render = async (view) => { env.sources[0] = article(route, 'HIDDEN_SENTINEL'); return JSON.stringify(view); };
  await httpTest(env, async (send) => { const result = await send(); assert.equal(result.status, 200);
    assert.match(result.body, /VISIBLE_TITLE/); assert.doesNotMatch(result.body, /HIDDEN_SENTINEL/); });
});
await check('missing server adapters deny rather than choosing a provider', async () => {
  const env = fixture(); delete env.options.readHistory; await httpTest(env, async (send) => cleanHold(await send()));
});
await check('a non-native response cannot be used to bypass dispatch checks', async () => {
  const handler = createRecordedPublicationHandler(fixture().options);
  const result = await handler({}, { writeHead: () => assert.fail('must not call'), end: () => assert.fail('must not call') });
  assert.equal(result.decision, 'HOLD_RESPONSE_UNSUPPORTED'); assert.equal(result.responseDispatched, false);
});

await check('deadline crossing at the last synchronous projection discards bytes', async () => {
  const env = fixture({ surface: 'homepage' });
  let finalClockReads = 0;
  env.options.now = () => env.stats.authority >= 4 && ++finalClockReads >= 5 ? end : end - 1;
  await httpTest(env, async (send) => cleanHold(await send()));
});
await check('client disconnect cancels preparation and prevents subsequent reads', async () => {
  const env = fixture(); const started = deferred(); const gate = deferred(); let signal;
  env.options.render = async (view, options) => { signal = options.signal; started.resolve(); await gate.promise; return JSON.stringify(view); };
  await httpTest(env, async (send, tasks) => {
    let req; const result = send({ onRequest: (value) => { req = value; } });
    await started.promise; req.destroy(); await assert.rejects(result);
    const outcome = await tasks[0]; assert.equal(outcome.decision, 'HOLD_RESPONSE_UNAVAILABLE');
    assert.equal(outcome.responseDispatched, false); assert.equal(signal.aborted, true);
    gate.resolve(); await new Promise((resolve) => setImmediate(resolve)); assert.equal(env.stats.authority, 2);
  });
});
await check('already flushed response is rejected without claiming prior bytes were safe', async () => {
  const env = fixture(); await httpTest(env, async (send, tasks) => {
    await assert.rejects(send()); const result = await tasks[0];
    assert.equal(result.decision, 'HOLD_RESPONSE_ALREADY_STARTED'); assert.equal(result.headersAlreadySent, true);
    assert.equal(result.responseDispatched, false); assert.equal(env.stats.sources, 0);
  }, { before: (_, res) => res.flushHeaders() });
});
await check('invalid surface configuration fails closed before reading sources', async () => {
  const env = fixture(); env.options.surface = 'unknown';
  await httpTest(env, async (send) => cleanHold(await send())); assert.equal(env.stats.sources, 0);
});

console.log(`Publication response boundary: ${groups} regression groups passed (real loopback HTTP; mocked clock/authority/history; no live Vercel routing or admission).`);
