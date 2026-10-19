// Server-only Supabase RPC transport for Score ticket persistence.
// Requires separately reviewed private-schema RPCs exposed through an approved
// backend route; this adapter MUST NOT be bundled into browser code.
// Deployment remains disabled until the RPC contract and security review pass.
import { createScoreTicketStore } from './score-ticket-store.js';

function requireConfig(config) {
  const url = new URL(config?.url || '');
  if (url.protocol !== 'https:' || !/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(config?.secretKey || '')) {
    throw new TypeError('Server-side Supabase URL and secret key required');
  }
  return { origin: url.origin, secretKey: config.secretKey };
}

export function createSupabaseScoreTicketStore({ config, fetchImpl = fetch }) {
  const { origin, secretKey } = requireConfig(config);
  async function rpc(name, body) {
    const response = await fetchImpl(`${origin}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Score ticket storage unavailable');
    return response.json();
  }
  return createScoreTicketStore({
    insert: async (record) => {
      const result = await rpc('score_ticket_issue_atomic', {
        p_digest: record.digest,
        p_account_id: record.accountId,
        p_audience: record.audience,
        p_path: record.path,
        p_expires_at: new Date(record.expiresAtMs).toISOString(),
      });
      return result === true;
    },
    consume: async (digest) => {
      const result = await rpc('score_ticket_consume_atomic', { p_digest: digest });
      // A database function must atomically delete and return the record.
      if (!result || Array.isArray(result)) return null;
      return {
        digest: result.digest,
        accountId: result.account_id,
        audience: result.audience,
        path: result.path,
        expiresAtMs: Date.parse(result.expires_at),
      };
    },
  });
}
