# Challenge-linked first-publication witness receipt v2 - issue 558

## Status

Draft-only successor contract for PR #559. It is not a live route, signer, managed
migration, database role binding, key, provider configuration or Production control.
`publicationAuthorized=false` and `enforcementActive=false` remain mandatory.

## Why v2 exists

The retained `first-public-dispatch/v1` receipt authenticates a signer assertion and
binds the prepared deployment/path/body attempt, but its signed payload does not carry
the canonical origin or the one-use witness challenge identity. That makes v1 useful
as historical regression coverage but insufficient as the final first-publication
witness contract.

`first-public-dispatch/v2` closes that detachment gap. The domain-separated Ed25519
payload includes all prepared-attempt fields plus:

- exact canonical origin `https://www.usd-impact.com`;
- exact 32-byte-hex challenge ID;
- SHA-256 of the exact signed challenge envelope; and
- SHA-256 of the exact witness manifest that the challenge authenticated.

The verifier requires those signed fields to equal an independently loaded durable
`stored-witness-challenge-claim/v1`. It also requires the same dedicated
`public-response-witness` key purpose, exact prepared key fingerprint, bounded key
snapshot, monotonic clock, and claim-before-dispatch timing. A detached origin,
challenge, challenge digest, witness manifest, deployment, signature or key purpose
fails closed.

## Recorder and atomic database successor

`publication-witness-receipt-recorder.js` accepts only server-provided witness
context. It reloads the pending attempt, durable one-use challenge claim and protected
witness-key snapshot, verifies the v2 envelope, then reloads all three before the
single database write. An uncertain write acknowledgement may be reconciled by one
exact read; it is never blindly retried.

`docs/sql/publication-witness-receipt-v2-contract-558.sql` is review/test SQL only,
not a registered migration. In a disposable database it creates private/RLS immutable
`publication_guard.witness_dispatch_receipts` rows keyed to the exact
`(attempt_id, challenge_id)` claim. The consume function verifies the v2 payload's
challenge/origin fields against that claim and finalizes admission in the same
transaction as exact receipt persistence. A later failure or deadline crossing rolls
back the admission and receipt together.

When this successor is eventually installed under separate approval, the recorder
execution role loses the old signer-only v1 consume/lookup grants. Raw receipt and
claim tables remain unavailable to `anon`, `authenticated`, `service_role`, and
ordinary runtime callers. SECURITY DEFINER helpers use an empty search path and
explicit schema-qualified relations.

## What v2 does not prove

Challenge linkage proves that the signed receipt refers to the exact authenticated
challenge that gated the canonical-origin probe. It does **not** by itself prove that
the signer is genuinely independent, that its private key is provider-protected, or
that it really observed the public canonical domain. Those properties require a real
provider-authenticated witness service, protected key custody/rotation, authenticated
receipt transport and live end-to-end observation.

A v2 receipt also does not directly authorize normal public serving. It can only be
used by the restricted atomic recorder to create durable admitted history; the
recorded-only serving layer must independently read that history.

## Verification

`test-publication-witness-receipt-v2.mjs` uses real ephemeral Ed25519 signatures and
PGlite PostgreSQL. Its 15 regression groups cover valid challenge-linked verification,
detached origin/challenge/hash/manifest/deployment, wrong signatures and key purpose,
expired challenge state, private/RLS storage, removal of the v1 recorder capability,
atomic v2 admission, idempotent exact replay, detached-challenge SQL rejection and
revocation-aware reconciliation.

The first-response loopback suite has also been upgraded to generate and record v2
receipts, so its successful probe path now exercises the challenge-linked successor
rather than the legacy signer-only receipt.

## Remaining activation blockers

1. Real independent witness identity and authenticated canonical-domain observation.
2. Protected witness signing-key custody, rotation and revocation with a trusted
   server-only key snapshot.
3. Separately approved managed installation of the SQL successors and exact machine
   role/network/API exposure verification.
4. Recorded-only routing and cache enforcement across all public surfaces.
5. Delayed-cutover/warm-cache/promotion/rollback tests plus broader event-family
   calendar coverage and fresh official-source verification.

Do not merge PR #559 or close #558 based on this isolated successor.
