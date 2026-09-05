import { createSign } from 'node:crypto';
import { OUTCOME, SEVERITY, result, sha256 } from './integrity-watchdog-policy.mjs';
import { jsonRequest, missingProvider } from './integrity-watchdog-provider-common.mjs';

const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const EXPECTED_ROOT_NAME = 'USD Impact — Release Control Center';
const CURRENT_BOOK_FOLDER_NAME = '01_FINAL_BOOK_CURRENT';
const QA_CHECKSUMS_FOLDER_NAME = '09_QA_CHECKSUMS';
const CURRENT_BOOK_PDF = 'USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf';
const CURRENT_BOOK_SHA = 'USD_Impact_Edition_1.3_v5.95_Phase2C_Candidate_2_SHA256.txt';
const CURRENT_BOOK_OWNER_ACCEPTANCE = 'USD_Impact_Edition_1.3_v5.95_Phase2C_Candidate_2_Owner_Acceptance_Record.md';

function base64url(value) { return Buffer.from(value).toString('base64url'); }

async function googleToken(fetchImpl, serviceAccount) {
  if (serviceAccount.token_uri && serviceAccount.token_uri !== GOOGLE_TOKEN_URI) {
    throw new Error('Google service-account token URI is not the approved endpoint.');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive.metadata.readonly',
    aud: GOOGLE_TOKEN_URI,
    iat: now,
    exp: now + 3300,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  signer.end();
  const assertion = `${header}.${claim}.${signer.sign(serviceAccount.private_key).toString('base64url')}`;
  const data = await jsonRequest({
    fetchImpl,
    url: GOOGLE_TOKEN_URI,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  return data.observation.status === 200 ? data.json?.access_token || null : null;
}

function latestModified(files) {
  return files.map((file) => file.modifiedTime).filter(Boolean).sort().reverse()[0] || null;
}

function countName(files, name) {
  return files.filter((file) => file.name === name).length;
}

async function getFolderMetadata(fetchImpl, accessToken, folderId) {
  const query = new URLSearchParams({
    fields: 'id,name,mimeType,modifiedTime,trashed',
    supportsAllDrives: 'true',
  });
  return jsonRequest({
    fetchImpl,
    url: `${DRIVE_API}/files/${encodeURIComponent(folderId)}?${query}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function listChildren(fetchImpl, accessToken, folderId) {
  const files = [];
  let pageToken = '';
  let pages = 0;
  let lastStatus = null;
  do {
    const query = new URLSearchParams({
      q: `'${folderId.replaceAll("'", "\\'")}' in parents and trashed = false`,
      pageSize: '1000',
      fields: 'files(id,name,mimeType,modifiedTime,md5Checksum,size),nextPageToken',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) query.set('pageToken', pageToken);
    const data = await jsonRequest({
      fetchImpl,
      url: `${DRIVE_API}/files?${query}`,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    lastStatus = data.observation.status || null;
    if (lastStatus !== 200) return { files, complete: false, status: lastStatus };
    if (Array.isArray(data.json?.files)) files.push(...data.json.files);
    pageToken = data.json?.nextPageToken || '';
    pages += 1;
  } while (pageToken && pages < 5);
  return { files, complete: !pageToken, status: lastStatus };
}

export async function driveContracts({
  fetchImpl = globalThis.fetch,
  env = process.env,
  tokenProvider = googleToken,
} = {}) {
  const raw = env.USDIMPACT_WATCHDOG_GOOGLE_SERVICE_ACCOUNT_JSON || '';
  const folderId = env.USDIMPACT_WATCHDOG_GOOGLE_DRIVE_ROOT_FOLDER_ID || '';
  if (!raw || !folderId) {
    return [missingProvider({
      id: 'DRIVE-SOURCE-OF-TRUTH',
      workflowId: 'DRIVE-PROVENANCE-01',
      title: 'Google Drive canonical-source metadata',
      domain: 'google_drive',
      severity: SEVERITY.P1,
      names: ['USDIMPACT_WATCHDOG_GOOGLE_SERVICE_ACCOUNT_JSON', 'USDIMPACT_WATCHDOG_GOOGLE_DRIVE_ROOT_FOLDER_ID'],
    })];
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    return [result({
      id: 'DRIVE-SOURCE-OF-TRUTH',
      workflowId: 'DRIVE-PROVENANCE-01',
      title: 'Google Drive canonical-source metadata',
      domain: 'google_drive',
      severity: SEVERITY.P1,
      outcome: OUTCOME.FAIL,
      summary: 'Configured Google service-account JSON is invalid.',
      evidence: [{ id: 'DRIVE-CONFIG', source: 'environment', parse_ok: false }],
    })];
  }

  if (
    !serviceAccount?.client_email
    || !serviceAccount?.private_key
    || (serviceAccount.token_uri && serviceAccount.token_uri !== GOOGLE_TOKEN_URI)
  ) {
    return [result({
      id: 'DRIVE-SOURCE-OF-TRUTH',
      workflowId: 'DRIVE-PROVENANCE-01',
      title: 'Google Drive canonical-source metadata',
      domain: 'google_drive',
      severity: SEVERITY.P1,
      outcome: OUTCOME.FAIL,
      summary: 'Configured Google service-account JSON lacks required signing fields or uses an unapproved token endpoint.',
      evidence: [{
        id: 'DRIVE-CONFIG',
        source: 'environment',
        parse_ok: true,
        required_fields_present: Boolean(serviceAccount?.client_email && serviceAccount?.private_key),
        token_uri_approved: !serviceAccount.token_uri || serviceAccount.token_uri === GOOGLE_TOKEN_URI,
      }],
    })];
  }

  let accessToken = null;
  try {
    accessToken = await tokenProvider(fetchImpl, serviceAccount);
  } catch {
    accessToken = null;
  }
  if (!accessToken) {
    return [result({
      id: 'DRIVE-SOURCE-OF-TRUTH',
      workflowId: 'DRIVE-PROVENANCE-01',
      title: 'Google Drive canonical-source metadata',
      domain: 'google_drive',
      severity: SEVERITY.P1,
      outcome: OUTCOME.UNKNOWN,
      summary: 'Google Drive metadata access could not obtain a read-only token.',
      evidence: [{ id: 'DRIVE-OAUTH', source: 'google_drive', token_obtained: false }],
    })];
  }

  const rootData = await getFolderMetadata(fetchImpl, accessToken, folderId);
  if (rootData.observation.status !== 200 || !rootData.json?.id) {
    return [result({
      id: 'DRIVE-SOURCE-OF-TRUTH',
      workflowId: 'DRIVE-PROVENANCE-01',
      title: 'Google Drive canonical-source metadata',
      domain: 'google_drive',
      severity: SEVERITY.P1,
      outcome: OUTCOME.UNKNOWN,
      summary: 'Configured Google Drive root metadata is not readable.',
      evidence: [{
        id: 'DRIVE-ROOT-METADATA',
        source: 'google_drive',
        response_status: rootData.observation.status || null,
        root_id_digest: sha256(folderId),
        file_contents_collected: false,
        scope: 'drive.metadata.readonly',
      }],
    })];
  }

  const rootMatches = rootData.json.name === EXPECTED_ROOT_NAME
    && rootData.json.mimeType === DRIVE_FOLDER_MIME
    && rootData.json.trashed !== true;
  if (!rootMatches) {
    return [result({
      id: 'DRIVE-SOURCE-OF-TRUTH',
      workflowId: 'DRIVE-PROVENANCE-01',
      title: 'Google Drive canonical-source metadata',
      domain: 'google_drive',
      severity: SEVERITY.P1,
      outcome: OUTCOME.FAIL,
      summary: 'Configured Google Drive root does not identify the governed USD Impact Release Control Center.',
      evidence: [{
        id: 'DRIVE-ROOT-METADATA',
        source: 'google_drive',
        response_status: rootData.observation.status,
        root_id_digest: sha256(folderId),
        expected_root_name_match: rootData.json.name === EXPECTED_ROOT_NAME,
        folder_mime_match: rootData.json.mimeType === DRIVE_FOLDER_MIME,
        trashed: rootData.json.trashed === true,
        file_contents_collected: false,
        scope: 'drive.metadata.readonly',
      }],
    })];
  }

  const rootChildren = await listChildren(fetchImpl, accessToken, folderId);
  if (rootChildren.status !== 200) {
    return [result({
      id: 'DRIVE-SOURCE-OF-TRUTH',
      workflowId: 'DRIVE-PROVENANCE-01',
      title: 'Google Drive canonical-source metadata',
      domain: 'google_drive',
      severity: SEVERITY.P1,
      outcome: OUTCOME.UNKNOWN,
      summary: 'Release Control Center child-folder metadata is unavailable.',
      evidence: [{
        id: 'DRIVE-ROOT-CHILDREN',
        source: 'google_drive',
        response_status: rootChildren.status,
        root_id_digest: sha256(folderId),
        file_contents_collected: false,
        scope: 'drive.metadata.readonly',
      }],
    })];
  }

  const currentFolders = rootChildren.files.filter((file) => file.name === CURRENT_BOOK_FOLDER_NAME && file.mimeType === DRIVE_FOLDER_MIME);
  const qaFolders = rootChildren.files.filter((file) => file.name === QA_CHECKSUMS_FOLDER_NAME && file.mimeType === DRIVE_FOLDER_MIME);
  const currentFolder = currentFolders.length === 1 ? currentFolders[0] : null;
  const qaFolder = qaFolders.length === 1 ? qaFolders[0] : null;

  const currentChildren = currentFolder
    ? await listChildren(fetchImpl, accessToken, currentFolder.id)
    : { files: [], complete: true, status: 200 };
  const qaChildren = qaFolder
    ? await listChildren(fetchImpl, accessToken, qaFolder.id)
    : { files: [], complete: true, status: 200 };

  if (currentChildren.status !== 200 || qaChildren.status !== 200) {
    return [result({
      id: 'DRIVE-SOURCE-OF-TRUTH',
      workflowId: 'DRIVE-PROVENANCE-01',
      title: 'Google Drive canonical-source metadata',
      domain: 'google_drive',
      severity: SEVERITY.P1,
      outcome: OUTCOME.UNKNOWN,
      summary: 'Governed current-book or QA-checksum metadata could not be fully read.',
      evidence: [{
        id: 'DRIVE-GOVERNED-FOLDERS',
        source: 'google_drive',
        current_book_response_status: currentChildren.status,
        qa_checksums_response_status: qaChildren.status,
        file_contents_collected: false,
        scope: 'drive.metadata.readonly',
      }],
    })];
  }

  const acceptedPdfCount = countName(currentChildren.files, CURRENT_BOOK_PDF);
  const candidateShaCount = countName(currentChildren.files, CURRENT_BOOK_SHA);
  const ownerAcceptanceCount = countName(currentChildren.files, CURRENT_BOOK_OWNER_ACCEPTANCE);
  const qaShaMarkerCount = qaChildren.files.filter((file) => /SHA256/i.test(file.name || '')).length;
  const qaManifestCount = qaChildren.files.filter((file) => /Checksum_Manifest\.csv$/i.test(file.name || '')).length;
  const paginationComplete = rootChildren.complete && currentChildren.complete && qaChildren.complete;
  const structureComplete = currentFolders.length === 1
    && qaFolders.length === 1
    && acceptedPdfCount === 1
    && candidateShaCount === 1
    && ownerAcceptanceCount === 1
    && qaShaMarkerCount >= 1
    && qaManifestCount >= 1
    && paginationComplete;
  const outcome = structureComplete ? OUTCOME.PASS : OUTCOME.WARN;

  return [result({
    id: 'DRIVE-SOURCE-OF-TRUTH',
    workflowId: 'DRIVE-PROVENANCE-01',
    title: 'Google Drive canonical-source metadata',
    domain: 'google_drive',
    severity: SEVERITY.P1,
    outcome,
    summary: structureComplete
      ? 'Release Control Center metadata matches the governed current-book and QA-checksum structure; no Drive file contents were read.'
      : 'Drive metadata is readable, but the governed current-book or QA-checksum structure is incomplete, ambiguous, or partially paged.',
    evidence: [{
      id: 'DRIVE-PROVENANCE-METADATA',
      source: 'google_drive',
      response_status: 200,
      root_id_digest: sha256(folderId),
      root_name_match: true,
      root_modified_time: rootData.json.modifiedTime || null,
      root_child_count: rootChildren.files.length,
      current_book_folder_count: currentFolders.length,
      qa_checksums_folder_count: qaFolders.length,
      current_book_item_count: currentChildren.files.length,
      accepted_candidate_pdf_count: acceptedPdfCount,
      candidate_sha256_record_count: candidateShaCount,
      owner_acceptance_record_count: ownerAcceptanceCount,
      qa_sha256_marker_count: qaShaMarkerCount,
      qa_checksum_manifest_count: qaManifestCount,
      current_book_latest_modified_time: latestModified(currentChildren.files),
      qa_checksums_latest_modified_time: latestModified(qaChildren.files),
      current_book_item_id_digests: currentChildren.files.slice(0, 100).map((file) => sha256(file.id)),
      qa_checksum_item_id_digests: qaChildren.files.slice(0, 100).map((file) => sha256(file.id)),
      pagination_complete: paginationComplete,
      filenames_persisted: false,
      file_contents_collected: false,
      checksum_contents_collected: false,
      scope: 'drive.metadata.readonly',
    }],
    remediation: {
      likely_root_causes: ['Configured root is stale, a governed folder is missing or duplicated, or current release metadata is incomplete.'],
      smallest_safe_scope: ['Google Drive metadata-only watchdog configuration and the governed Release Control Center folders.'],
      proposed_changes: ['Restore one canonical current-book folder and one QA-checksum folder with the expected release metadata, or update the contract only after a separately approved release transition.'],
      verification_plan: ['Re-run DRIVE-SOURCE-OF-TRUTH with the dedicated metadata-only service account.', 'Confirm no Drive contents or sharing state are read or modified.'],
      prohibited_actions: ['Do not read document contents, download files, change sharing, move files, or modify Drive state.'],
      acceptance_criteria: ['Exactly one governed current-book folder and one QA-checksum folder are visible.', 'Current Candidate 2 PDF, SHA-256 record, and owner acceptance metadata are unique.', 'QA checksum markers and checksum manifests are present.', 'No file contents are collected.'],
    },
  })];
}
