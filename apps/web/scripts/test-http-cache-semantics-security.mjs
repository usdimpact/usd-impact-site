import assert from 'node:assert/strict';
import CachePolicy from 'http-cache-semantics';

function request(cacheControl) {
  return {
    url: 'https://example.test/account',
    method: 'GET',
    headers: {
      host: 'example.test',
      ...(cacheControl ? { 'cache-control': cacheControl } : {}),
    },
  };
}

function policy(responseHeaders) {
  const value = new CachePolicy(
    request(),
    {
      status: 200,
      headers: {
        ...responseHeaders,
      },
    },
    { shared: true },
  );

  const createdAt = value._responseTime;
  value.now = () => createdAt + 10_000;
  return value;
}

const attackerRequest = request('max-stale=86400');

{
  const value = policy({
    'cache-control': 'max-age=60',
    'set-cookie': 'session=secret; Secure; HttpOnly',
  });
  assert.equal(
    value.satisfiesWithoutRevalidation(attackerRequest),
    false,
    'shared Set-Cookie response must not be revived by max-stale',
  );
}

{
  const value = policy({
    'cache-control': 'max-age=60, proxy-revalidate',
  });
  assert.equal(
    value.satisfiesWithoutRevalidation(attackerRequest),
    false,
    'proxy-revalidate response must not be revived by max-stale',
  );
}

{
  const value = policy({
    'cache-control': 'max-age=60, no-cache',
  });
  assert.equal(
    value.satisfiesWithoutRevalidation(attackerRequest),
    false,
    'response no-cache must not be revived by max-stale',
  );
}

{
  const value = policy({
    'cache-control': 'max-age=1',
  });
  assert.equal(
    value.satisfiesWithoutRevalidation(request('max-stale=20')),
    true,
    'ordinary stale responses may still honor max-stale',
  );
}

{
  const value = policy({
    'cache-control': 'public, max-age=1',
    'set-cookie': 'session=explicitly-public',
  });
  assert.equal(
    value.satisfiesWithoutRevalidation(request('max-stale=20')),
    true,
    'explicitly public cached responses retain upstream max-stale behavior',
  );
}

{
  const value = policy({
    'cache-control': 'public, max-age=60',
    connection: 'x-secret,   x-debug',
    'x-secret': 'remove-me',
    'x-debug': 'remove-me-too',
    'x-keep': 'keep-me',
  });
  const headers = value.responseHeaders();
  assert.equal(headers['x-secret'], undefined, 'Connection token header must be stripped');
  assert.equal(headers['x-debug'], undefined, 'whitespace-padded Connection token header must be stripped');
  assert.equal(headers['x-keep'], 'keep-me', 'unrelated response header must remain');
}

console.log('http-cache-semantics security regression pass');
