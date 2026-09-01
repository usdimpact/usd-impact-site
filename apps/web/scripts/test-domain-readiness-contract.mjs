import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const files = {
  layout: read('src/layouts/BaseLayout.astro'),
  product: read('src/content/products/book-read-the-dollar-first.md'),
  preview: read('src/content/pages/book-read-the-dollar-first-preview.md'),
  privacy: read('src/pages/privacy.md'),
  terms: read('src/pages/terms.md'),
  refund: read('src/pages/refund-policy.md'),
  account: read('src/pages/account/index.astro'),
  checkout: read('src/pages/checkout/index.astro'),
  bookPurchaseCta: read('src/components/BookPurchaseCTA.astro'),
  securityPolicy: read('../../.github/SECURITY.md'),
  securityTxt: read('public/.well-known/security.txt'),
};

const failures = [];
const requireText = (file, label, values) => {
  for (const value of values) {
    if (!file.includes(value)) failures.push(`${label} is missing required text: ${value}`);
  }
};

requireText(files.layout, 'Footer', ['/terms/', '/refund-policy/', '/privacy/', '/book/read-the-dollar-first/']);
requireText(files.product, 'Product page', [
  'Guided Interactive Edition',
  'Launch price: USD 39.00',
  'Standard price: USD 49.00',
  'approved launch offer has no quantity cutoff',
  'one-time',
  'ongoing access',
  'Lemon Squeezy is the selected Merchant of Record',
  'verifies the current Live release state',
  'verified commercial event',
]);
requireText(files.bookPurchaseCta, 'Book purchase CTA', [
  'data-book-checkout-readiness="checking"',
  'Check Library Pass availability',
  'href="/checkout/"',
  '/api/commerce-readiness',
  'bookPurchasePresentation',
  'The book waitlist remains available.',
]);
requireText(files.preview, 'Free sample page', [
  'Lemon Squeezy is the selected Merchant of Record',
  'Current checkout availability is verified live',
]);
requireText(files.terms, 'Terms', [
  'KELA LEADS S.R.L.',
  '40790448',
  'J38/820/2020',
  'ROONRC.J38/820/2020',
  'support@usd-impact.com',
]);
requireText(files.terms, 'Terms', [
  'Lemon Squeezy',
  'Merchant of Record',
  'https://www.lemonsqueezy.com/buyer-terms',
]);
requireText(files.refund, 'Refund Policy', [
  '14 calendar days',
  'full refund',
  'support@usd-impact.com',
  'Lemon Squeezy',
  'selected Merchant of Record',
  'https://www.lemonsqueezy.com/buyer-terms',
]);
requireText(files.privacy, 'Privacy Notice', [
  'Lemon Squeezy',
  'selected Merchant of Record',
  'https://www.lemonsqueezy.com/privacy',
  'Supabase',
  'KELA LEADS S.R.L.',
  'ROONRC.J38/820/2020',
  'support@usd-impact.com',
]);
requireText(files.checkout, 'Checkout page', [
  'This page cannot verify checkout availability without JavaScript.',
  'Lemon Squeezy is the selected Merchant of Record',
  'No purchase control is shown unless every',
  'remains disabled',
  'No payment can be initiated until verification completes',
  '/api/commerce-readiness',
  'browser redirect alone never grants access',
]);
requireText(files.securityPolicy, 'Security policy', [
  'support@usd-impact.com',
  'Security report',
  'https://www.usd-impact.com/.well-known/security.txt',
  'does not promise a bug bounty',
]);
requireText(files.securityTxt, 'security.txt', [
  'Contact: mailto:support@usd-impact.com',
  'Preferred-Languages: en',
  'Canonical: https://www.usd-impact.com/.well-known/security.txt',
  'Policy: https://github.com/usdimpact/usd-impact-site/security/policy',
]);

const securityTxtExpires = files.securityTxt.match(/^Expires:\s*(\S+)\s*$/m)?.[1];
if (!securityTxtExpires) {
  failures.push('security.txt is missing the required Expires field.');
} else {
  const expiresAt = Date.parse(securityTxtExpires);
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const maxLifetime = 366 * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(expiresAt)) failures.push(`security.txt Expires is invalid: ${securityTxtExpires}`);
  else {
    if (expiresAt - now <= thirtyDays) failures.push('security.txt must be renewed before it is within 30 days of expiry.');
    if (expiresAt - now > maxLifetime) failures.push('security.txt Expires must remain within one year.');
  }
}

if (files.product.includes('first 100 completed purchases')) {
  failures.push('Product page still exposes the superseded first-100 launch cutoff.');
}
if (files.product.includes('payment-provider review')) {
  failures.push('Product page still treats provider review as the active checkout gate.');
}
if (files.checkout.includes('payment-provider review')) {
  failures.push('Checkout page still treats provider review as the active checkout gate.');
}
for (const name of ['product', 'preview', 'checkout']) {
  if (files[name].includes('replacement payment provider') || files[name].includes('replacement provider is selected')) {
    failures.push(`${name} still describes commerce as waiting for replacement-provider selection.`);
  }
}

const customerFacingFiles = ['product', 'preview', 'privacy', 'terms', 'refund', 'account', 'checkout'];
const supersededCommerceProviderNames = ['Paddle', 'FastSpring'];
for (const name of customerFacingFiles) {
  for (const provider of supersededCommerceProviderNames) {
    if (files[name].includes(provider)) failures.push(`${name} contains superseded provider-specific customer copy: ${provider}`);
  }
}

const approvedPublicTraderAddress = 'Str. Doctor Hacman nr. 28, bl. 83, sc. B, ap. 9, 240232 Râmnicu Vâlcea, România';
const approvedAddressFiles = new Set(['privacy', 'terms', 'refund', 'checkout']);
for (const name of approvedAddressFiles) {
  requireText(files[name], `${name} public trader disclosure`, [approvedPublicTraderAddress]);
}

const privateAddressFragments = ['Doctor Hacman', 'Bl. 83', 'Sc. B', 'Ap. 9'];
for (const [label, file] of Object.entries(files)) {
  const unapprovedText = approvedAddressFiles.has(label)
    ? file.replaceAll(approvedPublicTraderAddress, '')
    : file;
  for (const fragment of privateAddressFragments) {
    if (unapprovedText.includes(fragment)) {
      failures.push(`${label} exposes an address fragment outside the exact approved public trader disclosure: ${fragment}`);
    }
  }
}

if (failures.length) {
  console.error(`Domain readiness contract failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log('domain readiness contract pass');
