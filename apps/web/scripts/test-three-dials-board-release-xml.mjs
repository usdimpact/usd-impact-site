import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BOARD_RELEASE_ORIGIN,
  extractZipEntry,
  parseBoardReleaseXml,
} from '../src/lib/three-dials-board-release-xml.js';

function storedZip(entryName, content) {
  const name = Buffer.from(entryName);
  const data = Buffer.from(content);
  const local = Buffer.alloc(30 + name.length + data.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  name.copy(local, 30);
  data.copy(local, 30 + name.length);

  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(0, 42);
  name.copy(central, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([local, central, eocd]);
}

const h15Config = {
  releaseId: 'H15',
  seriesName: 'RIFLGFCY10_XII_N.B',
  requiredAttributes: {
    FREQ: '9',
    INSTRUMENT: 'TCMII',
    MATURITY: 'Y10',
    UNIT: 'Percent:_Per_Year',
  },
};

const syntheticXml = `<?xml version="1.0"?>
<message:MessageGroup>
  <kf:Series FREQ="21" INSTRUMENT="TCMII" MATURITY="Y10" SERIES_NAME="RIFLGFCY10_XII_N.WF" UNIT="Percent:_Per_Year">
    <frb:Obs TIME_PERIOD="2026-10-16" OBS_VALUE="2.20" OBS_STATUS="A"/>
  </kf:Series>
  <kf:Series FREQ="9" INSTRUMENT="TCMII" MATURITY="Y10" SERIES_NAME="RIFLGFCY10_XII_N.B" UNIT="Percent:_Per_Year">
    <frb:Obs TIME_PERIOD="2026-10-15" OBS_VALUE="2.11" OBS_STATUS="A"/>
    <frb:Obs TIME_PERIOD="2026-10-16" OBS_VALUE="2.12" OBS_STATUS="A"/>
    <frb:Obs TIME_PERIOD="2026-10-19" OBS_VALUE="2.13" OBS_STATUS="A"/>
    <frb:Obs TIME_PERIOD="2026-10-20" OBS_VALUE="ND" OBS_STATUS="ND"/>
  </kf:Series>
</message:MessageGroup>`;

test('extractZipEntry accepts the exact bounded XML entry', () => {
  const zip = storedZip('H15_data.xml', syntheticXml);
  assert.equal(extractZipEntry(zip, 'H15_data.xml').toString('utf8'), syntheticXml);
  assert.throws(() => extractZipEntry(zip, '../H15_data.xml'), /entry name is invalid/);
  assert.throws(() => extractZipEntry(zip, 'missing.xml'), /missing missing\.xml/);
});

test('parseBoardReleaseXml selects only the exact daily series and requested dates', () => {
  const points = parseBoardReleaseXml(
    syntheticXml,
    h15Config,
    new Date('2026-10-16T00:00:00Z'),
    new Date('2026-10-23T00:00:00Z'),
  );
  assert.deepEqual(points, [
    { date: '2026-10-16', value: 2.12 },
    { date: '2026-10-19', value: 2.13 },
  ]);
});

test('parseBoardReleaseXml fails closed on identity and schema drift', () => {
  assert.throws(
    () => parseBoardReleaseXml(
      syntheticXml,
      { ...h15Config, seriesName: 'WRONG' },
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-23T00:00:00Z'),
    ),
    /exactly one WRONG series/,
  );

  assert.throws(
    () => parseBoardReleaseXml(
      syntheticXml,
      { ...h15Config, requiredAttributes: { ...h15Config.requiredAttributes, MATURITY: 'Y30' } },
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-23T00:00:00Z'),
    ),
    /attribute MATURITY changed/,
  );

  const duplicate = syntheticXml.replace('</message:MessageGroup>', syntheticXml.match(/<kf:Series FREQ="9"[\s\S]*?<\/kf:Series>/)[0] + '</message:MessageGroup>');
  assert.throws(
    () => parseBoardReleaseXml(
      duplicate,
      h15Config,
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-23T00:00:00Z'),
    ),
    /exactly one RIFLGFCY10_XII_N\.B series; found 2/,
  );
});

test('approved Board release source contract is first-party XML, not FRED or DDP', () => {
  assert.equal(BOARD_RELEASE_ORIGIN, 'https://www.federalreserve.gov');
  const urls = [
    'https://www.federalreserve.gov/releases/h10/data/FRB_h10_xml.zip',
    'https://www.federalreserve.gov/releases/h15/data/FRB_h15_xml.zip',
    'https://www.federalreserve.gov/releases/prates/data/FRB_PRATES_xml.zip',
  ];
  for (const value of urls) {
    const url = new URL(value);
    assert.equal(url.origin, BOARD_RELEASE_ORIGIN);
    assert.match(url.pathname, /^\/releases\/(?:h10|h15|prates)\/data\/FRB_(?:h10|h15|PRATES)_xml\.zip$/);
    assert.doesNotMatch(value, /fred\.stlouisfed\.org|datadownload|Output\.aspx/i);
  }
});
