# Authenticated first-publication witness - issue 558

## Status

Draft-only component for PR #559. It is not registered on any Vercel route, has no
managed database credentials, does not install SQL, and does not change Production.
It advances the first-publication evidence boundary; `enforcementActive=false`.

The component deliberately does **not** treat Node `ServerResponse.finish`, Host or
forwarded-host headers, Preview aliases, environment strings, a preflight PASS, or
a model assertion as proof of public exposure. The existing recorded-publication
handler remains recorded-only. This witness handler is a separate authenticated
probe path for a pending first admission.

## Two-phase protocol

A controller first prepares the immutable publication attempt already defined by
the receipt-ledger contract. Its `manifestSha256` must hash a canonical witness
manifest containing the challenge ID, canonical HTTPS origin, repository/project/
team/deployment identity, exact path, attempt ID, exact response SHA-256, GET/200,
and the publication-dispatch boundary version.

An independent witness signs a short-lived, domain-separated challenge with a key
whose protected snapshot has purpose `public-response-witness`. The handler verifies
the exact manifest and key purpose, obtains a one-use challenge claim through a
trusted server-only adapter, renders bounded bytes, hashes them, rereads the pending
attempt and key state, and verifies the challenge again immediately before sending.
The candidate response is no-store/noindex and is available only to the signed
witness probe. Ordinary public traffic is still governed by recorded-only serving.

After the witness says it received the exact response through the canonical origin,
it returns the existing `first-public-dispatch/v1` signed receipt. The handler passes
that receipt to the existing recorder; the recorder independently reloads the
attempt/key state, verifies the signature, and uses the atomic receipt-ledger write.
Only matching committed receipt evidence yields `WITNESS_RECEIPT_RECORDED`, and even
that return value keeps `publicationAuthorized=false`: the normal serving policy
must subsequently read the durable admission before exposing general public traffic.

A timeout, malformed or wrong-key receipt, failed/uncertain recording, revocation,
or expired challenge leaves admission unrecorded. The witness may have received the
probe bytes, but a probe is not a public archive bootstrap. An uncertain write is
reconciled by exact read evidence, never a blind second write.

## Trust boundary and Vercel limitation

The current implementation uses abstract authenticated adapters for challenge
claiming, witness-key state, receipt delivery and durable recording. No provider
signer/key is configured. Current Vercel documentation exposes canonical-domain
requests, runtime request/status logs, trusted-source OIDC for protected deployments,
and deployment identity primitives, but those are not by themselves proof that a
remote reader received the exact response body. Therefore provider-authenticated
witness identity/key custody and live canonical-domain observation remain explicit
activation blockers.

A challenge signed for a Preview/alternate origin is rejected because the canonical
origin is inside the signed manifest hash already bound to the prepared attempt.
Incoming Host headers are intentionally ignored as authority. Challenge replay is
also rejected through the required one-use claim adapter. The live implementation
must persist that claim durably; the current tests use isolated in-memory claims.

## Tests

The isolated suite uses real Node loopback HTTP and Ed25519 signatures. It covers a
valid probe/receipt chain, wrong signature and key purpose, expired/revoked witness
keys, wrong origin/deployment/path/body hash, missing challenge despite Host spoof,
challenge replay, attempt drift, response-hash mismatch, wrong receipt signature or
key, receipt timeout after probe dispatch, and proof that Header/Preview activity
without a witness receipt cannot record history.

The challenge verifier requires the dedicated witness key purpose. The existing receipt
verifier is unchanged; the isolated recorder capability must be wired only to the same
protected witness-key authority. Live machine identity and key custody remain unimplemented.

## Still required before activation

1. Implement and authenticate the real witness service or equivalent independent
   observer, including key custody/rotation and durable one-use challenge claims.
2. Wire the pending-probe route and recorded-only public route without exposing the
   probe path to ordinary users or caching its body.
3. Install and verify the reviewed managed database contract with separately
   approved machine-role bindings; no SQL in `docs/sql` is a migration today.
4. Prove canonical-domain, alias, immutable-deployment, cache, feed/list/sitemap,
   rollback and outage behavior end to end, then obtain exact-head release approval.

Do not close #558 on this isolated component.
