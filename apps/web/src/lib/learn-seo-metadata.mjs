const SEO_TITLES = Object.freeze(new Map([
  ['card-real-yield', Object.freeze({
    slug: 'real-yield',
    title: 'What Is Real Yield? TIPS, Inflation and Why It Matters',
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
