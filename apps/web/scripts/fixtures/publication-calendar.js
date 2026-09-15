// Synthetic contract fixtures, not saved live HTML and never publication evidence.
// Calendar values checked against BLS on 2026-09-09:
// https://www.bls.gov/schedule/news_release/cpi.htm
// https://www.bls.gov/schedule/2026/09_sched_list.htm
// https://www.bls.gov/news.release/cpi.nr0.htm
export const fixtureProvenance = 'synthetic HTML based on the documented BLS table/summary contract';
export const candidate = Object.freeze({
  publisher: 'BLS', series: 'CPI', referencePeriod: '2026-08', releaseStage: 'initial',
  event: 'BLS Consumer Price Index (CPI) for August 2026', eventDate: '2026-09-11',
  releaseTime: '08:30', timeZone: 'America/New_York', releaseAt: '2026-09-11T12:30:00Z',
  phase: 'preview', statusLabel: 'scheduled-confirmed',
});
export const scheduleHtml = `<h2>Schedule of Releases for the Consumer Price Index</h2>
<table><thead><tr><th>Reference Month</th><th>Release Date</th><th>Release Time</th></tr></thead><tbody>
<tr><td>December 2025</td><td>Jan. 13, 2026</td><td>08:30 AM</td></tr>
<tr><td>July 2026</td><td>Aug. 12, 2026</td><td>08:30 AM</td></tr>
<tr><td>August 2026</td><td>Sep. 11, 2026</td><td>08:30 AM</td></tr>
<tr><td>September 2026</td><td>Oct. 14, 2026</td><td>08:30 AM</td></tr>
<tr><td>October 2026</td><td>Nov. 10, 2026</td><td>08:30 AM</td></tr>
</tbody></table>`;
export const monthlyHtml = `<h1>September 2026</h1><table><tr><th>Date</th><th>Time</th><th>Release</th></tr>
<tr><td>Thursday, September 10, 2026</td><td>08:30 AM</td><td>Producer Price Index for August 2026</td></tr>
<tr><td>Friday, September 11, 2026</td><td>08:30 AM</td><td><a href="/cpi/">Consumer Price Index</a> for August 2026</td></tr>
<tr><td>Friday, September 11, 2026</td><td>08:30 AM</td><td>Real Earnings for August 2026</td></tr>
</table><p>NOTE: All times on calendar are Eastern Time.</p>`;
export function releaseHtml(period = 'JULY 2026', stamp = 'Wednesday, August 12, 2026') {
  return `<h1>Consumer Price Index Summary</h1><pre>
Transmission of material in this release is embargoed until
8:30 a.m. (ET) ${stamp} USDL-26-TEST
CONSUMER PRICE INDEX - ${period}
The Consumer Price Index for All Urban Consumers (CPI-U) increased 0.1 percent.
The U.S. Bureau of Labor Statistics reported today. This is a synthetic test statement.
</pre>`;
}
export const binding = Object.freeze({ repository: 'usdimpact/usd-impact-site', base: 'a'.repeat(40), head: 'b'.repeat(40), contentSha256: 'c'.repeat(64) });
