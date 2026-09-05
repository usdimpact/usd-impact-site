import assert from 'node:assert/strict';
import { driveContracts } from './integrity-watchdog-drive.mjs';

const env = {
  USDIMPACT_WATCHDOG_GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: 'test-service-account',
    private_key: 'test-only-key',
  }),
  USDIMPACT_WATCHDOG_GOOGLE_DRIVE_ROOT_FOLDER_ID: 'root-test',
};

const reply = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

function fixture({ rootName = 'USD Impact — Release Control Center', duplicatePdf = false } = {}) {
  const currentFiles = [
    { id: 'book-pdf', name: 'USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf', mimeType: 'application/pdf', modifiedTime: '2026-08-30T23:29:19.073Z', size: '2281645' },
    { id: 'book-sha', name: 'USD_Impact_Edition_1.3_v5.95_Phase2C_Candidate_2_SHA256.txt', mimeType: 'text/plain', modifiedTime: '2026-08-30T23:34:47.914Z', size: '535' },
    { id: 'book-owner', name: 'USD_Impact_Edition_1.3_v5.95_Phase2C_Candidate_2_Owner_Acceptance_Record.md', mimeType: 'text/markdown', modifiedTime: '2026-08-30T23:39:07.308Z', size: '1826' },
  ];
  if (duplicatePdf) currentFiles.push({ ...currentFiles[0], id: 'book-pdf-duplicate' });

  return async (input, options = {}) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'www.googleapis.com');
    assert.equal(options.method, 'GET');
    assert.match(String(options.headers?.Authorization || ''), /^Bearer /);

    if (url.pathname === '/drive/v3/files/root-test') {
      return reply({
        id: 'root-test',
        name: rootName,
        mimeType: 'application/vnd.google-apps.folder',
        modifiedTime: '2026-08-30T23:42:29.041Z',
        trashed: false,
      });
    }

    if (url.pathname === '/drive/v3/files') {
      const query = url.searchParams.get('q') || '';
      if (query.includes("'root-test' in parents")) {
        return reply({ files: [
          { id: 'current-folder', name: '01_FINAL_BOOK_CURRENT', mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2026-06-10T19:45:06.127Z' },
          { id: 'qa-folder', name: '09_QA_CHECKSUMS', mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2026-06-10T19:45:51.097Z' },
        ] });
      }
      if (query.includes("'current-folder' in parents")) return reply({ files: currentFiles });
      if (query.includes("'qa-folder' in parents")) {
        return reply({ files: [
          { id: 'qa-sha', name: 'USD_Impact_Edition_1.3_v5.95_Candidate_SHA256.txt', mimeType: 'text/plain', modifiedTime: '2026-08-30T22:40:41.099Z' },
          { id: 'qa-manifest', name: 'Session16B_Output_Checksum_Manifest.csv', mimeType: 'text/csv', modifiedTime: '2026-06-11T14:10:59.000Z' },
        ] });
      }
    }

    return reply({ error: 'unexpected test request' }, 404);
  };
}

const tokenProvider = async () => 'test-access-value';

const missing = await driveContracts({ env: {}, tokenProvider, fetchImpl: fixture() });
assert.equal(missing[0].outcome, 'UNKNOWN');

const passing = await driveContracts({ env, tokenProvider, fetchImpl: fixture() });
assert.equal(passing[0].outcome, 'PASS');
assert.equal(passing[0].classification, 'B_FUNCTIONAL');
assert.equal(passing[0].evidence[0].root_name_match, true);
assert.equal(passing[0].evidence[0].accepted_candidate_pdf_count, 1);
assert.equal(passing[0].evidence[0].candidate_sha256_record_count, 1);
assert.equal(passing[0].evidence[0].owner_acceptance_record_count, 1);
assert.equal(passing[0].evidence[0].qa_sha256_marker_count, 1);
assert.equal(passing[0].evidence[0].qa_checksum_manifest_count, 1);
assert.equal(passing[0].evidence[0].file_contents_collected, false);
assert.equal(passing[0].evidence[0].checksum_contents_collected, false);
assert.equal(passing[0].evidence[0].filenames_persisted, false);
const persistedEvidence = JSON.stringify(passing[0].evidence);
assert.equal(persistedEvidence.includes('Scoped_Candidate_2.pdf'), false);
assert.equal(persistedEvidence.includes('Owner_Acceptance_Record.md'), false);

const ambiguous = await driveContracts({ env, tokenProvider, fetchImpl: fixture({ duplicatePdf: true }) });
assert.equal(ambiguous[0].outcome, 'WARN');
assert.equal(ambiguous[0].evidence[0].accepted_candidate_pdf_count, 2);

const wrongRoot = await driveContracts({ env, tokenProvider, fetchImpl: fixture({ rootName: 'USD Impact' }) });
assert.equal(wrongRoot[0].outcome, 'FAIL');

console.log('USD Impact Drive watchdog provenance tests passed.');
