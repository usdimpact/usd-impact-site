import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  SOURCE_DATE_BASIS, isLivingSourceUrl, sourceDateBasisForUrl, sourceDateAttributionIssue,
} from '../src/lib/source-date-basis.js';
import { SOURCE_DATE_RULES, normalizeBundleDraft, safeValidationDiagnostic } from '../api/daily-news-validation.js';

// Synthetic regression fixtures only. No source URL below is fetched, no provider
// request leaves this process, and importer writes are confined to a temporary cwd.
let checks = 0;
function check(label, fn) { fn(); checks += 1; }
const fedIndex = 'https://www.federalreserve.gov/newsevents.htm';
const blsIndex = 'https://www.bls.gov/schedule/2026/home.htm';
const blocked = [
  fedIndex, blsIndex,
  'https://www.federalreserve.gov/recentpostings.htm',
  'https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding/most-recent-quarterly-refunding-documents',
  'https://home.treasury.gov/system/files/221/Tentative-Auction-Schedule.pdf',
  'https://www.eia.gov/petroleum/supply/weekly/pdf/wpsrall.pdf',
];
for (const base of [fedIndex, blsIndex]) {
  for (const url of [
    base, `${base}/`, `${base}//`, `${base}?utm_source=fixture#section`,
    base.replace('www.', '').replace('.gov/', '.gov./'),
    base.replace('.gov/', '.GOV/'),
    base.replace('newsevents', '%6eewsevents').replace('/home.', '/%68ome.'),
  ]) check(`index variant ${url}`, () => {
    assert.equal(sourceDateBasisForUrl(url), SOURCE_DATE_BASIS.DOCUMENT_INDEX);
    assert.equal(isLivingSourceUrl(url), false, 'No historical-date exemption');
    assert.ok(sourceDateAttributionIssue(url));
    assert.equal(safeValidationDiagnostic(sourceDateAttributionIssue(url)).code, 'invalid-source-date');
  });
}
for (const url of [
  'https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm',
  'https://www.bls.gov/news.release/archives/cpi_09112026.htm',
  'https://www.bls.gov/schedule/2026/10_sched.htm',
  'https://www.bls.gov/schedule/2026/10_sched_list.htm',
  'https://www.eia.gov/petroleum/supply/weekly/archive/2026/2026_09_10/',
  'https://home.treasury.gov/news/press-releases/sb0607',
  'https://www.federalreserve.gov.example.org/newsevents.htm',
  'https://www.bls.gov.example.org/schedule/2026/home.htm',
  'https://example.org/?url=' + encodeURIComponent(fedIndex),
]) check(`unchanged immutable classification ${url}`, () => {
  assert.equal(sourceDateBasisForUrl(url), SOURCE_DATE_BASIS.PUBLISHED);
  assert.equal(sourceDateAttributionIssue(url), null);
  assert.equal(isLivingSourceUrl(url), false);
});
for (const url of blocked.slice(2)) check(`existing safeguard ${url}`, () => {
  assert.ok(sourceDateAttributionIssue(url));
  assert.equal(isLivingSourceUrl(url), false);
});
check('supported living calendars unchanged', () => {
  assert.equal(sourceDateBasisForUrl('https://www.federalreserve.gov/newsevents/2026-october.htm'), SOURCE_DATE_BASIS.LAST_UPDATED);
  assert.equal(sourceDateBasisForUrl('https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'), SOURCE_DATE_BASIS.LAST_UPDATED);
});
check('discovery instructions distinguish document dates', () => {
  assert.match(SOURCE_DATE_RULES, /News and Events page \(newsevents\.htm\)/);
  assert.match(SOURCE_DATE_RULES, /BLS annual release calendar/);
  assert.match(SOURCE_DATE_RULES, /month-specific schedule URL/);
  assert.match(SOURCE_DATE_RULES, /Verify each economic event date separately/);
});
check('normalization cannot cure an index by rewriting its date', () => {
  for (const publishedAt of ['2026-07-16', '2026-09-04', '2026-10-22']) {
    const input = { sources: [{ id: 'fed-index', url: fedIndex, publishedAt }], highlights: [{ sourceIds: ['fed-index'] }], catalysts: [] };
    const normalized = normalizeBundleDraft(input);
    assert.equal(normalized.sources[0].publishedAt, publishedAt);
    assert.ok(sourceDateAttributionIssue(normalized.sources[0].url));
  }
});
check('diagnostics never echo arbitrary failure suffixes', () => {
  for (const url of [fedIndex, blsIndex]) {
    const result = safeValidationDiagnostic(`${sourceDateAttributionIssue(url)} synthetic-private-detail`);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-private-detail/);
  }
});

if (!process.argv.includes('--pure')) {
  const { validateEditorialBundle } = await import('../src/lib/daily-news-editorial-validation.js');
  const { default: handler, collectRepairEvidence, assessBoundedRepairFeasibility } = await import('../api/daily-news-background.js');
  const edition = '2026-10-22';
  const goodUrls = [
    'https://www.federalreserve.gov/newsevents/pressreleases/synthetic20261022a.htm',
    'https://home.treasury.gov/news/press-releases/synthetic20261022',
    'https://www.bls.gov/news.release/archives/synthetic_10222026.htm',
  ];
  const metadataOnly = 'https://www.bea.gov/news/2026/synthetic-not-in-ledger';
  function draft(urls = goodUrls) {
    return {
      marketRegime: 'Synthetic test fixture, not market information',
      summary: 'Three synthetic official-document developments for regression testing.',
      highlights: urls.map((url, i) => ({
        headline: `Synthetic document ${i + 1}`,
        development: 'This fixture tests source validation, not economic facts.',
        whyItMatters: 'Source attribution must remain traceable.',
        assets: ['USD'], importance: 'low', sourceIds: [`source-${i + 1}`],
      })),
      catalysts: [],
      sources: urls.map((url, i) => ({ id: `source-${i + 1}`, title: `Synthetic document ${i + 1}`, url, publishedAt: edition })),
      body: 'Synthetic regression fixture. No market claim is made.',
    };
  }
  function provider(candidate, metadata = [...candidate.sources.map(s => s.url), metadataOnly], id = 'resp_synthetic_boundary') {
    return { id, status: 'completed', output: [
      { type: 'web_search_call', action: { sources: metadata.map(url => ({ url })) } },
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(candidate), annotations: [] }] },
    ] };
  }
  function repairProvider(candidate, id) {
    return { id, status: 'completed', output: [
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(candidate), annotations: [] }] },
    ] };
  }
  for (const url of blocked) check(`server rejects index/pointer ${url}`, () => {
    const candidate = draft([goodUrls[0], goodUrls[1], url]);
    const before = structuredClone(candidate);
    assert.throws(() => validateEditorialBundle({ ...candidate, editionDate: edition }), /index|rolling report|mutable document pointer|annual release calendar/);
    const evidence = collectRepairEvidence(provider(candidate), edition);
    assert.deepEqual(evidence.permittedSourceUrls, goodUrls.slice(0, 2));
    assert.match(evidence.issues.join('; '), /Ineligible index or rolling-pointer source ids/);
    assert.equal(
      assessBoundedRepairFeasibility(provider(candidate), edition).canRepair,
      true,
      'a blocked pointer is excluded, while the stored response may still contain three eligible repair URLs',
    );
    assert.deepEqual(candidate, before);
  });
  check('three eligible original URLs are sufficient, extra metadata is not introduced', () => {
    const response = provider(draft([...goodUrls, fedIndex]));
    const evidence = collectRepairEvidence(response, edition);
    assert.deepEqual(evidence.permittedSourceUrls, goodUrls);
    assert.equal(assessBoundedRepairFeasibility(response, edition).canRepair, true);
    assert.equal(new Set(evidence.permittedSourceUrls).has(metadataOnly), false);
  });
  check('duplicate metadata does not pad eligible source count', () => {
    const candidate = draft([goodUrls[0], goodUrls[0], fedIndex]);
    assert.equal(assessBoundedRepairFeasibility(provider(candidate), edition).canRepair, false);
  });

  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const keys = ['NEWSFEED_BEARER_TOKEN', 'OPENAI_API_KEY', 'OPENAI_NEWS_MODEL'];
  const previous = new Map(keys.map(key => [key, process.env[key]]));
  async function invoke(candidate, repaired = null) {
    const calls = [];
    let repairAttempt = 0;
    globalThis.fetch = async (input, options = {}) => {
      const url = String(input);
      const method = String(options.method || 'GET');
      calls.push({ url, method, body: options.body ? JSON.parse(options.body) : null });
      if (method === 'GET' && url === 'https://api.openai.com/v1/responses/resp_synthetic_boundary') {
        return new Response(JSON.stringify(provider(candidate)), { status: 200 });
      }
      if (method === 'POST' && url === 'https://api.openai.com/v1/responses' && repaired) {
        repairAttempt += 1;
        return new Response(JSON.stringify(repairProvider(repaired, `resp_synthetic_repair_${repairAttempt}`)), { status: 200 });
      }
      throw new Error('Unexpected fetch blocked by synthetic regression test');
    };
    const response = { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } };
    await handler({ method: 'GET', headers: {
      authorization: 'Bearer synthetic-endpoint-token',
      'x-usd-impact-edition-date': edition,
      'x-usd-impact-response-id': 'resp_synthetic_boundary',
    } }, response);
    return { ...response, json: JSON.parse(response.body), calls };
  }
  let normalized;
  try {
    process.env.NEWSFEED_BEARER_TOKEN = 'synthetic-endpoint-token';
    process.env.OPENAI_API_KEY = 'synthetic-test-only';
    process.env.OPENAI_NEWS_MODEL = 'synthetic-no-network';
    console.error = () => {};
    for (const url of blocked) {
      const corrected = draft([goodUrls[0], goodUrls[1], metadataOnly]);
      const result = await invoke(draft([goodUrls[0], goodUrls[1], url]), corrected);
      check(`stored context repairs blocked third source without fresh search ${url}`, () => {
        assert.equal(result.statusCode, 200);
        const posts = result.calls.filter(call => call.method === 'POST');
        assert.equal(posts.length, 1);
        const request = posts[0].body;
        assert.equal(request.previous_response_id, 'resp_synthetic_boundary');
        assert.equal('tools' in request, false);
        assert.deepEqual(
          request.text.format.schema.properties.sources.items.properties.url.enum,
          [goodUrls[0], goodUrls[1], metadataOnly],
        );
        assert.equal(request.text.format.schema.properties.sources.items.properties.url.enum.includes(url), false);
        assert.equal(result.headers['X-USD-Impact-Repair-Count'], '1');
        assert.equal(result.json.sources.some(source => source.url === url), false);
      });
    }
    const good = await invoke(draft());
    check('valid three-source response passes without repair', () => {
      assert.equal(good.statusCode, 200);
      assert.equal(good.calls.length, 1);
      assert.equal(good.headers['X-USD-Impact-Repaired'], 'false');
      assert.equal(good.json.sources.length, 3);
      assert.equal(good.json.highlights.length, 3);
    });
    normalized = good.json;
    const repaired = await invoke(draft([...goodUrls, fedIndex]), draft());
    check('eligible bounded repair prompt and schema use exact stored grounded-context URLs', () => {
      assert.equal(repaired.statusCode, 200);
      const posts = repaired.calls.filter(call => call.method === 'POST');
      assert.equal(posts.length, 1);
      const request = posts[0].body;
      const permitText = request.input.split('PERMITTED GROUNDED CONTEXT URLS:\n')[1].split('\n\nORIGINAL BUNDLE:')[0];
      assert.deepEqual(JSON.parse(permitText), [...goodUrls, metadataOnly]);
      assert.deepEqual(
        request.text.format.schema.properties.sources.items.properties.url.enum,
        [...goodUrls, metadataOnly],
      );
      assert.equal(request.previous_response_id, 'resp_synthetic_boundary');
      assert.equal('tools' in request, false);
      assert.equal(repaired.headers['X-USD-Impact-Repair-Count'], '1');
    });
    const bad = draft([...goodUrls, fedIndex]);
    const exhausted = await invoke(bad, bad);
    check('repeated invalid repair remains bounded to two attempts on the original stored context', () => {
      assert.equal(exhausted.statusCode, 502);
      assert.equal(exhausted.json.repairAttempts, 2);
      const posts = exhausted.calls.filter(call => call.method === 'POST');
      assert.equal(posts.length, 2);
      assert.deepEqual(
        posts.map(call => call.body.previous_response_id),
        ['resp_synthetic_boundary', 'resp_synthetic_boundary'],
        'repair #2 must not chain to repair #1 because repair outputs are store:false',
      );
      assert.ok(posts.every(call => call.body.store === false), 'bounded repair outputs must remain non-persistent');
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  const scratch = await mkdtemp(path.join(tmpdir(), 'daily-source-index-'));
  const importer = fileURLToPath(new URL('./import-daily-news.mjs', import.meta.url));
  try {
    const news = path.join(scratch, 'src/content/news');
    await mkdir(news, { recursive: true });
    const archive = path.join(news, '2026-07-16.md');
    const sentinel = `sources:\n  - id: "fed-index-july"\n    url: "${fedIndex}"\n    publishedAt: "2026-07-16"\n  - id: "fed-index-september"\n    url: "${fedIndex}"\n    publishedAt: "2026-09-04"\n`;
    await writeFile(archive, sentinel);
    const input = path.join(scratch, 'candidate.json');
    const target = path.join(news, `${edition}.md`);
    for (const url of [fedIndex, blsIndex]) {
      const candidate = structuredClone(normalized);
      candidate.sources[2].url = url;
      await writeFile(input, JSON.stringify(candidate));
      const result = spawnSync(process.execPath, [importer, input, '--publish'], { cwd: scratch, encoding: 'utf8' });
      check('import rejects the index before any new article write', () => {
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /directly linked dated document|annual release calendar/);
      });
      await assert.rejects(readFile(target), { code: 'ENOENT' });
      assert.equal(await readFile(archive, 'utf8'), sentinel);
    }
    await writeFile(input, JSON.stringify(normalized));
    const imported = spawnSync(process.execPath, [importer, input, '--publish'], { cwd: scratch, encoding: 'utf8' });
    check('actual importer accepts the validated dated-document fixture', () => assert.equal(imported.status, 0, imported.stderr));
    const publishedBytes = await readFile(target, 'utf8');
    const skipped = spawnSync(process.execPath, [importer, input, '--publish', '--replace', '--skip-published'], { cwd: scratch, encoding: 'utf8' });
    check('published-edition duplicate guard remains intact', () => {
      assert.equal(skipped.status, 0, skipped.stderr);
      assert.match(skipped.stdout, /already exists/);
    });
    assert.equal(await readFile(target, 'utf8'), publishedBytes);
    assert.equal(await readFile(archive, 'utf8'), sentinel);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
console.log(`Daily source-index boundary PASS: ${checks} test groups; ${process.argv.includes('--pure') ? 'pure classification/diagnostic subset' : 'mocked handler and temporary importer included'}; no external requests.`);
