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
  if (commerce?.state !== 'active') fail(`Commerce readiness state drifted: ${commerce?.state}`);
  if (commerce?.mode !== 'live') fail(`Commerce mode drifted: ${commerce?.mode}`);
  if (commerce?.provider !== 'lemon-squeezy') fail(`Commerce provider drifted: ${commerce?.provider}`);
  if (commerce?.providerConfigured !== true) fail('providerConfigured must remain true for the approved Live provider.');
  if (commerce?.disclosuresComplete !== true) fail('Buyer-facing seller disclosures must remain complete for Live checkout.');
  if (commerce?.checkoutEnabled !== true) fail('checkoutEnabled must remain true for the approved Live release.');

  // A real checkout or valid entitlement must never be inferred from a GET.
  // These requests are deliberately anonymous: no cookies or Authorization header.
  const protectedRoutes = [
    { path: '/guided-edition/book/', label: 'Protected book boundary' },
    { path: '/guided-edition/audiobook/', label: 'Protected audiobook boundary' },
    { path: '/guided-edition/video-library/', label: 'Protected Video Library boundary' },
  ];
  for (const { path, label } of protectedRoutes) {
    const protectedResponse = await fetchWithTimeout(path);
    if (protectedResponse.status !== 200) {
      fail(`${label} returned ${protectedResponse.status}, expected secure sign-in page 200.`);
    }
    verifySecurityHeaders(protectedResponse, label);
    const protectedHtml = await protectedResponse.text();
    requireText(protectedHtml, '<title>Sign in | USD Impact</title>', label);
    requireText(protectedHtml, '<meta name="robots" content="noindex, nofollow">', label);
    requireText(protectedHtml, 'Sign in without a password.', label);
    if (/storage\.supabase\.co\/storage\/v1\/object\/(?:sign|public)\//i.test(protectedHtml)) {
      fail(`${label} exposed a Storage object URL before authentication.`);
    }
    if (/\.mp3(?:[?"'])/i.test(protectedHtml)) {
      fail(`${label} exposed an MP3 URL before authentication.`);
    }
  }

  // Vercel cleanUrls uses a no-trailing-slash canonical route (the slash URL 308s).
  // PR #932's sixth Spanish DXY page is private/review-only, even though the
  // separately approved five-page public Spanish site is already live.
  // Revisit this assertion only through its independently authorized release.
  const heldSpanishDxy = await fetchWithTimeout('/es/dxy/dxy-vs-broad-usd', { redirect: 'manual' });
  if (heldSpanishDxy.status !== 404) {
    fail(`Held Spanish DXY page returned ${heldSpanishDxy.status}, expected 404 until release approval.`);
  }
  verifySecurityHeaders(heldSpanishDxy, 'Held Spanish DXY boundary');
  // Vercel primary-domain edge 404s may omit X-Robots-Tag. The 404 is
  // itself the fail-closed publication check; reject a contradictory header.
  const heldRobots = heldSpanishDxy.headers.get('x-robots-tag') || '';
  if (heldRobots && !heldRobots.toLowerCase().includes('noindex')) {
    fail('Held Spanish DXY boundary sent an unexpected robots policy.');
  }

  // The five already-approved public Spanish educational pages must stay
  // localized and indexable; the next proposed Spanish DXY page stays held.
  const approvedSpanishPages = [
    { spanish: '/es', english: '/' },
    { spanish: '/es/start-here', english: '/start-here' },
    { spanish: '/es/dollar-framework', english: '/dollar-framework' },
    { spanish: '/es/framework/dollar-transmission-chain', english: '/framework/dollar-transmission-chain' },
    { spanish: '/es/framework/three-dial-dashboard', english: '/framework/three-dial-dashboard' },
  ];
  for (const { spanish, english } of approvedSpanishPages) {
    const response = await fetchWithTimeout(spanish, { redirect: 'manual' });
    if (response.status !== 200) {
      fail(`Approved Spanish page ${spanish} returned ${response.status}, expected 200.`);
    }
    verifySecurityHeaders(response, `Approved Spanish page ${spanish}`);
    const html = await response.text();
    const source = `https://www.usd-impact.com${english}`;
    const localized = `https://www.usd-impact.com${spanish}`;
    requireText(html, '<html lang="es">', `Spanish HTML ${spanish}`);
    requireText(html, `<link rel="canonical" href="${localized}">`, `Spanish canonical ${spanish}`);
    requireText(html, `<link rel="alternate" hreflang="en" href="${source}">`, `English alternate ${spanish}`);
    requireText(html, `<link rel="alternate" hreflang="es" href="${localized}">`, `Spanish alternate ${spanish}`);
    requireText(html, `<link rel="alternate" hreflang="x-default" href="${source}">`, `Default alternate ${spanish}`);
    if (/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html)) {
      fail(`Approved public Spanish page ${spanish} unexpectedly contains noindex.`);
    }

    // hreflang must be reciprocal, not just present on the Spanish page.
    const counterpart = await fetchWithTimeout(english, { redirect: 'manual' });
    if (counterpart.status !== 200) {
      fail(`English counterpart ${english} returned ${counterpart.status}, expected 200.`);
    }
    verifySecurityHeaders(counterpart, `English counterpart ${english}`);
    const englishHtml = await counterpart.text();
    requireText(englishHtml, '<html lang="en">', `English HTML ${english}`);
    requireText(englishHtml, `<link rel="canonical" href="${source}">`, `English canonical ${english}`);
    requireText(englishHtml, `<link rel="alternate" hreflang="en" href="${source}">`, `English reciprocal ${english}`);
    requireText(englishHtml, `<link rel="alternate" hreflang="es" href="${localized}">`, `Spanish reciprocal ${english}`);
    requireText(englishHtml, `<link rel="alternate" hreflang="x-default" href="${source}">`, `Default reciprocal ${english}`);
  }

  // Site index may add extra sitemaps as English content grows, but only
  // five explicitly approved educational pages + /es/privacy may be indexed
  // in Spanish. Never promote a review-only Spanish draft via a sitemap.
  const indexResponse = await fetchWithTimeout('/sitemap-index.xml');
  if (indexResponse.status !== 200) fail(`Sitemap index returned ${indexResponse.status}, expected 200.`);
  const indexXml = await indexResponse.text();
  const sitemapUrls = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (!sitemapUrls.length || sitemapUrls.length > 20) fail('Sitemap index must list 1–20 bounded sitemap files.');
  const indexedSpanish = new Set();
  for (const sitemapUrl of sitemapUrls.slice(0, 20)) {
    const url = new URL(sitemapUrl);
    if (url.origin !== 'https://www.usd-impact.com' || !/^\/sitemap-\d+\.xml$/.test(url.pathname)) {
      fail(`Sitemap index lists a noncanonical sitemap: ${url.pathname}`);
      continue;
    }
    const sitemapResponse = await fetchWithTimeout(url.pathname);
    if (sitemapResponse.status !== 200) {
      fail(`Sitemap ${url.pathname} returned ${sitemapResponse.status}, expected 200.`);
      continue;
    }
    const sitemapXml = await sitemapResponse.text();
    for (const match of sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const entry = match[1];
      if (entry.startsWith('https://www.usd-impact.com/es/') || entry === 'https://www.usd-impact.com/es') {
        if (indexedSpanish.has(entry)) fail(`Spanish sitemap URL repeated: ${entry}`);
        indexedSpanish.add(entry);
      }
    }
  }
  const expectedSpanish = new Set([
    ...approvedSpanishPages.map(({ spanish }) => `https://www.usd-impact.com${spanish}`),
    'https://www.usd-impact.com/es/privacy',
  ]);
  for (const expected of expectedSpanish) {
    if (!indexedSpanish.has(expected)) fail(`Approved Spanish URL missing from sitemap: ${expected}`);
  }
  for (const actual of indexedSpanish) {
    if (!expectedSpanish.has(actual)) fail(`Unapproved Spanish URL present in sitemap: ${actual}`);
  }

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
