import { getCollection } from 'astro:content';
import { progressEmailMeaningfulChangeRegistry } from '../../../data/progress-email-meaningful-changes.js';
import { buildProgressEmailQaSourceArtifact } from '../../../lib/progress-email-qa-source-artifact.js';

export const prerender = true;

export async function getStaticPaths() {
  const reports = (await getCollection('weeklyReports'))
    .filter((entry) => entry.data.status === 'published');
  const reportsByPeriod = new Map(reports.map((entry) => [entry.data.periodEnd, entry.data]));
  const sourceReports = [...new Set(progressEmailMeaningfulChangeRegistry.map((entry) => entry.sourceId))]
    .map((sourceId) => reportsByPeriod.get(sourceId))
    .filter(Boolean);

  return reports.map((entry) => ({
    params: { date: entry.data.periodEnd },
    props: {
      currentWeeklyReport: entry.data,
      sourceReports,
    },
  }));
}

export async function GET({
  props,
}: {
  props: {
    currentWeeklyReport: unknown;
    sourceReports: unknown[];
  };
}) {
  const artifact = buildProgressEmailQaSourceArtifact({
    currentWeeklyReport: props.currentWeeklyReport,
    sourceReports: props.sourceReports,
  });

  return new Response(`${JSON.stringify(artifact)}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
