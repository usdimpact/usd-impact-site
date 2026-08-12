import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const files = {
  layout: read('src/layouts/BaseLayout.astro'),
  product: read('src/content/products/book-read-the-dollar-first.md'),
  privacy: read('src/pages/privacy.md'),
  terms: read('src/pages/terms.md'),
  refund: read('src/pages/refund-policy.md'),
  accessRequired: read('src/pages/account/access-required/index.astro'),
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
  'USD 39.00',
  'USD 49.00',
  'first 100 completed purchases',
  'one-time',
  'ongoing access',
]);
requireText(files.terms, 'Terms', ['SC Kela Leads SRL', '40790448', 'J38/820/2020', 'support@usd-impact.com']);
requireText(files.refund, 'Refund Policy', ['Library Pass', 'Guided Interactive Edition', 'audiobook', '14 calendar days', 'full refund', 'support@usd-impact.com', 'Paddle']);
requireText(files.privacy, 'Privacy Notice', ['Library Pass', 'private audiobook masters', 'Paddle', 'Supabase', 'SC Kela Leads SRL', 'support@usd-impact.com']);
requireText(files.accessRequired, 'Access required page', ['Library Pass required', 'Guided Interactive Edition', 'complete English audiobook']);

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
