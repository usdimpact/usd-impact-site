import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rewrite } from '@vercel/functions';
import {
  PUBLICATION_PUBLIC_ROUTE_WIRING,
  planPublicationPublicRouteRequest,
  publicationPublicRouteWiringPlan,
} from '../src/lib/publication-public-route-wiring.js';
import {
  PUBLICATION_ROUTE_HEADERS,
  verifyDormantPreviewRouteEnvelope,
} from '../src/lib/publication-route-candidate.js';

const deploymentHost = 'usd-impact-site-preview-fixture-usd-impact.vercel.app';
const issuedAt = Date.parse('2026-09-15T00:15:00.000Z');
const environment = Object.freeze({
  PUBLICATION_GUARD_PUBLIC_ROUTE_WIRING: 'preview-dormant-v1',
  PUBLICATION_GUARD_ROUTE_CANDIDATE: 'preview-dormant',
  PUBLICATION_GUARD_ROUTE_SECRET: 'fixture-public-route-wiring-secret-558-minimum',
  VERCEL: '1',
  VERCEL_ENV: 'preview',
  VERCEL_TARGET_ENV: 'preview',
  VERCEL_PROJECT_ID: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7',
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'usdimpact',
  VERCEL_GIT_REPO_SLUG: 'usd-impact-site',
  VERCEL_GIT_COMMIT_REF: 'publishing/558-calendar-validation',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_URL: deploymentHost,
});

const requestFor = (requestPath, { method = 'GET', host = deploymentHost, headers = {} } = {}) => new Request(
  `https://${host}${requestPath}`,
  { method, headers: { host, ...headers } },
);

let groups = 0;
const check = async (name, operation) => {
  try {
    await operation();
    groups += 1;
  } catch (error) {
    throw new Error(`Publication public-route wiring regression: ${name}`, { cause: error });
  }
};

await check('plan is inactive by default and Production activation remains unimplemented', () => {
  const plan = publicationPublicRouteWiringPlan();
  assert.equal(plan.schema, 'publication-public-route-wiring/v1');
  assert.equal(plan.activeByDefault, false);
  assert.equal(plan.approvedMode, 'preview-dormant-v1');
  assert.equal(plan.internalPath, '/api/publication-guard');
  assert.equal(plan.productionActivation, 'not-implemented');
  assert.equal(plan.publicationAuthorized, false);
  assert.equal(plan.enforcementActive, false);
});

await check('unset mode is strict fallthrough without secret or Vercel context', () => {
  const emptyEnvironment = {};
  for (const requestPath of ['/news', '/news/', '/news/2026-09-15', '/sitemap-0.xml/']) {
    const plan = planPublicationPublicRouteRequest({
      request: requestFor(requestPath),
      environment: emptyEnvironment,
      now: () => { throw new Error('inactive path must not read clock'); },
    });
    assert.equal(plan.action, 'continue');
    assert.equal(plan.decision, 'INACTIVE_FALLTHROUGH');
    assert.notEqual(plan.routeKind, 'unrelated');
  }
});

await check('unrelated routes always remain outside publication wiring', () => {
  const plan = planPublicationPublicRouteRequest({
    request: requestFor('/learn/real-yield'),
    environment,
    now: () => { throw new Error('unrelated path must not read clock'); },
  });
  assert.equal(plan.action, 'continue');
  assert.equal(plan.decision, 'UNRELATED_ROUTE');
  assert.equal(plan.routeKind, 'unrelated');
});

await check('active Preview canonical route becomes exact internal rewrite with query removed', () => {
  const plan = planPublicationPublicRouteRequest({
    request: requestFor('/news?client=ignored'),
    environment,
    now: () => issuedAt,
  });
  assert.equal(plan.action, 'rewrite');
  assert.equal(plan.path, '/news');
  assert.equal(plan.surface, 'news-composite');
  assert.equal(plan.destination, `https://${deploymentHost}/api/publication-guard`);
  assert.equal(plan.issuedAt, issuedAt);
  assert.equal(plan.publicationAuthorized, false);
  assert.equal(plan.enforcementActive, false);
});

await check('middleware planner overwrites forged publication envelope headers', () => {
  const forged = {
    [PUBLICATION_ROUTE_HEADERS.path]: '/news/2099-01-01',
    [PUBLICATION_ROUTE_HEADERS.issuedAt]: '1',
    [PUBLICATION_ROUTE_HEADERS.mac]: '0'.repeat(64),
  };
  const plan = planPublicationPublicRouteRequest({
    request: requestFor('/news', { headers: forged }),
    environment,
    now: () => issuedAt,
  });
  assert.equal(plan.action, 'rewrite');
  assert.equal(plan.requestHeaders.get(PUBLICATION_ROUTE_HEADERS.path), '/news');
  assert.equal(plan.requestHeaders.get(PUBLICATION_ROUTE_HEADERS.issuedAt), String(issuedAt));
  assert.notEqual(plan.requestHeaders.get(PUBLICATION_ROUTE_HEADERS.mac), forged[PUBLICATION_ROUTE_HEADERS.mac]);
  const verified = verifyDormantPreviewRouteEnvelope({
    request: new Request(`https://${deploymentHost}/api/publication-guard`, {
      method: 'GET',
      headers: plan.requestHeaders,
    }),
    environment,
    secret: environment.PUBLICATION_GUARD_ROUTE_SECRET,
    now: () => issuedAt + 1,
  });
  assert.equal(verified.path, '/news');
  assert.equal(verified.surface, 'news-composite');
});

await check('installed Vercel rewrite helper forwards overridden signed request headers', () => {
  const plan = planPublicationPublicRouteRequest({
    request: requestFor('/news/latest.json'),
    environment,
    now: () => issuedAt,
  });
  const response = rewrite(new URL(plan.destination), { request: { headers: plan.requestHeaders } });
  assert.equal(response.headers.get('x-middleware-rewrite'), plan.destination);
  const overrides = (response.headers.get('x-middleware-override-headers') ?? '').split(',');
  for (const name of Object.values(PUBLICATION_ROUTE_HEADERS)) {
    assert.ok(overrides.includes(name));
    assert.equal(response.headers.get(`x-middleware-request-${name}`), plan.requestHeaders.get(name));
  }
});

await check('HEAD requests are signed and rewritten without method drift', () => {
  const plan = planPublicationPublicRouteRequest({
    request: requestFor('/news/feed.xml', { method: 'HEAD' }),
    environment,
    now: () => issuedAt,
  });
  assert.equal(plan.action, 'rewrite');
  const verified = verifyDormantPreviewRouteEnvelope({
    request: new Request(`https://${deploymentHost}/api/publication-guard`, {
      method: 'HEAD',
      headers: plan.requestHeaders,
    }),
    environment,
    secret: environment.PUBLICATION_GUARD_ROUTE_SECRET,
    now: () => issuedAt + 1,
  });
  assert.equal(verified.path, '/news/feed.xml');
  assert.equal(verified.surface, 'feed');
});

await check('active Preview raw static aliases fail closed before static render', () => {
  for (const requestPath of ['/index.html', '/news/', '/news/index.html', '/news/2026-09-15.html',
    '/news/2026-09-15/index.html', '/sitemap-0.xml/']) {
    const plan = planPublicationPublicRouteRequest({ request: requestFor(requestPath), environment, now: () => issuedAt });
    assert.equal(plan.action, 'deny');
    assert.equal(plan.status, 404);
    assert.equal(plan.decision, 'HOLD_PUBLIC_ROUTE_STATIC_ALIAS');
  }
});

await check('active Preview non-read methods fail closed with 405', () => {
  const plan = planPublicationPublicRouteRequest({
    request: requestFor('/news', { method: 'POST' }),
    environment,
    now: () => issuedAt,
  });
  assert.equal(plan.action, 'deny');
  assert.equal(plan.status, 405);
  assert.equal(plan.decision, 'HOLD_PUBLIC_ROUTE_METHOD');
});

await check('unknown active mode fails closed before route signing', () => {
  const plan = planPublicationPublicRouteRequest({
    request: requestFor('/news'),
    environment: { PUBLICATION_GUARD_PUBLIC_ROUTE_WIRING: 'unknown-mode' },
    now: () => { throw new Error('unknown mode must not read clock'); },
  });
  assert.equal(plan.action, 'deny');
  assert.equal(plan.status, 503);
  assert.equal(plan.decision, 'HOLD_PUBLIC_ROUTE_MODE');
});

await check('Production context cannot produce a public rewrite', () => {
  const productionEnvironment = {
    ...environment,
    VERCEL_ENV: 'production',
    VERCEL_TARGET_ENV: 'production',
    VERCEL_GIT_COMMIT_REF: 'main',
    VERCEL_URL: 'www.usd-impact.com',
  };
  const plan = planPublicationPublicRouteRequest({
    request: requestFor('/news', { host: 'www.usd-impact.com' }),
    environment: productionEnvironment,
    now: () => issuedAt,
  });
  assert.equal(plan.action, 'deny');
  assert.equal(plan.status, 503);
  assert.equal(plan.decision, 'HOLD_PUBLIC_ROUTE_PREVIEW_CONTEXT');
  assert.equal(plan.enforcementActive, false);
});

await check('repository wiring stays source-only and reuses the existing internal Function route', () => {
  const middleware = fs.readFileSync(path.resolve('middleware.js'), 'utf8');
  assert.match(middleware, /publication-public-route-wiring\.js/);
  for (const matcher of ["'/'", "'/index.html'", "'/news'", "'/news/:path*'", "'/sitemap-0.xml'", "'/sitemap-0.xml/:path*'"]) {
    assert.ok(middleware.includes(matcher));
  }
  assert.match(middleware, /rewrite\(new URL\(publicationPlan\.destination\)/);
  assert.match(middleware, /request:\s*\{\s*headers:\s*publicationPlan\.requestHeaders\s*\}/);
  assert.doesNotMatch(middleware, /publication-production-reader-database/);

  const vercel = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf8'));
  assert.ok(vercel.rewrites.some((entry) => entry.source === '/api/publication-guard'
    && entry.destination === '/api/daily-news-validation?publicationGuardRoute=1'));
  assert.equal(vercel.rewrites.some((entry) => ['/', '/news', '/sitemap-0.xml'].includes(entry.source)
    && entry.destination?.includes('/api/publication-guard')), false);
});

assert.equal(PUBLICATION_PUBLIC_ROUTE_WIRING.publicationAuthorized, false);
assert.equal(PUBLICATION_PUBLIC_ROUTE_WIRING.enforcementActive, false);
console.log(`publication public-route wiring tests pass (${groups} groups; source-only Preview wiring, inactive by default)`);
