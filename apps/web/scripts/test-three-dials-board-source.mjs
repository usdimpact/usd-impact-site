import assert from 'node:assert/strict';
import { BOARD_ORIGIN, boardSeriesUrl, parseBoardCsv, parseCsvLine } from '../src/lib/three-dials-board-source.js';

const config = Object.freeze({
  releaseId: 'H10',
  packageId: 'synthetic-package-id',
  seriesCode: 'JRXWTFB_N.B',
  sourceSeriesId: 'H10/H10/JRXWTFB_N.B',
});

const csv = [
  'Series,Series Description,2026-10-02,2026-10-09,2026-10-16,2026-10-23,2026-10-30',
  'JRXWTFB_N.B,"Nominal Broad U.S. Dollar Index, synthetic fixture",119.50,120.10,ND,121.20,122.00',
  'JRXWTFN_N.B,Nominal Advanced Foreign Economies Dollar Index,100.00,100.10,100.20,100.30,100.40',
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
    csv.replace('JRXWTFB_N.B,"Nominal Broad', 'DIFFERENT_SERIES,"Nominal Broad'),
    config,
    new Date('2026-10-09T00:00:00Z'),
    new Date('2026-10-23T00:00:00Z'),
  ),
  /exactly one JRXWTFB_N\.B row; found 0/,
);

assert.throws(
  () => parseBoardCsv(
    csv.replace('Series,Series Description', 'Unexpected,Header'),
    config,
    new Date('2026-10-09T00:00:00Z'),
    new Date('2026-10-23T00:00:00Z'),
  ),
  /response header is unexpected/,
);

assert.throws(
  () => parseBoardCsv(
    csv.replace('2026-10-16,2026-10-23', 'NOT_A_DATE,2026-10-23'),
    config,
    new Date('2026-10-09T00:00:00Z'),
    new Date('2026-10-23T00:00:00Z'),
  ),
  /missing usable Time Period columns/,
);

assert.throws(
  () => parseBoardCsv(
    `${csv}\nJRXWTFB_N.B,Duplicate series,1,2,3,4,5`,
    config,
    new Date('2026-10-09T00:00:00Z'),
    new Date('2026-10-23T00:00:00Z'),
  ),
  /exactly one JRXWTFB_N\.B row; found 2/,
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
assert.equal(url.searchParams.get('lastobs'), '50');
assert.equal(url.searchParams.get('filetype'), 'csv');
assert.equal(url.searchParams.get('label'), 'include');
assert.equal(url.searchParams.get('layout'), 'seriescolumn');
assert.equal(url.searchParams.has('type'), false, 'Board Output.aspx download URL must not carry the incompatible type=package query parameter.');
assert.doesNotMatch(url.toString(), /fred\.stlouisfed\.org|fredgraph/i);

console.log('Three Dials Board-direct synthetic parser/identity tests passed.');
