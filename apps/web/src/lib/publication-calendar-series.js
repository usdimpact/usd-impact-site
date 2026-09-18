/** Fixed issuer/series registry. A recognized label is not verified source evidence. */
export const BLS_MONTHLY_SERIES = Object.freeze({
  CPI: Object.freeze({ slug: 'cpi', name: 'Consumer Price Index',
    label: /^BLS Consumer Price Index(?: \(CPI\))? for ([A-Za-z]+ 20\d{2})$/,
    mention: /\b(?:CPI|Consumer Price Index)\b/i,
    resultHeading: 'CONSUMER PRICE INDEX',
    resultLead: 'The Consumer Price Index for All Urban Consumers (CPI-U)', news: false }),
  PPI: Object.freeze({ slug: 'ppi', name: 'Producer Price Index',
    label: /^BLS Producer Price Index(?: \(PPI\))? for ([A-Za-z]+ 20\d{2})$/,
    mention: /\b(?:PPI|Producer Price Index(?:es)?)\b/i,
    resultHeading: 'PRODUCER PRICE INDEXES',
    resultLead: 'The Producer Price Index for final demand', news: false }),
  EMPSIT: Object.freeze({ slug: 'empsit', name: 'Employment Situation',
    label: /^BLS Employment Situation for ([A-Za-z]+ 20\d{2})$/,
    mention: /\b(?:Employment Situation|nonfarm payrolls?)\b/i,
    resultHeading: 'THE EMPLOYMENT SITUATION',
    resultLead: 'Total nonfarm payroll employment', news: true }),
});
export function blsMonthlyDefinition(series) {
  return typeof series === 'string' && Object.hasOwn(BLS_MONTHLY_SERIES, series) ? BLS_MONTHLY_SERIES[series] : null;
}
export function explicitBlsMonthlyLabel(event) {
  if (typeof event !== 'string' || event.length > 500) return null;
  for (const [series, definition] of Object.entries(BLS_MONTHLY_SERIES)) {
    const match = event.match(definition.label);
    if (match) return Object.freeze({ publisher: 'BLS', series, referenceText: match[1], releaseStage: 'initial' });
  }
  return null;
}
export function mentionsSupportedBlsSeries(text) {
  return typeof text === 'string' && Object.entries(BLS_MONTHLY_SERIES).some(([, definition]) => definition.mention.test(text));
}
