import { getCollection } from 'astro:content';
import { hasCatalystBriefFiles } from '../../lib/catalyst-brief-content.js';

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

// RSS pubDate is optional (https://www.rssboard.org/rss-specification).
// These collections have editorial dates and preparation times, not verified
// first-publication instants. Omit pubDate and lastBuildDate rather than invent
// them from noon, generatedAt, a Git commit, or the current build clock.
// sortKey preserves legacy feed order only; it is never a publication timestamp.
export async function GET({ site }) {
  const origin = site?.origin ?? 'https://usd-impact.com';
  const editions = (await getCollection('news'))
    .filter((entry) => entry.data.status === 'published')
    .map((entry) => ({
      title: entry.data.title,
      slug: entry.data.slug,
      sortKey: `${entry.data.date}T12:00:00Z`,
      summary: entry.data.summary,
    }));
  const catalystBriefs = hasCatalystBriefFiles
    ? (await getCollection('catalystBriefs'))
      .filter((entry) => entry.data.status === 'published')
      .map((entry) => ({
      title: entry.data.title,
      slug: entry.data.slug,
      sortKey: entry.data.generatedAt,
      summary: entry.data.summary,
      }))
    : [];
  const publications = [...editions, ...catalystBriefs]
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .slice(0, 30);

  const items = publications.map((entry) => `
    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>${origin}${entry.slug}/</link>
      <guid isPermaLink="true">${origin}${entry.slug}/</guid>
      <description>${escapeXml(entry.summary)}</description>
    </item>`).join('');

  return new Response(`<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Daily USD Impact</title>
    <link>${origin}/news/</link>
    <description>Source-backed daily cross-asset market highlights from USD Impact.</description>
    <language>en</language>
    ${items}
  </channel>
</rss>`, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
    },
  });
}
