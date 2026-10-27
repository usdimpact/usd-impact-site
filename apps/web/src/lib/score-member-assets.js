const ROOT_PATHS = new Set(['/en/', '/es/', '/archive/en/', '/archive/es/']);
const ARCHIVE_PATH_RE = /^\/archive\/\d{4}-\d{2}-\d{2}\/(?:en|es)\.html$/;
const SHA_RE = /^[0-9a-f]{40}$/;

export function scoreMemberAssetPath(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.length > 128 || raw.includes('\\') || raw.includes('..')) return null;
  let path = raw.startsWith('/') ? raw : `/${raw}`;
  if (path === '/en' || path === '/es' || path === '/archive/en' || path === '/archive/es') path += '/';
  if (ROOT_PATHS.has(path) || ARCHIVE_PATH_RE.test(path)) return path;
  return null;
}

function requireConfig(config) {
  let url;
  try { url = new URL(config?.url || ''); } catch { throw new TypeError('Private Score asset configuration required'); }
  if (url.protocol !== 'https:' || !/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(config?.secretKey || '')) {
    throw new TypeError('Private Score asset configuration required');
  }
  return { origin: url.origin, secretKey: config.secretKey };
}

export function rewriteScoreMemberLinks(body) {
  if (typeof body !== 'string') return '';
  return body
    .replace(/href=(["'])\/archive\/(\d{4}-\d{2}-\d{2}\/(?:en|es)\.html)\1/g,
      'href=$1/score/member/archive/$2$1')
    .replace(/href=(["'])\/archive\/(en|es)\/\1/g,
      'href=$1/score/member/archive/$2/$1')
    .replace(/href=(["'])\/(en|es)\/\1/g,
      'href=$1/score/member/$2/$1');
}

export function createScoreMemberAssetStore({ config, fetchImpl = fetch }) {
  const { origin, secretKey } = requireConfig(config);
  return {
    async read(path) {
      const safePath = scoreMemberAssetPath(path);
      if (!safePath) return null;
      const url = new URL('/rest/v1/score_member_assets', origin);
      url.searchParams.set('path', `eq.${safePath}`);
      url.searchParams.set('select', 'path,content_type,body,source_commit,source_sha');
      url.searchParams.set('limit', '1');
      const response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          apikey: secretKey,
          'Cache-Control': 'no-store',
        },
      });
      if (!response.ok) throw new Error('Private Score asset storage unavailable');
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length !== 1) return null;
      const row = rows[0];
      if (row.path !== safePath || row.content_type !== 'text/html; charset=utf-8' ||
          typeof row.body !== 'string' || !SHA_RE.test(row.source_commit || '') ||
          !SHA_RE.test(row.source_sha || '')) return null;
      return Object.freeze({
        path: row.path,
        contentType: row.content_type,
        body: rewriteScoreMemberLinks(row.body),
        sourceCommit: row.source_commit,
        sourceSha: row.source_sha,
      });
    },
  };
}
