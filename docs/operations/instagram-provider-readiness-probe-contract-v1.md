# Instagram Provider-Readiness Probe Contract v1 — 2026-09-18

Status: design-only. This document defines a future read-only readiness check. It does not authorize or perform Meta/Instagram login, OAuth consent, token creation, media-container creation, scheduling, posting, merge, or Production deployment.

## Objective

Prove that the intended USD Impact Instagram account and future Meta app can support the narrow publishing integration **before** any media container is created.

This is Increment A from the publishing integration design.

## Allowed future actions under Increment A

Only after separate explicit authorization:

1. authenticate the designated operator through the chosen Meta login flow;
2. retrieve the authorized Instagram Professional Account identity;
3. inspect granted publishing scopes;
4. verify the target account is the intended USD Impact account;
5. query read-only publishing capability/quota information where supported;
6. return sanitized readiness evidence.

No create/update/delete/publish provider action is permitted.

## Preferred auth path

Primary candidate:

- Instagram API with Instagram Login
- `instagram_business_basic`
- `instagram_business_content_publish`

Do not request message/comment/ads/tagging permissions in the initial publishing-only probe.

If the account setup forces the Facebook Login path, stop and re-evaluate the required Page linkage and Page-scoped permissions before proceeding.

## Required input facts

These facts must be known or resolved during the future probe:

- intended Instagram handle;
- intended Instagram Professional Account ID;
- business/operator who owns the authorization;
- Meta app ID/name;
- auth model: Instagram Login or Facebook Login;
- redirect URI(s);
- environment: Development / Preview / Production;
- approved secret-storage destination;
- intended publishing surface: Reels + feed images/carousels initially.

Do not record access-token values in the readiness evidence.

## Readiness evidence packet

A successful probe should produce:

```json
{
  "provider": "meta-instagram",
  "environment": "development|preview|production",
  "authModel": "instagram-login|facebook-login",
  "appId": "<non-secret identifier>",
  "instagramAccountId": "<non-secret identifier>",
  "instagramUsername": "<expected handle>",
  "accountType": "professional",
  "scopes": [
    "instagram_business_basic",
    "instagram_business_content_publish"
  ],
  "scopeCheck": "pass",
  "accountIdentityCheck": "pass",
  "publishingCapabilityCheck": "pass",
  "quotaCheck": {
    "supported": true,
    "status": "pass"
  },
  "containerCreationAttempted": false,
  "publishAttempted": false,
  "tokenLogged": false,
  "readyForNextIncrement": false,
  "nextBoundary": "explicit approval required for container-only test"
}
```

`readyForNextIncrement` stays false until the evidence packet has been reviewed.

## PASS criteria

The read-only probe can be classified PASS only if:

- the authorized account is the intended USD Impact Instagram account;
- the account is eligible for professional API publishing;
- the expected publishing scopes are present;
- no unrelated permissions were granted beyond the reviewed set, unless separately justified;
- the token is usable for read-only account/capability checks;
- quota/capability lookup succeeds where supported;
- no write operation was attempted;
- evidence contains no secret/token value;
- operator/recovery ownership is documented outside secrets.

## WARN criteria

Examples:

- expected account is found but extra non-critical permissions are present;
- provider quota endpoint is temporarily unavailable while core auth/account checks pass;
- account metadata is correct but app review/Production-mode eligibility is incomplete;
- Development works but Production authorization is not yet available.

WARN does not authorize the next increment.

## FAIL criteria

Examples:

- wrong Instagram account;
- consumer/personal account instead of Professional account;
- missing content-publish scope;
- authorization belongs to an unexpected business/operator;
- token cannot query the authorized account;
- Page relationship is required but unresolved under the selected auth model;
- provider/account restrictions prevent content publishing;
- credentials would need to be exposed in repository/docs/logs;
- any write/container/publish operation occurs during the probe.

## Security controls

The future probe must:

- mask tokens from logs;
- never serialize tokens into GitHub, issues, PR comments, screenshots or evidence files;
- use environment-specific secret storage;
- avoid browser local-storage exports in shared artifacts;
- avoid long-lived plaintext token files;
- record only token metadata such as expiry timestamp or token type when safe and useful;
- support immediate revocation if the wrong account is authorized.

## No-op verification

At completion, explicitly assert:

- no media container created;
- no media uploaded;
- no draft post created;
- no Story/Reel/feed post published;
- no schedule created;
- no Instagram profile setting changed;
- no comment/message permissions used;
- no Production code or environment changed unless that separate action was explicitly authorized.

## Manual operator checkpoints

If/when Increment A is authorized, stop for manual intervention only when Meta itself requires an interactive account/business consent step that cannot be completed safely through the connected tooling.

The operator must visually confirm:

- account/handle being authorized;
- business/app identity;
- permissions requested;
- no unexpected permission class.

## Next authorization boundary

A successful probe supports, but does not authorize:

**Increment B — one controlled media-container processing test with no `media_publish` call.**

That future increment must specify:

- exact evergreen test asset;
- exact environment;
- exact account;
- exact media hash;
- public media URL lifetime;
- expected container status sequence;
- cleanup/retention behavior;
- explicit prohibition on `media_publish`.

## Current state

Not executed.

PR #630 remains the governed non-publishing base.


## Probe execution record — 2026-09-18

Increment A was attempted read-only.

### Direct Instagram browser path

Result: **AUTH_REQUIRED**

Evidence:

- Instagram opened to the login page.
- No valid authenticated Instagram session existed in the browser profile.
- No credentials were configured in the browser profile.
- No login attempt, signup, recovery, profile change, OAuth flow, container creation, schedule or publication was attempted.
- Account handle, Professional status, ownership/recovery context and linked Meta business state remain unverified through the direct browser path.

Zero writes confirmed.

### Existing connected-tool path

The installed Windsor.ai plugin exposes an `instagram` connector.

Current state:

- connector exists;
- no Instagram account is currently connected;
- auth type is OAuth;
- connector setup URL is available through Windsor;
- supported write actions include image post, video post/Reel, carousel post, Story and comment operations;
- no write action was executed during this probe.

This creates two future provider options:

1. **Windsor delegated provider path** — preferred for the first controlled readiness/publish tests because provider credentials remain delegated outside the USD Impact repository/runtime.
2. **Direct Meta API path** — retained as the long-term self-hosted integration option when automation, scheduling, audit control or independence from the ChatGPT/Windsor execution surface justifies it.

The Windsor path does not change the current authorization boundary. Connecting the Instagram connector still requires an explicit user OAuth action.

### Current Increment A state

**PARTIAL / AUTH_REQUIRED**

Verified:

- provider connector availability;
- OAuth connection mechanism;
- supported Instagram post action surface;
- zero-write behavior.

Still required:

- user authorizes the intended USD Impact Instagram account through the connector;
- re-run connector discovery;
- verify exact connected account ID/name;
- verify it is the intended Business/Creator account;
- confirm ownership/recovery context;
- confirm read fields/capabilities and any provider quota/status fields exposed.

Do not proceed to any write action until the connected account identity has been reviewed.
