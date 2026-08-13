import assert from 'node:assert/strict';
import { collectVercelReleaseAudit } from './collect-vercel-release-audit.mjs';

const productionVars = [
  ['SUPABASE_URL', 'secret-url'],
  ['SUPABASE_PUBLISHABLE_KEY', 'secret-publishable'],
  ['SUPABASE_SECRET_KEY', 'secret-service'],
  ['PADDLE_WEBHOOK_SECRET', 'secret-webhook'],
  ['PADDLE_ENVIRONMENT', 'production'],
  ['PADDLE_API_KEY', 'secret-api'],
  ['PADDLE_LAUNCH_PRICE_ID', 'pri_launch'],
  ['PADDLE_STANDARD_PRICE_ID', 'pri_standard'],
  ['PUBLIC_PADDLE_CLIENT_TOKEN', 'secret-client'],
  ['PADDLE_CHECKOUT_URL', 'https://www.usd-impact.com/checkout/'],
  ['PADDLE_CHECKOUT_ENABLED', 'false'],
].map(([key, value]) => ({ key, value, target: ['production'] }));

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(envs = productionVars, options = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    assert.equal(init.method, 'GET', 'collector must use GET only');
    assert.ok(String(init.headers?.Authorization ?? '').startsWith('Bearer '), 'collector must authenticate');
    assert.ok(url.includes('teamId=team_1LuMlacGuM198mRjoID4O3Ct'), 'collector must bind expected team');

    if (options.failProject && url.includes('/v9/projects/prj_') && !url.includes('/env')) {
      return new Response('unauthorized', { status: 401 });
    }
    if (url.includes('/env?')) return response({ envs });
    return response({ id: 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7', name: 'usd-impact-site' });
  };
  return { fetchImpl, calls };
}

const observedAt = '2026-08-13T01:30:00.000Z';

{
  const { fetchImpl, calls } = mockFetch();
  const snapshot = await collectVercelReleaseAudit({ token: 'vercel-test-token', fetchImpl, observedAt });
  assert.equal(snapshot.authenticated, true);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.valuesExposed, false);
  assert.equal(snapshot.project.id, 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7');
  assert.equal(calls.length, 2);
  assert.equal(snapshot.environmentVariables.find((entry) => entry.key === 'PADDLE_CHECKOUT_ENABLED')?.state, 'closed');
  assert.ok(snapshot.environmentVariables.every((entry) => !Object.hasOwn(entry, 'value')), 'collector must redact all values');
  const serialized = JSON.stringify(snapshot);
  for (const [, secret] of productionVars) {
    if (secret === 'false') continue;
    assert.equal(serialized.includes(secret), false, `snapshot leaked value ${secret}`);
  }
}

{
  const missingCheckout = productionVars.filter((entry) => entry.key !== 'PADDLE_CHECKOUT_ENABLED');
  const { fetchImpl } = mockFetch(missingCheckout);
  await assert.rejects(
    () => collectVercelReleaseAudit({ token: 'vercel-test-token', fetchImpl, observedAt }),
    /PADDLE_CHECKOUT_ENABLED is missing/,
  );
}

{
  const openCheckout = productionVars.map((entry) =>
    entry.key === 'PADDLE_CHECKOUT_ENABLED' ? { ...entry, value: 'true' } : entry,
  );
  const { fetchImpl } = mockFetch(openCheckout);
  await assert.rejects(
    () => collectVercelReleaseAudit({ token: 'vercel-test-token', fetchImpl, observedAt }),
    /Production checkout is not proven CLOSED/,
  );
}

{
  const { fetchImpl } = mockFetch(productionVars, { failProject: true });
  await assert.rejects(
    () => collectVercelReleaseAudit({ token: 'vercel-test-token', fetchImpl, observedAt }),
    /HTTP 401/,
  );
}

{
  await assert.rejects(
    () => collectVercelReleaseAudit({ token: '', fetchImpl: async () => response({}), observedAt }),
    /VERCEL_TOKEN is required/,
  );
}

console.log('Vercel release audit collector tests passed');
