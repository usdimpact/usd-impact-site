function published(entries) {
  return entries.filter((entry) => entry.data.status === 'published');
}

function ascending(entries) {
  return [...entries].sort((a, b) => a.data.periodEnd.localeCompare(b.data.periodEnd));
}

function validFriday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.valueOf())
    && date.toISOString().slice(0, 10) === value
    && date.getUTCDay() === 5;
}

function nextFriday(value) {
  if (!validFriday(value)) return null;
  const date = new Date(value + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

export function monthlyEligibility(weeklyReports, monthlyReports) {
  const weekly = ascending(published(weeklyReports));
  const monthly = ascending(published(monthlyReports));
  const latestMonthlyEnd = monthly.at(-1)?.data.periodEnd ?? null;
  const eligible = latestMonthlyEnd
    ? weekly.filter((entry) => entry.data.periodEnd > latestMonthlyEnd)
    : weekly;

  // Monthly reports require four consecutive published Fridays. A gap must
  // remain visible instead of counting later editions as substitute inputs.
  const inputs = [];
  let expected = latestMonthlyEnd
    ? nextFriday(latestMonthlyEnd)
    : eligible[0]?.data.periodEnd ?? null;
  for (const entry of eligible) {
    if (inputs.length === 4 || !expected || !validFriday(entry.data.periodEnd)
      || entry.data.periodEnd !== expected) break;
    inputs.push(entry);
    expected = nextFriday(expected);
  }

  const nextRequiredPeriodEnd = inputs.length === 4 ? null : expected;
  const blockedByGap = Boolean(nextRequiredPeriodEnd && eligible.some(
    (entry) => entry.data.periodEnd > nextRequiredPeriodEnd,
  ));

  return {
    latestMonthlyEnd,
    eligible,
    inputs,
    progress: inputs.length,
    ready: inputs.length === 4,
    nextRequiredPeriodEnd,
    blockedByGap,
  };
}
