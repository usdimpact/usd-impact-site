// A storage contract for Score handoff tickets, independent of database provider.
// Not wired to any production endpoint. Implementations MUST guarantee atomic
// insertIfAbsent and consume across all replicas and requests.
export function createScoreTicketStore({ insert, consume }) {
  if (typeof insert !== 'function' || typeof consume !== 'function') {
    throw new TypeError('Atomic ticket insert and consume operations are required');
  }
  return Object.freeze({
    async insertIfAbsent(record) {
      if (!record || !/^[a-f0-9]{64}$/.test(record.digest || '') ||
          !record.accountId || !record.audience || !record.path ||
          !Number.isSafeInteger(record.expiresAtMs)) {
        throw new TypeError('Invalid ticket record');
      }
      const result = await insert(record);
      // Any ambiguous storage result fails closed.
      return result === true;
    },
    async consume(digest) {
      if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) return null;
      const result = await consume(digest);
      if (!result || typeof result !== 'object' || result.digest !== digest) return null;
      return result;
    },
  });
}
