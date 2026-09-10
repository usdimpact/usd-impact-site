# GitHub Actions OIDC witness identity candidate - issue 558

## Status

Dormant verifier-only candidate for PR #559. It does not add or modify a GitHub
Actions workflow, request an OIDC token, grant `id-token: write`, create a secret,
register a route, install database SQL, or change Vercel/Production configuration.
`publicationAuthorized=false` and `enforcementActive=false` remain mandatory.

## Why evaluate GitHub OIDC

The first-response witness now has challenge-linked receipt v2 semantics, but a live
activation still needs a provider-authenticated independent witness identity and
protected key custody. GitHub Actions OIDC can remove the long-lived witness signing
secret from that design: GitHub signs short-lived identity tokens with its OIDC keys,
and a workflow can request a custom audience that binds the token to an exact
challenge or receipt digest.

Current GitHub documentation identifies the fixed issuer
`https://token.actions.githubusercontent.com`, the official JWKS endpoint, RS256
signing, custom audiences, and claims including repository/repository ID, protected
ref, event SHA, workflow ref/SHA, reusable workflow ref/SHA, run ID/attempt,
GitHub-hosted runner environment and check-run ID. The repository currently has an
active default-branch ruleset with no bypass actors. These are useful trust inputs,
but no OIDC workflow permission is enabled by this candidate.

References:
- https://docs.github.com/en/actions/reference/security/oidc
- https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-with-reusable-workflows
- https://token.actions.githubusercontent.com/.well-known/openid-configuration
- https://token.actions.githubusercontent.com/.well-known/jwks

## Proposed trust model

A future protected controller on `main` would call an immutable reusable witness
workflow on a GitHub-hosted runner. The reusable workflow reference should be pinned
to a reviewed commit SHA. Only that job would receive `id-token: write`; it should
retain `contents: read` and no repository/provider write permission unless separately
approved.

For a challenge, the job would request a token with an audience shaped as:

`urn:usd-impact:public-witness:challenge:sha256:<exact-evidence-sha256>`

For a receipt after the canonical fetch/hash check, the same run would request a
second token with:

`urn:usd-impact:public-witness:receipt:sha256:<exact-evidence-sha256>`

The evidence digests must cover the already-defined canonical origin, attempt,
deployment, path, response hash and one-use challenge coordinates. The verifier
prototype does not define or authorize the workflow that computes those digests.

## Verifier contract

`publication-github-oidc-witness.js` is provider-specific but side-effect free. It
accepts a token, a fresh normalized JWKS snapshot supplied by a server-only adapter,
and exact expected workflow/audience context. It never fetches a token or network
resource itself.

It requires:

- GitHub's exact issuer and RS256;
- a known key ID from a bounded fresh JWKS snapshot and an RSA key of at least 2048 bits;
- repository `usdimpact/usd-impact-site`, repository ID `1265351071`, owner
  `usdimpact`, and owner ID `275107298`;
- `refs/heads/main`, branch ref type and `ref_protected=true`;
- public repository visibility and a `github-hosted` runner;
- exact `workflow_dispatch` caller event;
- exact caller workflow ref and exact caller/event SHA;
- exact reusable witness workflow ref pinned to its exact workflow SHA;
- exact custom audience for the challenge or receipt evidence digest;
- bounded `nbf`/`iat`/`exp` lifetime and token age;
- exact run ID, run attempt and check-run ID continuity from challenge token to
  receipt token; and
- a distinct receipt token `jti` issued no earlier than the challenge token.

The success decision is `VERIFIED_GITHUB_OIDC_WITNESS_IDENTITY`. It authenticates a
GitHub Actions execution identity only. It cannot authorize publication or prove that
a canonical response was actually received.

## Important limitation

OIDC eliminates a separately stored witness private key only if the OIDC token itself
becomes the attestation signature. It does not magically prove the HTTP fetch. Trust
still depends on exact reviewed witness workflow code and GitHub's hosted execution
environment. A future receipt protocol must bind its post-fetch evidence digest to
the second token's custom audience and must verify the exact immutable reusable
workflow SHA.

No live workflow exists in this candidate. The repository currently contains no
`id-token: write` grant. Adding such a workflow is a protected security/permission
change and requires separate exact-scope approval. A live design must also decide
how the Vercel-side verifier obtains and refreshes GitHub's JWKS without turning a
JWKS outage into authorization, and how canonical fetch timeouts/retries interact
with the 15-second first-publication evidence window.

## Verification

`test-publication-github-oidc-witness.mjs` uses synthetic RSA/JWKS material. It tests
official discovery normalization, valid protected-main identity, challenge-to-receipt
run continuity, wrong issuer/audience/repository/IDs/ref/runner/event/workflow SHAs,
run drift, token replay identity, expiry/future/stale tokens, unknown or weak keys,
duplicate JWKS key IDs, stale JWKS, algorithm substitution, non-exact audience and
forward-compatible extra signed claims.

Tests are offline synthetic protocol tests. They are not a live GitHub OIDC token,
not a workflow permission, not an independent canonical-domain observation and not
release approval.

## Protected next step if this architecture is accepted

A later exact approval would be required to add one minimal reusable witness workflow
and caller with narrowly bounded permissions, then exercise a Development/Preview
rehearsal. That request must name the exact workflow files, trigger model, permissions,
immutable reusable workflow pin, expected main/base/head, allowed network destination,
and prove that no merge/Production alias or database admission can occur from a
failed/missing OIDC receipt.

Do not merge PR #559 or close #558 based on this verifier-only candidate.
