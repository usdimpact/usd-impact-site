import { fetchBoardReleaseSeries } from '../src/lib/three-dials-board-release-xml.js';

const sources = [
  {
    releaseId: 'H10',
    zipUrl: 'https://www.federalreserve.gov/releases/h10/data/FRB_h10_xml.zip',
    dataFile: 'H10_data.xml',
    seriesName: 'JRXWTFB_N.B',
    requiredAttributes: { FREQ: '9', UNIT: 'Index:_1997_Jan_100' },
  },
  {
    releaseId: 'H15',
    zipUrl: 'https://www.federalreserve.gov/releases/h15/data/FRB_h15_xml.zip',
    dataFile: 'H15_data.xml',
    seriesName: 'RIFLGFCY10_XII_N.B',
    requiredAttributes: { FREQ: '9', INSTRUMENT: 'TCMII', MATURITY: 'Y10', UNIT: 'Percent:_Per_Year' },
  },
  {
    releaseId: 'PRATES',
    zipUrl: 'https://www.federalreserve.gov/releases/prates/data/FRB_PRATES_xml.zip',
    dataFile: 'PRATES_data.xml',
    seriesName: 'RESBM_N.D',
    requiredAttributes: { FREQ: '8', UNIT: 'Percent' },
  },
];

const startDate = new Date('2026-10-01T00:00:00Z');
const endDate = new Date('2026-10-24T00:00:00Z');

const results = [];
for (const config of sources) {
  const points = await fetchBoardReleaseSeries(config, startDate, endDate);
  results.push({
    release: config.releaseId,
    seriesName: config.seriesName,
    count: points.length,
    firstDate: points[0].date,
    lastDate: points.at(-1).date,
  });
}

// Deliberately never log OBS_VALUE or any derived numeric observation.
console.log(JSON.stringify({
  proof: 'three-dials-fed-release-xml-live-adapter/v1',
  observationValuesEmitted: false,
  range: { start: '2026-10-01', end: '2026-10-24' },
  results,
}, null, 2));
