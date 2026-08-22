import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const files = {
  layout: read('src/layouts/BaseLayout.astro'),
  product: read('src/content/products/book-read-the-dollar-first.md'),
  privacy: read('src/pages/privacy.md'),
  terms: read('src/pages/terms.md'),
  refund: read('src/pages/refund-policy.md'),
  account: read('src/pages/account/index.astro'),
  checkout: read('src/pages/checkout/index.astro'),
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
  'Planned launch price: USD 39.00',
  'Planned standard price: USD 49.00',
  'No launch window or quantity cutoff is currently active.',
  'one-time',
  'ongoing access',
  'replacement provider is selected, integrated, tested, and approved for Live use',
  'verified commercial event',
]);
requireText(files.terms, 'Terms', ['SC Kela Leads SRL', '40790448', 'J38/820/2020', 'support@usd-impact.com']);
requireText(files.terms, 'Terms', ['authorized payment provider', 'identified during checkout']);
requireText(files.refund, 'Refund Policy', ['14 calendar days', 'full refund', 'support@usd-impact.com', 'payment provider']);
requireText(files.privacy, 'Privacy Notice', ['authorized payment provider', 'Supabase', 'SC Kela Leads SRL', 'support@usd-impact.com']);
requireText(files.checkout, 'Checkout page', [
  'Checkout is not open yet.',
  'ready to connect',
  'Public payment remains disabled',
  'No payment can be made on this page',
  '/api/commerce-readiness',
  'browser redirect alone never grants access',
]);

if (files.product.includes('first 100 completed purchases')) {
  failures.push('Product page still exposes the superseded first-100 launch cutoff.');
}
if (files.product.includes('payment-provider review')) {
  failures.push('Product page still treats provider review as the active checkout gate.');
}
if (files.checkout.includes('payment-provider review')) {
  failures.push('Checkout page still treats provider review as the active checkout gate.');
}

const customerFacingFiles = ['product', 'privacy', 'terms', 'refund', 'account', 'checkout'];
const commerceProviderNames = ['Paddle', 'FastSpring'];
for (const name of customerFacingFiles) {
  for (const provider of commerceProviderNames) {
    if (files[name].includes(provider)) failures.push(`${name} contains provider-specific customer copy: ${provider}`);
  }
}

const privateAddressFragments = ['Doctor Hacman', 'Bl. 83', 'Sc. B', 'Ap. 9'];
for (const [label, file] of Object.entries(files)) {
  for (const fragment of privateAddressFragments) {
    if (file.includes(fragment)) failures.push(`${label} exposes a private registered-address fragment: ${fragment}`);
  }
}

if (failures.length) {
  console.error(`Domain readiness contract failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log('domain readiness contract pass');
