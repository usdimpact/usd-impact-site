import { getCollection } from 'astro:content';

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

export async function GET({ site }) {
  const origin = site?.origin ?? 'https://usd-impact.com';
  const editions = (await getCollection('news'))
    .filter((entry) => entry.data.status === 'published')
    .sort((a, b) => b.data.date.localeCompare(a.data.date))
    .slice(0, 30);

  const items = editions.map((entry) => `
    <item>
      <title>${escapeXml(entry.data.title)}</title>
      <link>${origin}${entry.data.slug}/</link>
      <guid isPermaLink="true">${origin}${entry.data.slug}/</guid>
      <pubDate>${new Date(`${entry.data.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeXml(entry.data.summary)}</description>
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
