// Server-side Score session and membership RPC adapters.
// Never bundle into a browser or expose the Supabase secret key.
import { createHash, randomBytes } from 'node:crypto';
const DIGEST = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function digest(token) { return createHash('sha256').update(token).digest('hex'); }

export function createScoreMembershipProviders({ config, fetchImpl = fetch }) {
  if (!config?.url || !/^https:\/\//.test(config.url) ||
      !/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(config.secretKey || '')) {
    throw new TypeError('Privileged server configuration required');
  }
  async function rpc(name, payload) {
    const response = await fetchImpl(`${config.url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST', redirect: 'error', headers: { apikey: config.secretKey,
        'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Score membership storage unavailable');
    return response.json();
  }
  return {
    membership: {
      async isActive(accountId) {
        if (!UUID.test(accountId || '')) return false;
        return (await rpc('score_membership_active', { p_account_id: accountId })) === true;
      },
    },
    sessions: {
      async create({ accountId, nowMs = Date.now() }) {
        if (!UUID.test(accountId || '')) throw new TypeError('Invalid account');
        const token = randomBytes(32).toString('base64url');
        const expiresAtMs = nowMs + 14 * 60_000;
        if ((await rpc('score_session_create', {
          p_digest: digest(token), p_account_id: accountId,
          p_expires_at: new Date(expiresAtMs).toISOString(),
        })) !== true) throw new Error('Score session unavailable');
        return { token, expiresAtMs };
      },
      async lookup(token) {
        if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
        const result = await rpc('score_session_lookup', { p_digest: digest(token) });
        if (!result || !UUID.test(result.account_id || '')) return null;
        const expiresAtMs = Date.parse(result.expires_at);
        return Number.isFinite(expiresAtMs) ? { accountId: result.account_id, expiresAtMs } : null;
      },
    },
  };
}
