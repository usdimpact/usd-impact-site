# Vercel-compatible witness lifecycle and durable challenge claim - issue 558

## Status

Draft-only successor prepared for PR #559. It adds a Vercel request-lifetime adapter,
a durable one-use witness-challenge claim contract, and deferred first-response
completion semantics. It does **not** register an HTTP route, create a Vercel or
Supabase credential, install a managed migration, configure provider controls,
serve a Production article, or activate enforcement. Keep PR #559 draft/unmerged
and issue #558 open. `enforcementActive=false`.

## Vercel post-response lifecycle

`publication-witness-lifecycle.js` wraps the project-pinned `@vercel/functions`
`waitUntil()` primitive. The scheduler gates the completion task until `waitUntil`
has accepted the promise. If no Vercel request context is available and scheduling
throws, the receipt task never starts. The scheduler returns no task promise or
provider secret to a caller and cannot mint publication history.

`publication-first-response-witness.js` now accepts an optional trusted
`scheduleAfterResponse` adapter. Existing isolated synchronous tests retain their
prior behavior when this adapter is absent. A future Vercel route must supply the
scheduler explicitly. With it present, the handler performs all challenge,
attempt, key, render and exact-response-hash checks before dispatch, sends the
no-store/noindex probe, registers post-response completion with the scheduler, and
returns `WITNESS_PROBE_DISPATCHED_PENDING_RECEIPT` with `admissionRecorded=false`.
The receipt wait and recorder use a separate bounded AbortController so returning
from the request handler does not abort the `waitUntil` task.

Successful deferred completion still requires the independent witness receipt and
the existing exact receipt recorder. Only that completion can produce
`WITNESS_RECEIPT_RECORDED`; normal public serving must later read durable admitted
history. Node `finish`, Host/forwarded headers, a Vercel deployment field, Preview,
preflight or a scheduler acknowledgement remain insufficient publication evidence.
If `waitUntil` registration fails after probe bytes are sent, no receipt work starts
and no admission is recorded. The probe is still restricted to the authenticated
short-lived witness challenge and is not a general public article response.

## Durable one-use challenge claim

`publication-witness-claim-store.js` is a provider-independent one-write adapter.
It validates the exact five-field challenge binding, performs at most one commit
attempt, and requires exact persisted evidence from `readClaim`. A boolean or RPC
success acknowledgement cannot manufacture a claim. A known replay response stays
a replay and is never converted to success. Only an ambiguous transport failure may
be reconciled by one exact read; there is no second write.

`docs/sql/publication-witness-challenge-ledger-contract-558.sql` is **not a
registered migration**. In a disposable database it adds
`publication_guard.witness_challenge_claims`, an immutable RLS table in the existing
private publication schema. It reuses the existing restricted recorder owner/caller
roles, grants no raw access to `anon`, `authenticated`, `service_role` or runtime
callers, and adds only two narrow SECURITY DEFINER APIs: exact claim and exact
lookup. Function EXECUTE is revoked from public/client roles and granted only to the
existing recorder execution role.

The claim API acquires the existing writer gate, checks the immutable dispatch
attempt, release revocation, pending admission, exact witness manifest hash and
bounded deadline, then inserts one challenge ID/hash. A challenge ID or challenge
hash can never be reused. Claims are capped at eight per prepared attempt. A final
database clock check rolls back a claim that crosses its exclusive deadline.
Challenge claims do not advance publication admission history and do not change a
pending admission to admitted; only the later signed receipt transaction can do so.
Rows are immutable after insertion.

This remains an isolated contract. The managed machine identity, actual database
network path, provider-authenticated witness, signing-key custody/rotation and live
Data API exposure state are not asserted. Current Supabase documentation separates
object grants from RLS and recommends keeping security-definer helpers out of
exposed schemas; the candidate follows that model. The 2026 Data API default-grant
change does not replace explicit revoke/grant review for an existing project.

## Verification

`test-publication-witness-lifecycle.mjs` adds 18 regression groups using the actual
project PGlite dependency, real Node loopback HTTP and injected Vercel scheduling.
It covers scheduler-before-task ordering, missing request context, exception
containment, exact persisted claim evidence, lost-ack reconciliation, explicit
replay, fake-success rejection, expiry, private RLS storage, raw-access denial,
SQL one-use semantics, digest replay, manifest/deadline rejection, API permissions,
immutability, database-backed claim-store integration, deferred HTTP completion and
post-dispatch scheduler failure without receipt/admission work.

Local verification on Node 22.16.0 passed the 18 new groups, the unchanged 22
first-response witness groups and the unchanged 52 receipt-ledger groups. The local
copy used a non-committed `@vercel/functions` stub only to resolve the package while
all scheduler tests injected their own `waitUntilFn`; the repository already pins
`@vercel/functions` 3.9.5 and CI/Preview must verify against the real dependency on
Node 24.x. Do not count local success as exact-head CI until those runs complete.

## Remaining blockers

1. Provider-authenticated witness identity and real canonical-domain observation,
   including key custody/rotation and authenticated receipt transport.
2. Review and separate authorization for managed installation of the publication
   SQL successors, actual machine-role binding and API non-exposure verification.
3. Recorded-only serving across article, homepage, news list/archive, feed,
   latest JSON, sitemap, aliases, immutable deployment URLs and warm-cache paths.
4. Complete Vercel control/role/protection/gitSource/artifact evidence and guarded
   promotion/rollback behavior.
5. Event-family coverage beyond BLS CPI/PPI/Employment and fresh official source
   verification before any release request.

## References

- https://vercel.com/docs/functions/functions-api-reference#waituntil
- https://vercel.com/docs/routing-middleware/api
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

Documentation describes platform primitives and current defaults, not installed
USD Impact controls. No provider write was made while preparing this candidate.
