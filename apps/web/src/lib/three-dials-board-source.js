export const BOARD_ORIGIN = 'https://www.federalreserve.gov';

function isoDate(value) {
  return value.toISOString().slice(0, 10);
}

export function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }
  if (quoted) throw new Error('Federal Reserve Board CSV contains an unterminated quoted field.');
  values.push(value.trim());
  return values;
}

export function parseBoardCsv(text, config, startDate, endDate) {
  const rows = text.trim().split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  const headerIndex = rows.findIndex((row) => (row[0] ?? '').replace(/^\uFEFF/, '').trim() === 'Time Period');
  if (headerIndex < 0) throw new Error(`Federal Reserve Board ${config.releaseId} response is missing the Time Period header.`);

  const header = rows[headerIndex];
  const valueIndex = header.indexOf(config.seriesCode);
  if (valueIndex < 1) throw new Error(`Federal Reserve Board ${config.releaseId} response is missing ${config.seriesCode}.`);

  const identifierRow = rows.slice(0, headerIndex).find((row) => (row[0] ?? '').trim().startsWith('Unique Identifier'));
  if (!identifierRow || identifierRow[valueIndex] !== config.sourceSeriesId) {
    throw new Error(`Federal Reserve Board ${config.releaseId} package identity changed for ${config.seriesCode}.`);
  }

  const start = isoDate(startDate);
  const end = isoDate(endDate);
  const points = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const date = (row[0] ?? '').trim();
    const raw = (row[valueIndex] ?? '').trim();
    const numeric = Number(raw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < start || date > end) continue;
    if (raw === 'ND' || raw === 'N/A' || raw === 'n.a.' || !Number.isFinite(numeric)) continue;
    points.push({ date, value: numeric });
  }
  if (points.length < 2) {
    throw new Error(`Federal Reserve Board ${config.releaseId} did not provide two usable ${config.seriesCode} observations in the requested window.`);
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export function boardSeriesUrl(config) {
  const url = new URL('/datadownload/Output.aspx', BOARD_ORIGIN);
  url.searchParams.set('rel', config.releaseId);
  url.searchParams.set('series', config.packageId);
  url.searchParams.set('lastObs', '50');
  url.searchParams.set('from', '');
  url.searchParams.set('to', '');
  url.searchParams.set('filetype', 'csv');
  url.searchParams.set('label', 'include');
  url.searchParams.set('layout', 'seriescolumn');
  url.searchParams.set('type', 'package');
  return url;
}
