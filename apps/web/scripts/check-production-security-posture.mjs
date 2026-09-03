const baseUrl = (process.env.USD_IMPACT_BASE_URL || 'https://www.usd-impact.com').replace(/\/$/, '');
const failures = [];

const fail = (message) => failures.push(message);
const requireText = (value, expected, label) => {
  if (!value.includes(expected)) fail(`${label} is missing required text: ${expected}`);
};

const fetchWithTimeout = async (pathname, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(`${baseUrl}${pathname}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'USD-Impact-Production-Security-Monitor/1.0',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
};

const verifySecurityHeaders = (response, label) => {
  const get = (name) => response.headers.get(name) || '';
  requireText(get('strict-transport-security'), 'max-age=', `${label} HSTS`);
  requireText(get('content-security-policy'), "frame-ancestors 'none'", `${label} response CSP`);
  requireText(get('content-security-policy'), "base-uri 'self'", `${label} response CSP`);
  requireText(get('content-security-policy'), "object-src 'none'", `${label} response CSP`);
  if (get('x-content-type-options').toLowerCase() !== 'nosniff') fail(`${label} must send X-Content-Type-Options: nosniff.`);
  if (get('x-frame-options').toUpperCase() !== 'DENY') fail(`${label} must send X-Frame-Options: DENY.`);
  if (get('x-permitted-cross-domain-policies').toLowerCase() !== 'none') fail(`${label} must deny cross-domain policy files.`);
  if (get('referrer-policy') !== 'strict-origin-when-cross-origin') fail(`${label} Referrer-Policy drifted.`);
  const permissions = get('permissions-policy');
  for (const denied of ['camera=()', 'microphone=()', 'geolocation=()']) {
    requireText(permissions, denied, `${label} Permissions-Policy`);
  }
};

try {
  const home = await fetchWithTimeout('/');
  if (home.status !== 200) fail(`Homepage returned ${home.status}, expected 200.`);
  verifySecurityHeaders(home, 'Homepage');
  const homeHtml = await home.text();
  requireText(homeHtml, 'http-equiv="content-security-policy"', 'Homepage HTML CSP');
  requireText(homeHtml, "script-src-attr 'none'", 'Homepage HTML CSP');
  requireText(homeHtml, 'sha384-', 'Homepage HTML CSP');
  if (/script-src(?:-elem)?[^;]*'unsafe-inline'/i.test(homeHtml)) fail('Homepage HTML CSP permits unsafe-inline JavaScript.');

  const checkout = await fetchWithTimeout('/checkout/');
  if (checkout.status !== 200) fail(`Checkout returned ${checkout.status}, expected 200.`);
  verifySecurityHeaders(checkout, 'Checkout');
  const checkoutHtml = await checkout.text();
  requireText(checkoutHtml, 'Verifying checkout availability…', 'Checkout verification copy');
  requireText(checkoutHtml, 'No payment can be initiated until verification completes.', 'Checkout fail-closed copy');
  if (!/<button\b(?=[^>]*\bid=["']checkout-button["'])(?=[^>]*\bhidden(?:\s|=|>))[^>]*>/i.test(checkoutHtml)) {
    fail('Checkout purchase control must remain hidden before runtime approval.');
  }

  const readiness = await fetchWithTimeout('/api/commerce-readiness');
  if (readiness.status !== 200) fail(`Commerce readiness returned ${readiness.status}, expected 200.`);
  verifySecurityHeaders(readiness, 'Commerce readiness');
  if (readiness.headers.get('cache-control') !== 'no-store') fail('Commerce readiness must remain Cache-Control: no-store.');
  const readinessBody = await readiness.json();
  const commerce = readinessBody?.commerce;
  if (readinessBody?.ok !== true) fail('Commerce readiness must return ok=true.');
  if (commerce?.state !== 'ready_for_provider_configuration') fail(`Commerce readiness state drifted: ${commerce?.state}`);
  if (commerce?.mode !== 'disabled') fail(`Commerce mode drifted: ${commerce?.mode}`);
  if (commerce?.provider !== null) fail(`Commerce provider must remain null before approval: ${commerce?.provider}`);
  if (commerce?.providerConfigured !== false) fail('providerConfigured must remain false before provider approval.');
  if (commerce?.checkoutEnabled !== false) fail('checkoutEnabled must remain false before provider approval.');

  const protectedAudiobook = await fetchWithTimeout('/guided-edition/audiobook/');
  if (protectedAudiobook.status !== 200) fail(`Protected audiobook boundary returned ${protectedAudiobook.status}, expected secure sign-in page 200.`);
  verifySecurityHeaders(protectedAudiobook, 'Protected audiobook boundary');
  const protectedHtml = await protectedAudiobook.text();
  requireText(protectedHtml, '<title>Sign in | USD Impact</title>', 'Protected audiobook boundary');
  requireText(protectedHtml, 'Sign in without a password.', 'Protected audiobook boundary');
  if (/\.mp3(?:[?"'])/i.test(protectedHtml)) fail('Protected audiobook boundary exposed an MP3 URL before authentication.');

  const securityTxt = await fetchWithTimeout('/.well-known/security.txt');
  if (securityTxt.status !== 200) fail(`security.txt returned ${securityTxt.status}, expected 200.`);
  verifySecurityHeaders(securityTxt, 'security.txt');
  requireText(securityTxt.headers.get('content-type') || '', 'text/plain', 'security.txt Content-Type');
  const securityText = await securityTxt.text();
  for (const required of [
    'Contact: mailto:support@usd-impact.com',
    'Preferred-Languages: en',
    'Canonical: https://www.usd-impact.com/.well-known/security.txt',
    'Policy: https://github.com/usdimpact/usd-impact-site/security/policy',
  ]) requireText(securityText, required, 'security.txt');

  const expires = securityText.match(/^Expires:\s*(\S+)\s*$/m)?.[1];
  if (!expires || !Number.isFinite(Date.parse(expires))) fail('security.txt must contain a valid Expires timestamp.');
  else if (Date.parse(expires) - Date.now() <= 30 * 24 * 60 * 60 * 1000) fail('security.txt is within 30 days of expiry.');
} catch (error) {
  fail(`Production security monitor threw: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length > 0) {
  console.error(`Production security posture FAILED:\n${failures.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}

console.log(`Production security posture passed for ${baseUrl}.`);
