import { getCollection } from 'astro:content';

export async function GET() {
  const editions = (await getCollection('news'))
    .filter((entry) => entry.data.status === 'published')
    .sort((a, b) => b.data.date.localeCompare(a.data.date));

  const latest = editions[0];
  if (!latest) {
    return new Response(JSON.stringify({ edition: null }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const { title, slug, date, generatedAt, lastReviewed, marketRegime, summary, assets, highlights, catalysts, sources } = latest.data;
  return new Response(JSON.stringify({
    edition: {
      title,
      slug,
      date,
      generatedAt,
      lastReviewed,
      marketRegime,
      summary,
      assets,
      highlights,
      catalysts,
      sources,
    },
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
    },
  });
}
