import assert from 'node:assert/strict';
import { createPaddleCheckoutHandler } from '../src/lib/paddle-checkout-handler.js';
import { SupabaseRequestError } from '../src/lib/supabase-server.js';

function responseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value = '') { this.body = value; },
  };
}

const account = {
  id: '2a95425a-0a46-4c20-8b31-7ad474768559',
  email: 'buyer@example.com',
};
const intent = {
  id: 'df3c49c8-5d27-4fe6-b832-af42b08bf783',
  accountId: account.id,
  productId: 'read-the-dollar-first-guided-interactive-edition',
  status: 'pending',
  priceTier: 'standard',
  amountCents: 4900,
  currency: 'USD',
  expiresAt: '2026-07-31T17:00:00.000Z',
  providerTransactionId: null,
};
const transaction = {
  id: 'txn_01kyabcdefghijklmnopqrstuv',
  status: 'draft',
  checkoutUrl: 'https://checkout.example.test/?_ptxn=txn_01kyabcdefghijklmnopqrstuv',
};

let observed = null;
const handler = createPaddleCheckoutHandler({
  readAccessToken: () => 'access-token',
  getUser: async (token) => {
    assert.equal(token, 'access-token');
    return account;
  },
  reserveIntent: async (input) => {
    observed = { reserve: input };
    return intent;
  },
  createTransaction: async (input) => {
    observed.create = input;
    return transaction;
  },
  attachTransaction: async (input) => {
    observed.attach = input;
    return { attached: true, transactionId: transaction.id, status: 'checkout_created' };
  },
});

const request = {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'sec-fetch-site': 'same-origin',
  },
  body: JSON.stringify({
    requestId: 'checkout-request-1234',
    accountId: '00000000-0000-4000-8000-000000000000',
    priceTier: 'launch',
    amountCents: 1,
  }),
};
const response = responseRecorder();
await handler(request, response);
assert.equal(response.statusCode, 201);
const payload = JSON.parse(response.body);
assert.equal(payload.ok, true);
assert.equal(payload.reused, false);
assert.equal(payload.intent.amountCents, 4900);
assert.equal(observed.reserve.accountId, account.id);
assert.equal(observed.reserve.requestId, 'checkout-request-1234');
assert.equal(observed.create.account.id, account.id);
assert.equal(observed.create.intent.priceTier, 'standard');
assert.deepEqual(observed.attach, {
  intentId: intent.id,
  transactionId: transaction.id,
});

let createdForReuse = false;
const reusedHandler = createPaddleCheckoutHandler({
  readAccessToken: () => 'access-token',
  getUser: async () => account,
  reserveIntent: async () => ({ ...intent, status: 'failed', providerTransactionId: transaction.id }),
  createTransaction: async () => {
    createdForReuse = true;
    throw new Error('A reusable checkout must not create another transaction.');
  },
  getTransaction: async ({ transactionId }) => {
    assert.equal(transactionId, transaction.id);
    return { ...transaction, status: 'ready' };
  },
});
const reusedResponse = responseRecorder();
await reusedHandler(request, reusedResponse);
assert.equal(reusedResponse.statusCode, 200);
assert.equal(JSON.parse(reusedResponse.body).reused, true);
assert.equal(createdForReuse, false);

let canceledSuperseded = null;
const winningTransaction = {
  id: 'txn_01kyabcdefghijklmnopqrstu1',
  status: 'ready',
  checkoutUrl: 'https://checkout.example.test/?_ptxn=txn_01kyabcdefghijklmnopqrstu1',
};
const raceHandler = createPaddleCheckoutHandler({
  readAccessToken: () => 'access-token',
  getUser: async () => account,
  reserveIntent: async () => intent,
  createTransaction: async () => transaction,
  attachTransaction: async () => ({ attached: false, transactionId: winningTransaction.id }),
  cancelTransaction: async ({ transactionId }) => { canceledSuperseded = transactionId; },
  getTransaction: async () => winningTransaction,
});
const raceResponse = responseRecorder();
await raceHandler(request, raceResponse);
assert.equal(raceResponse.statusCode, 200);
assert.equal(JSON.parse(raceResponse.body).checkout.transactionId, winningTransaction.id);
assert.equal(canceledSuperseded, transaction.id);

const crossSiteResponse = responseRecorder();
await handler({
  method: 'POST',
  headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
  body: '{}',
}, crossSiteResponse);
assert.equal(crossSiteResponse.statusCode, 403);

const unauthenticated = createPaddleCheckoutHandler({ readAccessToken: () => null });
const unauthenticatedResponse = responseRecorder();
await unauthenticated({
  method: 'POST',
  headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
  body: '{}',
}, unauthenticatedResponse);
assert.equal(unauthenticatedResponse.statusCode, 401);

const entitled = createPaddleCheckoutHandler({
  readAccessToken: () => 'access-token',
  getUser: async () => account,
  reserveIntent: async () => {
    throw new SupabaseRequestError('account is already entitled', { status: 400, code: 'P0001' });
  },
});
const entitledResponse = responseRecorder();
await entitled({
  method: 'POST',
  headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
  body: '{}',
}, entitledResponse);
assert.equal(entitledResponse.statusCode, 409);
assert.equal(JSON.parse(entitledResponse.body).code, 'ALREADY_ENTITLED');

console.log('Paddle checkout tests passed.');
