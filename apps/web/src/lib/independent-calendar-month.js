// Independent free educational calendar-month reporting only.
// This module never reads or qualifies original Score-derived weekly/monthly data.
// Editorial/source-rights approvals remain independent and fail-closed.
function isoUtc(date) {
  return date.toISOString().slice(0, 10);
}

export function independentCalendarMonth(year, month) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100
      || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('Independent Monthly requires a valid calendar year and month.');
  }
  const first = new Date(Date.UTC(year, month - 1, 1, 12));
  const last = new Date(Date.UTC(year, month, 0, 12));
  const fridayEnds = [];
  for (let day = 1; day <= last.getUTCDate(); day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    if (date.getUTCDay() === 5) fridayEnds.push(isoUtc(date));
  }
  return Object.freeze({
    year,
    month,
    periodStart: isoUtc(first),
    periodEnd: isoUtc(last),
    fridayEnds: Object.freeze(fridayEnds),
    expectedFridayCount: fridayEnds.length,
    sourceFamily: 'independent_macro_education',
    releaseAuthorized: false,
  });
}

export function assessIndependentMonthlyCoverage({
  year, month, asOfDate, publishedIndependentFridayEnds = [],
}) {
  const calendar = independentCalendarMonth(year, month);
  if (typeof asOfDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)
      || !Number.isFinite(Date.parse(asOfDate + 'T12:00:00Z'))
      || isoUtc(new Date(asOfDate + 'T12:00:00Z')) !== asOfDate) {
    throw new RangeError('A valid ISO asOfDate is required.');
  }
  if (!Array.isArray(publishedIndependentFridayEnds)) {
    throw new TypeError('Independent Weekly provenance must be an explicit array.');
  }
  const eligibleFridays = new Set(calendar.fridayEnds);
  const published = new Set();
  for (const date of publishedIndependentFridayEnds) {
    if (typeof date !== 'string' || !eligibleFridays.has(date) || published.has(date)) {
      throw new Error('A published independent Weekly date is duplicated or outside this calendar month.');
    }
    published.add(date);
  }
  return Object.freeze({
    ...calendar,
    calendarClosed: asOfDate > calendar.periodEnd,
    publishedIndependentFridays: Object.freeze([...published].sort()),
    missingIndependentFridays: Object.freeze(
      calendar.fridayEnds.filter((date) => !published.has(date)),
    ),
    observedWeeklyCount: published.size,
    // Missing Weeklies must be disclosed, never invented; they do NOT block a
    // separate dated-official-source monthly editorial preview.
    mayPrepareEditorialPreview: asOfDate > calendar.periodEnd,
    // No implied source rights, market data permission, editorial signoff or
    // actual release from a calendar calculation.
    releaseAuthorized: false,
  });
}
