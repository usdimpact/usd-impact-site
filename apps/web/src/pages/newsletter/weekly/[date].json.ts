import { getCollection } from 'astro:content';
import { buildWeeklyNewsletterPayload } from '../../../lib/weekly-newsletter-contract.js';
import { buildWeeklyNewsletterEditionArtifact } from '../../../lib/weekly-newsletter-edition.js';

export const prerender = true;

export async function getStaticPaths() {
  const reports = (await getCollection('weeklyReports'))
    .filter((entry) => entry.data.status === 'published');

  return reports.map((entry) => ({
    params: { date: entry.data.periodEnd },
    props: { weeklyReport: entry.data },
  }));
}

export async function GET({ props }: { props: { weeklyReport: unknown } }) {
  const payload = buildWeeklyNewsletterPayload({ weeklyReport: props.weeklyReport });
  const artifact = buildWeeklyNewsletterEditionArtifact(payload);

  return new Response(`${JSON.stringify(artifact)}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
