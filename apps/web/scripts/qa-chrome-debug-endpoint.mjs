// Restrict Chrome DevTools QA connections to the browser's numeric loopback port.
// Never pass untrusted DevToolsActivePort or /json response strings directly to fetch/WebSocket.
export function parseChromeDebugPort(contents) {
  if (typeof contents !== 'string') throw new TypeError('Chrome debugger port file must be text');
  const raw = contents.split(/\r?\n/, 1)[0];
  if (!/^[1-9][0-9]{0,4}$/.test(raw)) throw new TypeError('Invalid Chrome debugger port');
  const port = Number(raw);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('Chrome debugger port outside TCP range');
  }
  return port;
}

function requirePort(port) {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('Invalid numeric Chrome debugger port');
  }
}

export function chromeDebugHttpUrl(port, pathname) {
  requirePort(port);
  if (pathname !== '/json/version' && pathname !== '/json/list') {
    throw new TypeError('Unexpected Chrome debugging endpoint');
  }
  const url = new URL('http://127.0.0.1/');
  url.port = String(port);
  url.pathname = pathname;
  return url.href;
}

export function chromeDebugWebSocketUrl(candidate, port, targetKind) {
  requirePort(port);
  if (typeof candidate !== 'string' || (targetKind !== 'browser' && targetKind !== 'page')) {
    throw new TypeError('Invalid Chrome WebSocket candidate or target');
  }
  let url;
  try { url = new URL(candidate); }
  catch { throw new TypeError('Invalid Chrome WebSocket URL'); }
  if (url.protocol !== 'ws:'
    || url.hostname !== '127.0.0.1'
    || url.port !== String(port)
    || url.username || url.password || url.search || url.hash
    || !/^\/devtools\/(?:browser|page)\/[A-Za-z0-9-]{8,128}$/.test(url.pathname)
    || !url.pathname.startsWith('/devtools/' + targetKind + '/')) {
    throw new TypeError('Chrome WebSocket must match loopback port and target path');
  }
  return url.href;
}
