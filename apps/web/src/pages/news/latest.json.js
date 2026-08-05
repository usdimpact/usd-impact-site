import { getCollection } from 'astro:content';
import { hasCatalystBriefFiles } from '../../lib/catalyst-brief-content.js';

export async function GET() {
  const editions = (await getCollection('news'))
    .filter((entry) => entry.data.status === 'published')
    .sort((a, b) => b.data.date.localeCompare(a.data.date));

  const latest = editions[0];
  const catalystBriefs = hasCatalystBriefFiles
    ? (await getCollection('catalystBriefs'))
      .filter((entry) => entry.data.status === 'published')
      .sort((a, b) => b.data.generatedAt.localeCompare(a.data.generatedAt))
      .slice(0, 10)
      .map((entry) => ({
      title: entry.data.title,
      slug: entry.data.slug,
      event: entry.data.event,
      eventDate: entry.data.eventDate,
      phase: entry.data.phase,
      generatedAt: entry.data.generatedAt,
      statusLabel: entry.data.statusLabel,
      summary: entry.data.summary,
      }))
    : [];
  if (!latest) {
    return new Response(JSON.stringify({ edition: null, catalystBriefs }), {
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
    catalystBriefs,
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
    },
  });
}
