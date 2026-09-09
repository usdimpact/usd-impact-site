import { pathToFileURL } from 'node:url';
import {
  BLS_CALENDAR_USER_AGENT, BLS_CPI_RELEASE, BLS_CPI_SCHEDULE, confirmBlsMonthlySchedule,
  parseBlsCpiRelease, parseBlsCpiSchedule, readOfficialBlsHtml,
} from '../src/lib/bls-cpi-calendar.js';

// Explicit, read-only probe; injection is for trusted tests, never CLI input.
export async function runCalendarProbe(args, { read = readOfficialBlsHtml, write = console.log } = {}) {
  const period = args[0];
  if (args.length !== 1 || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(period ?? '')) {
    write('Usage: node scripts/probe-publication-calendar.mjs YYYY-MM');
    return 2;
  }
  const sources = [];
  const responses = [];
  let stage = 'schedule';
  const observe = (source) => { sources.push(source.evidence); responses.push(source.diagnostic); };
  try {
    const schedule = await read(BLS_CPI_SCHEDULE);
    observe(schedule);
    const event = parseBlsCpiSchedule(schedule.html, period);
    stage = 'monthly cross-check';
    const monthly = await read(`https://www.bls.gov/schedule/${event.eventDate.slice(0, 4)}/${event.eventDate.slice(5, 7)}_sched_list.htm`);
    observe(monthly);
    confirmBlsMonthlySchedule(monthly.html, event);
    stage = 'released artifact';
    const release = await read(BLS_CPI_RELEASE);
    observe(release);
    const latestRelease = parseBlsCpiRelease(release.html);
    write(JSON.stringify({ adapterProbe: 'PASS', event, latestRelease, sources, responses,
      requestIdentity: BLS_CALENDAR_USER_AGENT, publicationAttempted: false, publicationAuthorized: false }, null, 2));
    return 0;
  } catch (error) {
    // Never emit raw response headers/body, redirect destinations or exception text.
    write(JSON.stringify({ adapterProbe: error?.name === 'CalendarHold' ? error.code : 'HOLD_INTERNAL_ERROR', stage,
      reason: error?.name === 'CalendarHold' ? error.message : 'Read-only adapter probe failed.', sources, responses,
      sourceDiagnostic: error?.name === 'CalendarHold' ? error.sourceDiagnostic ?? null : null,
      requestIdentity: BLS_CALENDAR_USER_AGENT, publicationAttempted: false, publicationAuthorized: false,
    }, null, 2));
    return 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCalendarProbe(process.argv.slice(2));
}
