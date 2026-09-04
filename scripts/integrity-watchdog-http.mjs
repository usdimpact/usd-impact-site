import { OUTCOME, SEVERITY, result, sha256 } from './integrity-watchdog-policy.mjs';

const TIMEOUT_MS = 15_000;
const MAX_BODY = 750_000;
const USER_AGENT = 'usd-impact-integrity-watchdog/1.0';

function lowerHeaders(headers) {
  return Object.fromEntries([...headers.entries()].map(([key, value]) => [key.toLowerCase(), value]));
}

async function boundedText(response) {
  const text = await response.text();
  return Buffer.byteLength(text) <= MAX_BODY ? text : text.slice(0, MAX_BODY);
}

export async function observe({ fetchImpl = globalThis.fetch, url, method = 'GET', headers = {}, body, redirect = 'follow', timeoutMs = TIMEOUT_MS }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetchImpl(url, { method, headers: { 'User-Agent': USER_AGENT, ...headers }, body, redirect, signal: controller.signal });
    const text = await boundedText(response);
    return {
      ok: true,
      url,
      final_url: response.url || url,
      status: response.status,
      duration_ms: Date.now() - started,
      headers: lowerHeaders(response.headers),
      body: text,
      body_bytes: Buffer.byteLength(text),
      body_sha256: sha256(text),
    };
  } catch (error) {
    return { ok: false, url, duration_ms: Date.now() - started, error_name: error?.name || 'Error', error_message: error?.name === 'AbortError' ? 'Request timed out.' : String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

function markerMatches(body, marker) {
  if (marker instanceof RegExp) {
    marker.lastIndex = 0;
    return marker.test(body);
  }
  return body.includes(String(marker));
}

export async function probe({ fetchImpl = globalThis.fetch, id, workflowId, title, domain = 'public_web', severity, url, method = 'GET', requestHeaders = {}, requestBody, redirect = 'follow', expectedStatus = 200, requiredText = [], forbiddenText = [], requiredHeaders = {}, locationPattern, goldEligible = false, material = true, remediation }) {
  const observation = await observe({ fetchImpl, url, method, headers: requestHeaders, body: requestBody, redirect });
  if (!observation.ok) return result({ id, workflowId, title, domain, severity, outcome: OUTCOME.UNKNOWN, summary: `${title}: no conclusive HTTP response was obtained.`, evidence: [{ id: `${id}-HTTP`, source: 'http', url, duration_ms: observation.duration_ms, error_name: observation.error_name, error_message: observation.error_message }], goldEligible, material, remediation });

  const failures = [];
  const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (!expected.includes(observation.status)) failures.push(`Expected HTTP ${expected.join('/')}; received ${observation.status}.`);
  const matched = [];
  for (const marker of requiredText) {
    if (markerMatches(observation.body, marker)) matched.push(String(marker));
    else failures.push(`Required marker missing: ${String(marker).slice(0, 100)}`);
  }
  for (const marker of forbiddenText) if (markerMatches(observation.body, marker)) failures.push(`Forbidden marker present: ${String(marker).slice(0, 100)}`);
  for (const [name, expectedValue] of Object.entries(requiredHeaders)) {
    const actual = observation.headers[name.toLowerCase()] || '';
    const valid = expectedValue instanceof RegExp ? (expectedValue.lastIndex = 0, expectedValue.test(actual)) : actual.toLowerCase().includes(String(expectedValue).toLowerCase());
    if (!valid) failures.push(`Header ${name} did not meet the contract.`);
  }
  if (locationPattern) {
    const location = observation.headers.location || '';
    const valid = locationPattern instanceof RegExp ? (locationPattern.lastIndex = 0, locationPattern.test(location)) : location === String(locationPattern);
    if (!valid) failures.push('Redirect location did not meet the canonical contract.');
  }

  return result({
    id, workflowId, title, domain, severity,
    outcome: failures.length ? OUTCOME.FAIL : OUTCOME.PASS,
    summary: failures.length ? `${title}: ${failures.join(' ')}` : `${title}: contract passed.`,
    evidence: [{ id: `${id}-HTTP`, source: 'http', url, final_url: observation.final_url, status: observation.status, duration_ms: observation.duration_ms, body_bytes: observation.body_bytes, body_sha256: observation.body_sha256, matched_markers: matched, checked_headers: Object.fromEntries(Object.keys(requiredHeaders).map((name) => [name.toLowerCase(), observation.headers[name.toLowerCase()] || null])), redirect_location: locationPattern ? observation.headers.location || null : undefined, failures }],
    goldEligible, material, remediation,
  });
}

function tiraneParts(now) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tirane', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type)?.value || '';
  return { date: `${value('year')}-${value('month')}-${value('day')}`, weekday: value('weekday'), hour: Number(value('hour')) };
}

export async function dailyFreshness({ fetchImpl = globalThis.fetch, baseUrl, now = new Date() }) {
  const id = 'DAILY-FRESHNESS';
  const url = `${baseUrl}/news/`;
  const observation = await observe({ fetchImpl, url });
  if (!observation.ok) return result({ id, workflowId: 'DAILY-PUBLISH-01', title: 'Daily publication freshness', domain: 'publishing', severity: SEVERITY.P1, outcome: OUTCOME.UNKNOWN, summary: 'Daily freshness could not be verified.', evidence: [{ id: `${id}-HTTP`, source: 'http', url, error_message: observation.error_message }] });
  const dates = [...new Set([...observation.body.matchAll(/\/news\/(20\d{2}-\d{2}-\d{2})(?:\/|["'])/g)].map((match) => match[1]))].sort().reverse();
  const latest = dates[0] || null;
  const local = tiraneParts(now);
  const businessDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(local.weekday);
  const exactRequired = businessDay && local.hour >= 19;
  const age = latest ? Math.round((Date.parse(`${local.date}T00:00:00Z`) - Date.parse(`${latest}T00:00:00Z`)) / 86_400_000) : null;
  let outcome = OUTCOME.PASS;
  let summary = `Latest detected Daily edition is ${latest || 'none'}.`;
  if (observation.status !== 200 || !latest || age < 0) { outcome = OUTCOME.FAIL; summary = 'Daily index is unavailable, contains no dated edition, or is future-dated.'; }
  else if (exactRequired && latest !== local.date) { outcome = OUTCOME.FAIL; summary = `After 19:00 Europe/Tirane, ${local.date} is not the latest Daily edition.`; }
  else if (age > 4) { outcome = OUTCOME.WARN; summary = `Latest Daily edition is ${age} calendar days old.`; }
  return result({ id, workflowId: 'DAILY-PUBLISH-01', title: 'Daily publication freshness', domain: 'publishing', severity: SEVERITY.P1, outcome, summary, evidence: [{ id: `${id}-INDEX`, source: 'public_web', url, status: observation.status, body_sha256: observation.body_sha256, latest_edition_date: latest, current_tirane_date: local.date, current_tirane_hour: local.hour, exact_date_required: exactRequired, age_days: age, detected_edition_count: dates.length }], remediation: { likely_root_causes: ['Generation failure', 'Validation failure', 'Review or merge delay', 'Deployment or canonical-route lag'], smallest_safe_scope: ['Daily workflow, generated edition, exact-head checks, and resulting deployment only.'] } });
}

export async function publicContracts({ fetchImpl = globalThis.fetch, baseUrl = 'https://www.usd-impact.com', apexUrl = 'https://usd-impact.com', now = new Date() } = {}) {
  const secure = { 'strict-transport-security': 'max-age=', 'x-content-type-options': 'nosniff', 'x-frame-options': 'deny' };
  const checks = [
    probe({ fetchImpl, id: 'PUBLIC-CANONICAL-ROUTES', workflowId: 'PUBLIC-CONTRACT-01', title: 'Apex-to-www canonical redirect', severity: SEVERITY.P1, url: `${apexUrl}/`, redirect: 'manual', expectedStatus: [301, 302, 307, 308], locationPattern: /^https:\/\/www\.usd-impact\.com\/?$/i, goldEligible: true }),
    probe({ fetchImpl, id: 'PUBLIC-PRODUCT-CONTRACT', workflowId: 'PRODUCT-BOUNDARY-01', title: 'Library Pass product contract', severity: SEVERITY.P1, url: `${baseUrl}/book/read-the-dollar-first/`, requiredText: ['Guided Interactive Edition', 'Complete English audiobook', '51-film Video Library', 'USD 39.00', 'USD 49.00', 'one time', 'Try a free sample'], requiredHeaders: secure, goldEligible: true }),
    probe({ fetchImpl, id: 'PUBLIC-LEGAL-IDENTITY', workflowId: 'LEGAL-PUBLIC-01', title: 'Public legal identity and seller disclosure', severity: SEVERITY.P0, url: `${baseUrl}/checkout/`, requiredText: ['KELA LEADS S.R.L.', '40790448', 'J38/820/2020', 'ROONRC.J38/820/2020', 'Lemon Squeezy', 'Merchant of Record', '14-day Refund Policy'], requiredHeaders: secure, goldEligible: true }),
    probe({ fetchImpl, id: 'CHECKOUT-FAIL-CLOSED', workflowId: 'CHECKOUT-GATE-01', title: 'Checkout fail-closed presentation', severity: SEVERITY.P0, url: `${baseUrl}/checkout/`, requiredText: ['This page fails closed', 'No purchase control is shown unless every release gate is confirmed.', 'No payment can be initiated until verification completes.', 'A browser redirect alone never grants access.', 'id="checkout-button"', 'hidden'], requiredHeaders: secure, goldEligible: true }),
    probe({ fetchImpl, id: 'ACCESS-ANONYMOUS-DENIAL', workflowId: 'ACCESS-GATE-01', title: 'Anonymous Guided Edition API denial', severity: SEVERITY.P0, url: `${baseUrl}/api/guided-edition?action=progress&contentId=guided-edition%3Achapter-1`, expectedStatus: 401, requiredText: ['AUTHENTICATION_REQUIRED'], requiredHeaders: { ...secure, 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', vary: 'authorization' }, goldEligible: true }),
    probe({ fetchImpl, id: 'SOURCE-ENDPOINT-AUTHZ', workflowId: 'SECURITY-CREDENTIAL-01', title: 'Daily source endpoint authorization boundary', severity: SEVERITY.P0, url: `${baseUrl}/api/daily-news-source`, expectedStatus: 401, requiredText: ['Unauthorized.'], forbiddenText: ['OPENAI_API_KEY', 'NEWSFEED_BEARER_TOKEN'], requiredHeaders: { ...secure, 'cache-control': 'no-store', 'www-authenticate': 'bearer' }, goldEligible: true }),
    probe({ fetchImpl, id: 'SCORE-CLAIM-BOUNDARY', workflowId: 'CLAIMS-BOUNDARY-01', title: 'Score methodology and predictive-claim boundary', severity: SEVERITY.P0, url: `${baseUrl}/score/methodology/`, requiredText: ['descriptive weekly regime indicator', 'not a return forecast, trading signal, probability model or optimized portfolio rule', 'full-sample', 'This is a robustness finding, not a predictive backtest.', 'zero resolved predictions', 'does not promise predictive accuracy'], requiredHeaders: secure, goldEligible: true }),
    probe({ fetchImpl, id: 'CONSENT-PUBLIC-CONTRACT', workflowId: 'CONSENT-PRIVACY-01', title: 'Public privacy-choice contract', severity: SEVERITY.P1, url: `${baseUrl}/privacy/`, requiredText: ['Privacy settings', 'Reject analytics', 'Accept analytics', 'No advertising trackers'], requiredHeaders: secure, goldEligible: true }),
  ];
  const results = await Promise.all(checks);
  results.push(await dailyFreshness({ fetchImpl, baseUrl, now }));
  return results;
}
