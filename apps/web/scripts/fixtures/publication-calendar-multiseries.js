// Explicitly synthetic release fixtures. Dates mirror dated official schedule observations,
// but these hand-authored HTML strings are never fresh primary-source evidence.
import { BLS_MONTHLY_SERIES } from '../../src/lib/publication-calendar-series.js';
import { localReleaseInstant } from '../../src/lib/publication-calendar.js';
export const releaseDates = Object.freeze({ CPI: '2026-09-11', PPI: '2026-09-10', EMPSIT: '2026-09-04' });
export function englishDate(date) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00Z`));
}
export function multiCandidate(series) {
  return { publisher: 'BLS', series, referencePeriod: '2026-08', releaseStage: 'initial',
    event: `BLS ${BLS_MONTHLY_SERIES[series].name} for August 2026`, eventDate: releaseDates[series],
    releaseTime: '08:30', timeZone: 'America/New_York', releaseAt: localReleaseInstant(releaseDates[series], '08:30'),
    phase: 'preview', statusLabel: 'scheduled-confirmed' };
}
export function multiSchedule(series) {
  return `<h1>Schedule of Releases for the ${BLS_MONTHLY_SERIES[series].name}</h1>
<table><tr><td><table><tr><th>Reference Month</th><th>Release Date</th><th>Release Time</th></tr>
<tr><td>August 2026</td><td>${englishDate(releaseDates[series])}</td><td>08:30 AM</td></tr></table></td></tr></table>`;
}
export function multiMonthly() {
  return `<p>All times on calendar are Eastern Time</p><table><tr><td><table>
<tr><th>Date</th><th>Time</th><th>Release</th></tr>
${Object.entries(BLS_MONTHLY_SERIES).map(([series, definition]) => `<tr><td>${englishDate(releaseDates[series])}</td><td>08:30 AM</td><td>${definition.name} for August 2026</td></tr>`).join('')}
<tr><td>Friday, September 11, 2026</td><td>08:30 AM</td><td>Real Earnings for August 2026</td></tr>
</table></td></tr></table>`;
}
export function multiRelease(series, { period = 'AUGUST 2026', date = releaseDates[series], number = 'USDL-26-1000' } = {}) {
  const definition = BLS_MONTHLY_SERIES[series];
  return `<pre>Transmission of material in this ${definition.news ? 'news ' : ''}release is embargoed until ${number}
8:30 a.m. (ET) ${englishDate(date)}
${definition.resultHeading} - ${period}
${definition.resultLead} increased in the reference month, the U.S. Bureau of Labor Statistics reported today.</pre>`;
}
export function multiFetch({ released = false, scheduleSeries, releaseSeries, alter = (html) => html, observe = () => {} } = {}) {
  return async (url, options) => {
    observe(url, options);
    const path = new URL(url).pathname;
    let html;
    if (path === '/schedule/2026/09_sched_list.htm') html = multiMonthly();
    else {
      const entry = Object.entries(BLS_MONTHLY_SERIES).find(([, definition]) => path.endsWith(`/${definition.slug}.htm`) || path.endsWith(`/${definition.slug}.nr0.htm`));
      if (!entry) throw new Error('Unexpected fixture URL');
      const [series] = entry;
      html = path.startsWith('/schedule/') ? multiSchedule(scheduleSeries ?? series)
        : multiRelease(releaseSeries ?? series, released ? {} : { period: 'JULY 2026', date: '2026-08-12' });
    }
    return new Response(alter(html, path), { headers: { 'Content-Type': 'text/html' } });
  };
}
