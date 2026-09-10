# Publication OIDC evidence bridge - #558

## Status and scope

Prepared dormant follow-up to draft PR #559. This is not an installed route,
observer, token requester, signer service, database migration, admission writer,
publication gate, or serving authorization. Both #559 and alternative #560 stay
unmerged. No further diagnostic or identity rehearsal is needed for this preparation.

The repaired identity-only prerequisite was completed by run 34514961715, attempt 1,
on main ae80da61e0096eed52c97092c189c56374c224b5 using runner
966d3f9ef730ce0a3948be3b7fa292cb58cd5b49. That run's synthetic audiences and sanitized
PASS report cannot be used as publication evidence. Its one-run authorization is
consumed. The installed rehearsal, its fingerprints, all source branches, and the
completed diagnostic remain unchanged.

This packet targets #559 source 8686bb9258a8c97644c092c47288673f06fe7006. It adds a
pure dual-proof verifier and offline tests, with one import in the existing
publishing-validation driver. It deliberately preserves the existing independent
Ed25519 challenge and first-public-dispatch/v2 receipt protocol. An OIDC-only
replacement of those signatures would be a different, separately reviewed design.

## Proof composition

GitHub permits a requesting workload to choose an audience. It signs execution
identity claims; it does not inspect the article bytes represented by an audience.
Consequently this bridge requires BOTH existing Ed25519 signed artifacts and the
GitHub identities that bind themselves to those exact artifacts.

1. Verify the existing signed challenge against protected witness-key state and the
   prepared attempt's deployment, canonical origin, path, response hash and manifest.
2. Require the durable stored claim to match the exact challenge ID, signed-envelope
   digest and manifest digest. Verify the existing v2 receipt against the complete
   prepared binding and that claim. Both signed artifacts must use the exact
   prepared witness key ID and public-key fingerprint.
3. Recompute, rather than accept, the challenge audience evidence digest:

   SHA256("usd-impact/publication-oidc-evidence/challenge/v1\n" + rawChallengeEnvelope)

4. Verify the challenge JWT with the unchanged GitHub RS256 verifier. The exact
   caller/reusable-workflow revisions, repository, protected main, manual event,
   hosted runner, approved run ID, attempt 1 and approved job ID must match.
5. Recompute the receipt digest as SHA256 of the prefix
   "usd-impact/publication-oidc-evidence/receipt/v1\n" followed by compact JSON with
   these fields in order: challengeEvidenceSha256, challengeTokenSha256, receiptSha256.
   The latter two hash the exact raw challenge JWT and raw signed v2 receipt.
6. Verify the receipt JWT using that digest and the freshly authenticated challenge
   run context. This retains same-run/job/attempt, distinct-jti and issue-time
   continuity. Neither a claim-provided digest nor a precomputed PASS is trusted.
7. Recheck a common final exclusive deadline: policy, prepared attempt, challenge,
   stored claim, signed receipt, witness key/snapshot, JWKS, both JWT expirations,
   and BOTH JWT application-age limits. The earliest bound wins.

The original JWT verifier allows an inclusive application-age boundary; this bridge
uses an exclusive combined deadline, a conservative stricter final boundary. It
makes no new claim of subsecond causal ordering between clocks at different services.

## Interface and trust boundary

`createPublicationOidcEvidenceBridge({ workflowPolicy, now })` returns a synchronous
verifier. `now` defaults to Date.now; clock injection is for tests/trusted server
construction, never a request or workflow input. The configured policy is captured
as an immutable, bounded plain-data snapshot. It names a separately reviewed witness
workload and exact revisions, approved run/job/attempt and a window no longer than
15 minutes. Rehearsal/diagnostic workflow names are rejected. No production witness
workflow name or immutable pin is invented by this packet; tests use synthetic refs.

The canonical request is a UTF-8 JSON string, at most 100,000 bytes, with exactly:

- schema: publication-oidc-evidence/v1
- challengeEnvelope: the original signed challenge JSON string
- challengeToken: the compact challenge JWT
- receiptEnvelope: the original signed v2 receipt JSON string
- receiptToken: the compact receipt JWT

Order, spelling, canonical serialization, duplicate-key rejection and individual
existing envelope/token size limits are checked. Trust snapshots, URLs, clock,
expected digests, verification flags and overrides are not request fields.

The verifier's SECOND argument is protected server data with exactly:
`attempt`, `challengeClaim`, `witnessKeySnapshot`, `jwksSnapshot`.
The attempt projection has attemptId, state, keyId, keyFingerprint, validUntil and
binding. The existing complete v2 binding/claim/key/JWKS schemas are retained. This
argument must be independently loaded by a trusted recorder, NOT copied out of an
HTTP request. Normalized JWKS must come from GitHub's fixed trusted discovery/key
source. A caller allowed to replace trusted keys or policy can forge trust; structural
validation is not a substitute for protected data provenance.

Snapshots reject accessors, executable/nonplain values, cycles/shared collections,
reserved/symbol/hidden keys, sparse arrays and excessive structure without calling
getters or toJSON. This does not sandbox hostile JavaScript adapters or Proxy traps;
adapters, the policy loader and the clock are trusted code.

Digest helpers `publicationChallengeEvidenceSha256` and
`publicationReceiptEvidenceSha256` only build bounded syntactic commitments. They
DO NOT verify signatures. Their errors contain fixed codes rather than input text.

## Result semantics

Successful verification returns VERIFIED_IDENTITY_BOUND_WITNESS_EVIDENCE, bound
hashes, approved execution identifiers and verificationDeadline. It asserts only
that the signatures and execution identities matched the protected snapshot.
It does not return raw tokens, jti, full claims, signed payloads, private keys or URLs.

These flags always remain false, including on success:
publicationAuthorized, admissionRecorded, enforcementActive, publicResponseObserved,
and replayConsumed. Partial failures also clear identityAuthenticated, witnessLinked
and evidenceBound. Failure codes are fixed and sanitized.

**This verifier is intentionally stateless.** Re-verifying an identical packet against
an unchanged pending snapshot can succeed twice. Only the future restricted atomic
recorder may consume the durable claim. A cached verifier result, previously valid
policy, or old snapshot must not authorize a later database operation or public
response. The existing recorder is NOT modified by this packet.

## Required subsequent integration

- Load current attempt, claim, witness-key/JWKS and active execution policy through
  protected adapters; re-read and compare them immediately before the governed
  atomic write. Construct from fresh policy; the captured policy does not detect
  later external revocation by itself. Preserve drift, outage and uncertain-write
  fail-closed behavior and no blind retries.
- Implement the independent canonical-origin observer and authenticated transport.
  Neither a signed assertion, JWT audience, Host header nor local finish event alone
  proves genuine independent delivery. Protected signer custody/rotation and real
  observation remain live prerequisites; this dual-proof design keeps those gates.
- Define how exact OIDC evidence and the existing v2 receipt are atomically recorded
  with the one-use claim. The combined packet is NOT compatible with the existing
  recorder's 24,000-byte signed-receipt input. Do not forward it blindly or silently
  widen that interface. No SQL, grants, routes or claim-consumption code changes here.
- Complete recorded-only serving across article/feed/index/JSON/sitemap/caches,
  aliases, immutable deployments, promotion/rollback and outage recovery. Prove a
  stale preview cannot become newly public after its release boundary. Existing
  calendar coverage and fresh official-source verification remain separate gates.

## Offline verification

Run from apps/web: `node scripts/test-publication-oidc-evidence-bridge.mjs`.
The existing validate-publishing.mjs driver adds that same test immediately after the
retained GitHub OIDC suite. No workflow/permission/dependency changes are required.

The suite uses ephemeral RSA/Ed25519 keys, synthetic signed artifacts, synthetic
JWKS, prepared-state snapshots and a fixed injected clock. It exercises valid
preview/outcome/Daily forms, domain-separated byte binding, exact approved execution,
same-job continuity, invalid signatures, claim/manifest/key substitution, stale and
revoked state, final deadline crossings, ambiguous inputs, immutable snapshots,
sanitation and the explicitly unconsumed replay boundary. No real network, token,
article, database, deployment or publication is involved. Test counts/engine and
negative-control outcomes belong in the preparation evidence, not live assertions.

## Sources and checkpoints

- GitHub OIDC reference: https://docs.github.com/en/actions/reference/security/oidc
- Reusable-workflow identity: https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-with-reusable-workflows
- Completed live prerequisite: https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5623623573
- Existing independent receipt contract: publication-witness-receipt-v2-558.md

Keep #558 open. Staging, installation, protected storage/identity roles, real observer
execution and final publication-enforcement activation are separate gates.
