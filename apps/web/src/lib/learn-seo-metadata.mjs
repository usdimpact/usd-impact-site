const SEO_TITLES = Object.freeze(new Map([
  ['card-real-yield', Object.freeze({
    slug: 'real-yield',
    title: 'What Is Real Yield? TIPS, Inflation and Why It Matters',
  })],
  ['card-treasury-coupon-vs-yield', Object.freeze({
    slug: 'treasury-coupon-rate-is-not-yield-to-maturity',
    title: 'Treasury Coupon Rate vs Yield to Maturity',
  })],
  ['card-bretton-woods-architecture', Object.freeze({
    slug: 'bretton-woods-dollar-centered-architecture',
    title: 'Bretton Woods: Dollar-Centered System',
  })],
  ['card-dollar-liquidity-gold-tension', Object.freeze({
    slug: 'global-dollar-liquidity-strained-gold-convertibility',
    title: 'Dollar Liquidity vs Gold Convertibility',
  })],
  ['card-gold-specific-demand-channels', Object.freeze({
    slug: 'gold-specific-demand-channels-beyond-macro',
    title: 'Gold Demand Beyond Dollar and Real Yields',
  })],
  ['card-dollar-international-role-multiple-measures', Object.freeze({
    slug: 'international-dollar-role-needs-multiple-measures',
    title: 'Measuring the Dollar’s Global Role',
  })],
  ['card-data-scope-matches-conclusion', Object.freeze({
    slug: 'match-data-scope-to-macro-conclusion',
    title: 'Match Data Scope to Macro Conclusion',
  })],
  ['card-nominal-real-dollar-index', Object.freeze({
    slug: 'nominal-vs-real-dollar-indexes',
    title: 'Nominal vs Real Dollar Indexes',
  })],
  ['card-oil-logistics-local-global-signals', Object.freeze({
    slug: 'oil-logistics-can-separate-local-and-global-signals',
    title: 'Oil Logistics: Local vs Global Signals',
  })],
  ['card-fiat-market-discipline', Object.freeze({
    slug: 'post-bretton-woods-discipline-became-market-mediated',
    title: 'Post-Bretton Woods Market Discipline',
  })],
  ['card-float-jamaica-formalization', Object.freeze({
    slug: 'floating-rates-before-jamaica-formalization',
    title: 'Floating Rates Before Jamaica',
  })],
]));

const SEO_DESCRIPTIONS = Object.freeze(new Map([
  ['card-real-yield', Object.freeze({
    slug: 'real-yield',
    description: 'Real yield is a return adjusted for inflation. Learn how TIPS, nominal yields and inflation expectations relate to real yields—and why the measure matters.',
  })],
]));

export function getLearnSeoTitle(card) {
  if (!card || typeof card !== 'object') return '';
  const fallback = `${card.title} | USD Impact Learn`;
  const entry = SEO_TITLES.get(card.id);
  if (!entry) return fallback;
  if (entry.slug !== card.slug || card.access !== 'open' || card.status !== 'ready-for-build') return fallback;
  return entry.title;
}

export function getLearnSeoDescription(card) {
  if (!card || typeof card !== 'object') return '';
  const fallback = typeof card.hook === 'string' ? card.hook : '';
  const entry = SEO_DESCRIPTIONS.get(card.id);
  if (!entry) return fallback;
  if (entry.slug !== card.slug || card.access !== 'open' || card.status !== 'ready-for-build') return fallback;
  return entry.description;
}
