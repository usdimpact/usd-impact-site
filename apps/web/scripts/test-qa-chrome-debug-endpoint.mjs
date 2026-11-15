import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import {
  parseChromeDebugPort,
  chromeDebugHttpUrl,
  fetchChromeDebugEndpoint,
  chromeDebugWebSocketUrl,
} from './qa-chrome-debug-endpoint.mjs';

const port = parseChromeDebugPort('9222\n/devtools/browser/12345678-1234-1234-1234-1234567890ab\n');
assert.equal(port, 9222);
assert.equal(parseChromeDebugPort('1\n'), 1);
assert.equal(parseChromeDebugPort('65535\n'), 65535);
for (const bad of [
  '', '0', '0001', '65536', '-1', '1.5', '1@evil.com', '80#@evil',
  '80/path', '80?x=1', '80\rmalicious', ' 9222', '9222 ', '999999999999',
]) {
  assert.throws(() => parseChromeDebugPort(bad), /port/i, 'reject injected port ' + JSON.stringify(bad));
}
for (const bad of [0, 65536, -1, 1.1, NaN, '9222', null]) {
  assert.throws(() => chromeDebugHttpUrl(bad, '/json/list'));
}
assert.equal(chromeDebugHttpUrl(port, '/json/version'), 'http://127.0.0.1:9222/json/version');
assert.equal(chromeDebugHttpUrl(port, '/json/list'), 'http://127.0.0.1:9222/json/list');
assert.throws(() => chromeDebugHttpUrl(port, 'http://evil.example/'));
assert.throws(() => chromeDebugHttpUrl(port, '/json/list?url=http://evil.example/'));

const id = '12345678-1234-1234-1234-1234567890ab';
for (const kind of ['browser', 'page']) {
  const good = 'ws://127.0.0.1:9222/devtools/' + kind + '/' + id;
  assert.equal(chromeDebugWebSocketUrl(good, port, kind), good);
  for (const bad of [
    'wss://127.0.0.1:9222/devtools/' + kind + '/' + id,
    'ws://localhost:9222/devtools/' + kind + '/' + id,
    'ws://0.0.0.0:9222/devtools/' + kind + '/' + id,
    'ws://169.254.169.254:9222/devtools/' + kind + '/' + id,
    'ws://127.0.0.1.evil.example:9222/devtools/' + kind + '/' + id,
    'ws://127.0.0.1:9223/devtools/' + kind + '/' + id,
    'ws://user@127.0.0.1:9222/devtools/' + kind + '/' + id,
    'ws://127.0.0.1:9222/devtools/' + kind + '/' + id + '?next=evil',
    'ws://127.0.0.1:9222/devtools/' + kind + '/' + id + '#fragment',
    'ws://127.0.0.1:9222/devtools/' + kind + '/../' + id,
    'ws://127.0.0.1:9222/json/list',
    'not-a-websocket-url',
  ]) {
    assert.throws(() => chromeDebugWebSocketUrl(bad, port, kind), /Chrome|WebSocket/i, 'reject ' + bad);
  }
  assert.throws(() => chromeDebugWebSocketUrl(good, 9223, kind));
  assert.throws(() => chromeDebugWebSocketUrl(good, port, kind === 'page' ? 'browser' : 'page'));
}
// The default fetch API follows 301/302 redirects. Even a local 127.0.0.1
// server must not redirect our request to another destination.
const callLog = [];
const simulated = await fetchChromeDebugEndpoint(9222, '/json/list', async (url, opts) => {
  callLog.push({url, opts});
  return {ok:true};
});
assert.equal(simulated.ok, true);
assert.deepEqual(callLog, [{
  url:'http://127.0.0.1:9222/json/list',
  opts:{redirect:'error'},
}]);
await assert.rejects(fetchChromeDebugEndpoint(9222, '/json/list?redirect=1',
  async () => { throw Error('invalid path must never invoke fetch'); }), /Unexpected Chrome debugging endpoint/);

async function startLoopback(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}
async function closeLoopback(server) {
  await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
}
let redirectHits = 0;
const destination = createServer((_req, res) => {
  redirectHits++;
  res.writeHead(200, {'content-type':'application/json'});
  res.end('{"unsafe":"redirect was followed"}');
});
const destinationPort = await startLoopback(destination);
const redirector = createServer((_req, res) => {
  res.writeHead(302, {'location':'http://127.0.0.1:' + destinationPort + '/destination'});
  res.end();
});
try {
  const redirectPort = await startLoopback(redirector);
  await assert.rejects(
    () => fetchChromeDebugEndpoint(redirectPort, '/json/version'),
    /fetch failed|redirect/i,
    'A 302 from the local debugging port must never be automatically followed',
  );
  assert.equal(redirectHits, 0, 'redirect target must not receive any request');
} finally {
  if (redirector.listening) await closeLoopback(redirector);
  await closeLoopback(destination);
}
console.log('Chrome debugging loopback HTTP redirect rejection PASS');

console.log('Chrome QA DevTools loopback endpoint validation PASS (positive + malicious-input negatives)');
