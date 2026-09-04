import { createSign } from 'node:crypto';
import { OUTCOME, SEVERITY, result, sha256 } from './integrity-watchdog-policy.mjs';
import { jsonRequest, missingProvider } from './integrity-watchdog-provider-common.mjs';

function base64url(value) { return Buffer.from(value).toString('base64url'); }

async function googleToken(fetchImpl, serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive.metadata.readonly',
    aud: tokenUri,
    iat: now,
    exp: now + 3300,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  signer.end();
  const assertion = `${header}.${claim}.${signer.sign(serviceAccount.private_key).toString('base64url')}`;
  const data = await jsonRequest({
    fetchImpl,
    url: tokenUri,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  return data.observation.status === 200 ? data.json?.access_token || null : null;
}

export async function driveContracts({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
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

  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    return [result({
      id: 'DRIVE-SOURCE-OF-TRUTH',
      workflowId: 'DRIVE-PROVENANCE-01',
      title: 'Google Drive canonical-source metadata',
      domain: 'google_drive',
      severity: SEVERITY.P1,
      outcome: OUTCOME.FAIL,
      summary: 'Configured Google service-account JSON lacks required signing fields.',
      evidence: [{ id: 'DRIVE-CONFIG', source: 'environment', parse_ok: true, required_fields_present: false }],
    })];
  }

  let accessToken = null;
  try {
    accessToken = await googleToken(fetchImpl, serviceAccount);
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

  const query = new URLSearchParams({
    q: `'${folderId.replaceAll("'", "\\'")}' in parents and trashed = false`,
    pageSize: '1000',
    fields: 'files(id,mimeType,modifiedTime,md5Checksum,size),nextPageToken',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const data = await jsonRequest({
    fetchImpl,
    url: `https://www.googleapis.com/drive/v3/files?${query}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const files = Array.isArray(data.json?.files) ? data.json.files : [];
  const mimeCounts = {};
  for (const file of files) mimeCounts[file.mimeType || 'unknown'] = (mimeCounts[file.mimeType || 'unknown'] || 0) + 1;
  const outcome = data.observation.status === 200 && files.length ? OUTCOME.WARN : OUTCOME.UNKNOWN;

  return [result({
    id: 'DRIVE-SOURCE-OF-TRUTH',
    workflowId: 'DRIVE-PROVENANCE-01',
    title: 'Google Drive canonical-source metadata',
    domain: 'google_drive',
    severity: SEVERITY.P1,
    outcome,
    summary: files.length
      ? `Canonical folder is readable with ${files.length} direct child item(s); explicit source-to-output mapping is still required.`
      : 'Canonical folder metadata is unavailable or contains no visible direct child items.',
    evidence: [{
      id: 'DRIVE-FOLDER-METADATA',
      source: 'google_drive',
      response_status: data.observation.status || null,
      item_count: files.length,
      mime_type_counts: mimeCounts,
      latest_modified_time: files.map((file) => file.modifiedTime).filter(Boolean).sort().reverse()[0] || null,
      item_id_digests: files.slice(0, 100).map((file) => sha256(file.id)),
      filenames_collected: false,
      file_contents_collected: false,
      scope: 'drive.metadata.readonly',
    }],
    remediation: {
      proposed_changes: ['Add a reviewed manifest mapping each canonical Drive revision digest to repository and public outputs.'],
      prohibited_actions: ['Do not read document contents or modify file or sharing state.'],
    },
  })];
}
