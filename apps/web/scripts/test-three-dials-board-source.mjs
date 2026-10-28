import assert from 'node:assert/strict';
import { BOARD_ORIGIN, boardSeriesUrl, parseBoardCsv, parseCsvLine } from '../src/lib/three-dials-board-source.js';

const config = Object.freeze({
  releaseId: 'H10',
  packageId: 'synthetic-package-id',
  seriesCode: 'JRXWTFB_N.B',
  sourceSeriesId: 'H10/H10/JRXWTFB_N.B',
});

const csv = [
  'Series Description,"Nominal Broad U.S. Dollar Index, synthetic fixture"',
  'Unit:,Index',
  'Unique Identifier,H10/H10/JRXWTFB_N.B',
  'Time Period,JRXWTFB_N.B',
  '2026-10-02,119.50',
  '2026-10-09,120.10',
  '2026-10-16,ND',
  '2026-10-23,121.20',
  '2026-10-30,122.00',
].join('\n');

assert.deepEqual(
  parseCsvLine('Series Description,"value, with comma","escaped ""quote"""'),
  ['Series Description', 'value, with comma', 'escaped "quote"'],
);

const points = parseBoardCsv(
  csv,
  config,
  new Date('2026-10-09T00:00:00Z'),
  new Date('2026-10-23T00:00:00Z'),
);
assert.deepEqual(points, [
  { date: '2026-10-09', value: 120.10 },
  { date: '2026-10-23', value: 121.20 },
]);

assert.throws(
  () => parseBoardCsv(
    csv.replace('H10/H10/JRXWTFB_N.B', 'H10/H10/DIFFERENT_SERIES'),
    config,
    new Date('2026-10-09T00:00:00Z'),
    new Date('2026-10-23T00:00:00Z'),
  ),
  /package identity changed/,
);

assert.throws(
  () => parseBoardCsv(
    csv.replace('Time Period,JRXWTFB_N.B', 'Unexpected Header,JRXWTFB_N.B'),
    config,
    new Date('2026-10-09T00:00:00Z'),
    new Date('2026-10-23T00:00:00Z'),
  ),
  /missing the Time Period header/,
);

assert.throws(
  () => parseBoardCsv(
    csv.replace('Time Period,JRXWTFB_N.B', 'Time Period,OTHER_SERIES'),
    config,
    new Date('2026-10-09T00:00:00Z'),
    new Date('2026-10-23T00:00:00Z'),
  ),
  /response is missing JRXWTFB_N\.B/,
);

assert.throws(
  () => parseBoardCsv(
    csv,
    config,
    new Date('2026-10-16T00:00:00Z'),
    new Date('2026-10-16T00:00:00Z'),
  ),
  /did not provide two usable/,
);

assert.throws(
  () => parseCsvLine('a,"unterminated'),
  /unterminated quoted field/,
);

const url = boardSeriesUrl(config);
assert.equal(url.origin, BOARD_ORIGIN);
assert.equal(url.pathname, '/datadownload/Output.aspx');
assert.equal(url.searchParams.get('rel'), 'H10');
assert.equal(url.searchParams.get('series'), 'synthetic-package-id');
assert.equal(url.searchParams.get('lastObs'), '50');
assert.equal(url.searchParams.get('filetype'), 'csv');
assert.equal(url.searchParams.get('label'), 'include');
assert.equal(url.searchParams.get('layout'), 'seriescolumn');
assert.equal(url.searchParams.get('type'), 'package');
assert.doesNotMatch(url.toString(), /fred\.stlouisfed\.org|fredgraph/i);

console.log('Three Dials Board-direct synthetic parser/identity tests passed.');
