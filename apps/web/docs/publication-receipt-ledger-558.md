# Durable signed-receipt recording - issue 558

## Status

Draft-only successor to the tested governed writer contract, prepared from PR 559
head `2ed7f526e36a3058e11fc1fc7f4f76247d6511f4`, main
`058d4d893ab12ce7ddd51ad43154d02b8536ca59`. No managed migration, live permission,
key, provider setting, route or public admission is installed. Keep PR 559 draft
and issue 558 open. `enforcementActive=false`.

This increment implements durable receipt consumption and a provider-independent
recorder, not the missing first-public-response handler or authenticated witness.
Those remain explicit integration blockers. A valid signature authenticates an
assertion by its key holder; it does not establish actual public exposure.

## Three layers and their trust boundaries

`publication-receipt-verifier.js` retains the earlier 83-test Ed25519 protocol:
canonical envelope/payload encoding, fixed algorithm/domain separation, pinned
public keys, exact bindings, exclusive deadlines and advancing clock checks. The
standalone verifier still returns `VERIFIED_SIGNER_ASSERTION_ONLY` and creates no
publication authorization or database admission.

`publication-receipt-recorder.js` owns verification rather than accepting a caller's
`verified: true` or proof object. It loads the immutable prepared attempt and key
snapshot through required server-only adapters, checks the public-key fingerprint,
verifies the receipt, rereads the attempt and keys, and performs at most one write
invocation. It bounds adapter waits and propagates AbortSignal. Cancellation cannot
undo a remote write already in flight. After an uncertain result it performs one
read reconciliation, never another write. Null/unavailable/mismatched read results
remain unresolved; a later explicit read can reconcile the same exact receipt.
A success boolean cannot manufacture a stored admission.

All adapter identities and transports remain unimplemented. `loadAttempt` must
read the committed attempt, its exact key fingerprint, current pending/revocation
state and a deadline no later than approval/evidence/public-context validity.
`loadKeySnapshot` must authenticate actual protected key state. Neither is a browser
parameter, model assertion, forwarded Host header, or echo of untrusted receipt
fields. Bounded snapshots are not distributed instantaneous revocation guarantees.
The recorder returns `RECORDED_SIGNER_ASSERTION` only after matching committed
receipt evidence; it still sets `publicationAuthorized=false` because serving
eligibility belongs to the separate policy and public-context boundary.

## SQL successor (not a registered migration)

Load the pinned baseline, governed writer candidate and new
`docs/sql/publication-receipt-ledger-contract-558.sql` only in an isolated test DB.
The new SQL adds two private RLS tables: immutable prepared dispatch attempts and
immutable consumed receipts. Attempts bind release/path/content, the complete
single-event response manifest and the expected key identity/fingerprint. A second
attempt ID cannot replace an existing attempt for the same release/path. Retrying
an identical staging request never updates its original evidence or time.

Three narrow API functions reuse existing restricted owner/caller roles:
`stage_dispatch_attempt`, `consume_dispatch_receipt`, and
`lookup_dispatch_receipt`. The recorder's EXECUTE grant on the old digest-only
`record_verified_receipt` entry point is revoked. Without that revocation, a caller
could bypass the new ledger; installing only part of this candidate is unsupported.
No new login role, owner membership, public API exposure, or service-role access is
added. New definer functions have empty search paths, RLS enabled, qualified
relations and no dynamic SQL. Existing original SQL files are unchanged.

Writers retain history -> release -> admission order. After locking, consumption
compares the exact stored binding, key ID and envelope/payload bytes, recomputes
hashes in PostgreSQL, checks advancing database time and finalizes the admission.
Receipt insertion and finalization share one transaction. Another clock check
after insertion/its triggers rejects work that crossed the deadline. Any error
rolls back the admission, receipt and both history increments. The successful
recorded transition advances history twice atomically (admission plus receipt),
not once for each retry. An exact retry is a read comparison and cannot refresh
history or timestamps; conflicting receipts hold. Revoked releases/items cannot
become eligible through receipt replay.

The SQL does NOT verify Ed25519 signatures. It trusts the isolated recorder's
signature verification, prepared key pin and fresh authority. A compromised
recorder or administrative database owner remains within an explicit trust
boundary. Storing a signed envelope is not independent proof of the signer's
observation or clock accuracy. The SQL clock checks are operation-time checks,
not a guarantee of WAL commit time or browser receipt time. Live deployment must
bound transactions and conservatively account for cross-service clock uncertainty.

## Coverage and deliberate exclusions

The receipt format supports one CPI/PPI/Employment Situation initial-monthly article
or an explicitly no-calendar Daily. Multi-event Daily manifests, other agencies,
aggregate first publication, HEAD, partial responses and redirects remain rejected.
No existing archive has been seeded or retrospectively certified. Live pages,
feeds, sitemap, caches, aliases and immutable deployment URLs remain unchanged.

The original writer tests still test their original candidate in a separate
embedded database; the new ledger tests load the successor and explicitly prove
the digest-only grant is gone. This is not contradictory deployed configuration.
The successor must be adopted as one reviewed installation with machine identity,
policy fingerprints and actual API non-exposure verified first.

## Verification

The earlier 83 cryptographic tests were brought into the repository with only the
import path and artifact-report side effect adjusted. The new 52 integration groups
use ephemeral real Ed25519 signatures and actual PGlite/PostgreSQL SQL, including
permission denial, rollback after receipt insertion failure, post-insert expiry,
key/attempt drift, timeout ambiguity and exact read reconciliation. Keys stay in
memory and are not included in artifacts. Existing 649 publishing groups plus
these 135 groups total 784 once the exact-head CI run passes; do not treat this
document itself as proof that CI has run.

A separate disposable native PostgreSQL 17.6 harness exercised nine scenarios:
concurrent identical and conflicting receipts, actual lock-wait expiry, insertion
failure, transaction rollback, revocation race, denied access/digest-only bypass,
post-insert deadline crossing, and clean restart persistence. Real backend lock
waits are observed; the standard/application test roles have 28 prohibited
operations denied. This harness remains in the evidence bundle, not an added CI
service or workflow. It does not establish managed failover or public HTTP delivery.
A negative variant omitting the final post-insert clock check fails the expiry
scenario; the defective variant is not part of the candidate.

## Next boundary

Implement the initial eligible HTTP dispatch and independently authenticated
witness, then join that witness to this recorder without allowing private Preview,
model assertions, a preflight pass, or caller-controlled context to mint history.
First-public response tests C14/C15 remain open. Managed installation, broader
calendar coverage, archive recovery, all-path/cache enforcement and raw Vercel
control evidence require their existing separate approvals and verification.

## Primary references

- https://nodejs.org/docs/latest-v24.x/api/http.html#event-finish_1
- https://www.postgresql.org/docs/17/sql-createfunction.html
- https://www.postgresql.org/docs/17/explicit-locking.html
- https://supabase.com/docs/guides/database/functions

Documentation describes primitives, not installed controls. The markdown
changelog endpoint was unavailable; the HTML Supabase changelog was inspected.
No provider breaking-change migration or configuration update was applied.
