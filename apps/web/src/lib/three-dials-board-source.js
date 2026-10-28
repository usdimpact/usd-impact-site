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
  if (!rows.length) throw new Error(`Federal Reserve Board ${config.releaseId} response is empty.`);

  const header = rows[0].map((value) => value.replace(/^\uFEFF/, '').trim());
  if (header[0] !== 'Series' || header[1] !== 'Series Description') {
    throw new Error(`Federal Reserve Board ${config.releaseId} response header is unexpected.`);
  }

  const dateColumns = header.slice(2);
  if (dateColumns.length < 2 || dateColumns.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    throw new Error(`Federal Reserve Board ${config.releaseId} response is missing usable Time Period columns.`);
  }

  const matches = rows.slice(1).filter((row) => (row[0] ?? '').trim() === config.seriesCode);
  if (matches.length !== 1) {
    throw new Error(`Federal Reserve Board ${config.releaseId} response must contain exactly one ${config.seriesCode} row; found ${matches.length}.`);
  }

  const row = matches[0];
  const start = isoDate(startDate);
  const end = isoDate(endDate);
  const points = [];
  for (let index = 0; index < dateColumns.length; index += 1) {
    const date = dateColumns[index];
    const raw = (row[index + 2] ?? '').trim();
    const numeric = Number(raw);
    if (date < start || date > end) continue;
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
  url.searchParams.set('lastobs', '50');
  url.searchParams.set('from', '');
  url.searchParams.set('to', '');
  url.searchParams.set('filetype', 'csv');
  url.searchParams.set('label', 'include');
  url.searchParams.set('layout', 'seriescolumn');
  return url;
}
