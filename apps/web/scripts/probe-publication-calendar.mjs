import {
  BLS_CPI_RELEASE, BLS_CPI_SCHEDULE, confirmBlsMonthlySchedule,
  parseBlsCpiRelease, parseBlsCpiSchedule, readOfficialBlsHtml,
} from '../src/lib/bls-cpi-calendar.js';

// Explicit, read-only adapter probe. It is not part of normal builds or publication.
const period = process.argv[2];
if (process.argv.length !== 3 || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(period ?? '')) {
  console.error('Usage: node scripts/probe-publication-calendar.mjs YYYY-MM');
  process.exitCode = 2;
} else {
  const sources = [];
  let stage = 'schedule';
  let html = '';
  try {
    const schedule = await readOfficialBlsHtml(BLS_CPI_SCHEDULE);
    html = schedule.html;
    sources.push(schedule.evidence);
    const event = parseBlsCpiSchedule(html, period);
    stage = 'monthly cross-check';
    const monthly = await readOfficialBlsHtml(`https://www.bls.gov/schedule/${event.eventDate.slice(0, 4)}/${event.eventDate.slice(5, 7)}_sched_list.htm`);
    html = monthly.html;
    sources.push(monthly.evidence);
    confirmBlsMonthlySchedule(html, event);
    stage = 'released artifact';
    const release = await readOfficialBlsHtml(BLS_CPI_RELEASE);
    html = release.html;
    sources.push(release.evidence);
    const latestRelease = parseBlsCpiRelease(html);
    console.log(JSON.stringify({ adapterProbe: 'PASS', event, latestRelease, sources, publicationAttempted: false, publicationAuthorized: false }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ adapterProbe: error?.code ?? 'HOLD_INTERNAL_ERROR', stage,
      reason: error?.name === 'CalendarHold' ? error.message : 'Read-only adapter probe failed.', sources,
      // Bounded public markup only, to diagnose a changed source contract. No private headers or errors.
      publicMarkupExcerpt: html.slice(html.search(/<table\b|<pre\b/i) >>> 0).slice(0, 2048),
      publicationAttempted: false, publicationAuthorized: false,
    }, null, 2));
    process.exitCode = 2;
  }
}
