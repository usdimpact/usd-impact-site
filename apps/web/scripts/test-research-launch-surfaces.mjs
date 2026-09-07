import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleResearchAccount } from '../api/research-account.js';

function responseRecorder() {
  return {
    statusCode: 200,
    headers: new Map(),
    body: '',
    setHeader(name, value) {
      this.headers.set(String(name).toLowerCase(), String(value));
    },
    end(value = '') {
      this.body += value == null ? '' : String(value);
    },
  };
}

function jsonBody(response) {
  return response.body ? JSON.parse(response.body) : {};
}

const activeState = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'research-qa@example.com',
  },
  profile: {
    status: 'active',
  },
  entitlement: {
    productId: 'research-membership',
    state: 'active',
    startsAt: '2026-09-01T00:00:00.000Z',
    endsAt: '2026-10-01T00:00:00.000Z',
  },
  allowed: true,
  reason: 'active',
};

let observedProductId = null;
const activeResponse = responseRecorder();
await handleResearchAccount(
  { method: 'GET', headers: {}, url: '/api/research-account' },
  activeResponse,
  {
    readAccountAccessState: async ({ productId }) => {
      observedProductId = productId;
      return activeState;
    },
    resolveSessionWithRefresh: async ({ verifyAccessToken }) => ({
      accessToken: 'access-token',
      value: await verifyAccessToken('access-token'),
    }),
  },
);
assert.equal(activeResponse.statusCode, 200);
assert.equal(observedProductId, 'research-membership');
const activeBody = jsonBody(activeResponse);
assert.equal(activeBody.researchAccess.allowed, true);
assert.equal(activeBody.researchAccess.productId, 'research-membership');
assert.equal(activeBody.researchAccess.state, 'active');
assert.equal(activeBody.researchAccess.endsAt, '2026-10-01T00:00:00.000Z');
assert.equal(activeBody.account.email, 'research-qa@example.com');

const signedOutResponse = responseRecorder();
await handleResearchAccount(
  { method: 'GET', headers: {}, url: '/api/research-account' },
  signedOutResponse,
  {
    readAccountAccessState: async () => activeState,
    resolveSessionWithRefresh: async () => null,
  },
);
assert.equal(signedOutResponse.statusCode, 401);
assert.equal(jsonBody(signedOutResponse).code, 'AUTHENTICATION_REQUIRED');

const methodResponse = responseRecorder();
await handleResearchAccount(
  { method: 'POST', headers: {}, url: '/api/research-account' },
  methodResponse,
  {},
);
assert.equal(methodResponse.statusCode, 405);
assert.equal(methodResponse.headers.get('allow'), 'GET');

const [landing, sample, account, accessRequired, previewGate, tradingViewRunbook] = await Promise.all([
  readFile(new URL('../src/pages/research/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/research/sample/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/research/account/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/research/access-required/index.astro', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/research-preview-route.js', import.meta.url), 'utf8'),
  readFile(new URL('../../../docs/operations/research-membership-tradingview-access-runbook.md', import.meta.url), 'utf8'),
]);

assert.match(landing, /USD 290\/year/);
assert.match(landing, /Best Value — save USD 58/);
assert.match(landing, /USD 29\/month/);
assert.match(landing, /No free trial and no introductory discount/);
assert.match(landing, /href="\/research\/sample\/"/);
assert.match(landing, /href="\/research\/account\/"/);
assert.match(landing, /checkout is not yet open/i);
assert.match(landing, /Library Pass resources remain a separate permanent product/);
assert.doesNotMatch(landing, /research-membership-checkout/);
assert.doesNotMatch(landing, /\/api\/commerce/);

assert.match(sample, /PUBLIC_SAMPLE_DATE = '2026-08-07'/);
assert.match(sample, /PUBLIC_SAMPLE_MIN_AGE_DAYS = 30/);
assert.match(sample, /getCollection\('weeklyReports'\)/);
assert.match(sample, /complete historical Weekly Report/i);
assert.match(sample, /contains no\s+private TradingView source or invite link/i);
assert.doesNotMatch(sample, /href="\/score\//);
assert.doesNotMatch(sample, /research-membership-checkout/);
assert.doesNotMatch(sample, /\/api\/commerce/);

assert.match(account, /fetch\('\/api\/research-account'/);
assert.match(account, /https:\/\/app\.lemonsqueezy\.com\/my-orders/);
assert.match(account, /Research Membership billing is independent from Library Pass/);
assert.match(account, /Canceling prevents the next renewal/);
assert.doesNotMatch(account, /research-membership-checkout/);
assert.doesNotMatch(account, /\/api\/commerce/);

assert.match(accessRequired, /Research access required/);
assert.match(accessRequired, /href="\/research\/sample\/"/);
assert.match(accessRequired, /href="\/research\/account\/"/);
assert.match(accessRequired, /Library Pass remains separate and permanent/);

assert.match(previewGate, /\/research\/access-required\//);
assert.doesNotMatch(previewGate, /\/account\/access-required\//);
assert.match(previewGate, /RESEARCH_MEMBERSHIP_PRODUCT_ID/);

assert.match(tradingViewRunbook, /Grant procedure/);
assert.match(tradingViewRunbook, /Revocation procedure/);
assert.match(tradingViewRunbook, /source code.*never|never expose source code/is);
assert.match(tradingViewRunbook, /Library Pass.*never/is);

console.log('Research Membership launch-surface regressions passed.');
