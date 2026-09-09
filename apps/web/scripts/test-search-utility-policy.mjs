import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SEARCH_UTILITY_PATHS, isSearchUtilityPath } from '../src/lib/search-utility-policy.js';
import { PUBLIC_DISCOVERY_CONTROLS, robotsValues, sitemapPathSet, verifySearchUtilityBuild } from './verify-search-utility-build.mjs';

export function runSearchUtilityPolicyTests() {
  let groups = 0;
  const check = (fn) => { fn(); groups += 1; };
  const expected = ['/account', '/account/access-required', '/account/notifications', '/account/passkeys', '/account/sign-in', '/auth/confirm', '/auth/session-ready', '/checkout', '/research/access-required', '/research/account'];
  check(() => { assert.deepEqual([...SEARCH_UTILITY_PATHS], expected); assert.ok(Object.isFrozen(SEARCH_UTILITY_PATHS)); });
  check(() => {
    for (const route of expected) {
      for (const suffix of ['', '/', '///']) assert.equal(isSearchUtilityPath(route + suffix), true);
    }
  });
  check(() => {
    for (const route of expected) {
      const url = new URL(`https://www.usd-impact.com${route}/?next=%2Fguided-edition%2F&code=synthetic-test-only#retained`);
      const before = url.href;
      assert.equal(isSearchUtilityPath(url.pathname), true);
      assert.equal(url.href, before);
    }
  });
  check(() => {
    for (const route of [...PUBLIC_DISCOVERY_CONTROLS, '/accounting', '/accounts', '/research/accounting', '/account/sign-in/help', '/checkout-success', '/internal/ask-usd-impact']) {
      assert.equal(isSearchUtilityPath(route), false, route);
    }
  });
  check(() => {
    for (const value of [null, undefined, {}, '', 'account', '//account', 'https://www.usd-impact.com/account', '/account?next=x', '/account#x', '/account\\x']) {
      assert.equal(isSearchUtilityPath(value), false);
    }
  });
  const xmlFor = (routes) => `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((r) => `<url><loc>https://www.usd-impact.com${r === '/' ? '/' : r + '/'}</loc></url>`).join('')}</urlset>`;
  const html = (meta = '') => `<html><head>${meta}</head><body>Unchanged page</body></html>`;
  const noindex = '<meta name="robots" content="noindex, nofollow">';
  const fixture = () => new Map([
    ['sitemap-0.xml', xmlFor(PUBLIC_DISCOVERY_CONTROLS)],
    ...expected.map((r) => [`${r.slice(1)}/index.html`, html(noindex)]),
    ['index.html', html()], ['learn/real-yield/index.html', html()],
    ['learn/dxy-vs-broad-usd-what-each-index-answers/index.html', html()],
  ]);
  const verify = (map) => verifySearchUtilityBuild('/unused', (rel) => {
    assert.ok(map.has(rel), `Missing fixture: ${rel}`);
    return map.get(rel);
  });
  check(() => assert.deepEqual(verify(fixture()), []));
  check(() => {
    for (const route of expected) {
      const f = fixture(); f.set('sitemap-0.xml', xmlFor([...PUBLIC_DISCOVERY_CONTROLS, route]));
      assert.ok(verify(f).some((s) => s === `Search utility appears in sitemap: ${route}.`));
    }
  });
  check(() => {
    for (const route of expected) {
      const f = fixture(); f.set(`${route.slice(1)}/index.html`, html());
      assert.ok(verify(f).some((s) => s.includes(`directive: ${route}.`)));
    }
  });
  check(() => {
    for (const route of PUBLIC_DISCOVERY_CONTROLS) {
      const f = fixture(); f.set('sitemap-0.xml', xmlFor(PUBLIC_DISCOVERY_CONTROLS.filter((r) => r !== route)));
      assert.ok(verify(f).includes(`Public discovery control missing from sitemap: ${route}.`));
    }
  });
  check(() => {
    for (const meta of ['<!--' + noindex + '-->', '<script>' + JSON.stringify(noindex) + '</script>', '<meta name="description" content="noindex, nofollow">', noindex + noindex, '<meta name="robots" content="index, noindex, nofollow">']) {
      const f = fixture(); f.set('account/index.html', html(meta)); assert.ok(verify(f).length);
    }
  });
  check(() => {
    assert.deepEqual(robotsValues(html("<META CONTENT='NOFOLLOW, NOINDEX' NAME='ROBOTS'>")), ['nofollow, noindex']);
    assert.deepEqual(robotsValues('<html><head></head><body>' + noindex + '</body></html>'), []);
  });
  check(() => {
    for (const xml of ['', '<urlset></urlset>', '<urlset><url><loc>broken</loc></url></urlset>', xmlFor(PUBLIC_DISCOVERY_CONTROLS).replaceAll('https://www.usd-impact.com', 'https://example.invalid'), '<!DOCTYPE x>' + xmlFor(PUBLIC_DISCOVERY_CONTROLS)]) {
      assert.throws(() => sitemapPathSet(xml));
      const f = fixture(); f.set('sitemap-0.xml', xml); assert.ok(verify(f).length);
    }
  });
  check(() => { const f = fixture(); f.delete('account/index.html'); assert.ok(verify(f).includes('Search utility HTML missing: /account.')); });
  check(() => { const f = fixture(); f.set('learn/real-yield/index.html', html(noindex)); assert.ok(verify(f).includes('Public learning control unexpectedly noindex: /learn/real-yield.')); });
  check(() => { const f = fixture(); f.set('sitemap-0.xml', xmlFor(PUBLIC_DISCOVERY_CONTROLS).replace('</urlset>', '<!--<url><loc>https://www.usd-impact.com/account/</loc></url>--></urlset>')); assert.deepEqual(verify(f), []); });
  check(() => {
    // Masked blocks must not turn malformed markup into valid robots evidence.
    for (const block of ['<!-- seam -->', '<script>ignored</script>', '<style>ignored</style>']) {
      for (const meta of [
        `<me${block}ta name="robots" content="noindex, nofollow">`,
        `<meta name="ro${block}bots" content="noindex, nofollow">`,
        `<meta name="robots" content="noin${block}dex, nofollow">`,
      ]) {
        const f = fixture(); f.set('account/index.html', html(meta));
        assert.ok(verify(f).includes('Search utility needs one noindex, nofollow head directive: /account.'), meta);
      }
    }
    assert.deepEqual(robotsValues(`<html><he<!-- seam -->ad>${noindex}</head></html>`), []);
  });
  check(() => {
    const valid = xmlFor(PUBLIC_DISCOVERY_CONTROLS);
    for (const invalid of [
      valid.replaceAll('<url>', '<u<!-- seam -->rl>'),
      valid.replaceAll('<loc>', '<lo<!-- seam -->c>'),
      valid.replaceAll('www.usd-impact.com', 'www.usd-im<!-- seam -->pact.com'),
    ]) {
      assert.throws(() => sitemapPathSet(invalid));
      const f = fixture(); f.set('sitemap-0.xml', invalid);
      assert.ok(verify(f).includes('Search utility policy: sitemap could not be validated.'));
    }
    const f = fixture();
    f.set('sitemap-0.xml', valid.replace('/research/sample/', '/resea<!-- seam -->rch/sample/'));
    assert.ok(verify(f).includes('Public discovery control missing from sitemap: /research/sample.'));
  });
  check(() => {
    // Ordinary inert blocks between complete nodes still leave the directive intact.
    const inert = `<!--${noindex}--><script>${JSON.stringify(noindex)}</script><style>/* ${noindex} */</style>`;
    assert.deepEqual(robotsValues(html(inert + noindex + inert)), ['noindex, nofollow']);
    const f = fixture(); f.set('account/index.html', html(inert + noindex + inert));
    assert.deepEqual(verify(f), []);
  });
  console.log(`Search utility policy: ${groups} regression groups passed.`);
  return groups;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runSearchUtilityPolicyTests();
