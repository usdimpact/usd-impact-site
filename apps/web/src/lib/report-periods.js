function published(entries) {
  return entries.filter((entry) => entry.data.status === 'published');
}

function ascending(entries) {
  return [...entries].sort((a, b) => a.data.periodEnd.localeCompare(b.data.periodEnd));
}

export function monthlyEligibility(weeklyReports, monthlyReports) {
  const weekly = ascending(published(weeklyReports));
  const monthly = ascending(published(monthlyReports));
  const latestMonthlyEnd = monthly.at(-1)?.data.periodEnd ?? null;
  const eligible = latestMonthlyEnd
    ? weekly.filter((entry) => entry.data.periodEnd > latestMonthlyEnd)
    : weekly;
  const inputs = eligible.slice(0, 4);

  return {
    latestMonthlyEnd,
    eligible,
    inputs,
    progress: inputs.length,
    ready: inputs.length === 4,
  };
}
