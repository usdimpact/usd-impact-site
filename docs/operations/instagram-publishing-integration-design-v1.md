# Instagram Publishing Integration Design v1 — 2026-09-18

Status: architecture-only specification. No Meta/Instagram connection, OAuth, token creation, scheduling, posting, merge, or Production deployment is authorized by this document.

## 1. Purpose

Define the narrow future publishing boundary that can accept only a fully approved USD Impact publish packet and deliver it to Instagram with least privilege, duplicate prevention, explicit status tracking, audit evidence, and fail-closed behavior.

The existing social-candidate layer remains authoritative for content generation. This future layer must not generate market claims or alter approved copy.

## 2. Preferred Meta authentication model

Preferred initial model: **Instagram API with Instagram Login** for a USD Impact Instagram Professional account.

Reason:

- narrower publishing-focused permission set;
- avoids requesting comments/messages permissions when those features are not required;
- does not require the social publisher to become a general-purpose Meta management client.

Initial requested scopes should be limited to:

- `instagram_business_basic`
- `instagram_business_content_publish`

Do **not** request by default:

- messaging permissions;
- comment-management permissions;
- ads permissions;
- tagging capabilities;
- unrelated Page management scopes.

If the account/provider configuration later requires the Facebook Login model, treat that as a separate reviewed auth variant because it introduces Page linkage and additional Page/Instagram permissions.

## 3. Account eligibility gate

Before any OAuth implementation:

1. confirm the intended USD Impact Instagram account exists;
2. confirm it is a Professional account suitable for API publishing;
3. confirm account ownership and recovery access;
4. confirm the business/operator identity allowed to authorize the app;
5. record the Instagram Professional Account ID after authorization;
6. record the authorization model used: `instagram-login` or `facebook-login`;
7. do not proceed if ownership/recovery is ambiguous.

## 4. Publishing flow

The future publisher should implement the provider container model:

```text
Approved publish packet
        ↓
Preflight validation
        ↓
Resolve final media URL(s)
        ↓
Create Instagram media container(s)
        ↓
Poll container status until terminal
        ↓
Publish media container
        ↓
Receive Instagram media ID
        ↓
Verify published media
        ↓
Persist audit/result record
```

No call to `media_publish` is allowed before the container reports a ready/finished state.

## 5. Media support

### Reels

Canonical input:

- verified captioned MP4;
- canonical cover asset if supported by the selected publishing path;
- approved caption;
- no provider auto-thumbnail dependency.

Before upload, validate at minimum:

- MP4/MOV container;
- supported H.264/HEVC video;
- AAC audio;
- 9:16 preferred;
- duration within provider limits;
- file size and bitrate within current provider limits;
- media URL reachable by Meta at publish time.

### Carousels

For each child item:

1. create child media container;
2. wait for child readiness when required;
3. create carousel container from ordered child IDs;
4. publish only the carousel container.

Preserve governed slide order exactly.

### Static image posts

Use the deterministic 4:5 image asset.

Where the provider supports image `alt_text`, use the approved alt text from the publish packet.

### Stories

Stories are out of the initial automated publishing increment unless separately verified and authorized. Story/quiz creative remains production-ready but should be operator-posted or separately implemented after the core feed/Reel path is proven.

## 6. Public media hosting

Meta fetches publishing media from a server-accessible URL.

Future implementation requirements:

- use a dedicated temporary publishing-media origin or signed-public delivery design;
- URL must remain reachable for the full container-processing window;
- do not expose protected Library assets;
- do not reuse expiring URLs unless their lifetime safely exceeds the provider processing window;
- never place access tokens in media URLs;
- remove or expire temporary publishing assets after verification according to retention policy.

The captioned MP4 is the canonical Reel file.

## 7. Publish packet contract

The publisher accepts only a packet already marked internally as ready for provider delivery.

Required immutable fields:

- `contentId`
- `candidateId`
- `contentFamily`
- `format`
- `finalMedia[]`
- `canonicalCover` where applicable
- `caption`
- `altText` where applicable
- `cta`
- `destination`
- `sourceIdentifier`
- `sourceCutoff`
- `freshnessStatus`
- `editorialApproval`
- `complianceApproval`
- `visualQaApproval`
- `captionQaApproval`
- `operatorApproval`
- `publishNotBefore` only when scheduling is separately authorized

Reject the packet if any required approval is missing.

## 8. Idempotency and duplicate prevention

Define a deterministic publish key:

```text
sha256(
  instagram-account-id
  + contentId
  + canonical media hash(es)
  + caption hash
)
```

Rules:

- one successful Instagram media ID per publish key;
- if a publish key already has a successful media ID, do not republish;
- if a previous attempt has an unresolved provider state, reconcile it before retrying;
- do not create a second container merely because a request timed out;
- retries must resume from recorded provider state where possible.

## 9. State machine

Allowed states:

- `held`
- `approved`
- `media_ready`
- `container_creating`
- `container_processing`
- `container_ready`
- `publishing`
- `published_unverified`
- `published_verified`
- `failed_retriable`
- `failed_terminal`
- `cancelled`

No backward transition from `published_verified`.

A network timeout is not automatically a failure; it is an unknown state requiring reconciliation.

## 10. Provider preflight

Immediately before creating a container:

- verify token validity;
- verify target Instagram account ID;
- verify current permission scopes;
- verify account can publish;
- check provider content-publishing quota/limit endpoint if applicable;
- verify media URL accessibility;
- verify final caption length/encoding;
- verify dynamic-content freshness again.

If any preflight check fails: **HOLD**.

## 11. Container polling

Polling requirements:

- bounded retries with backoff;
- inspect provider status code/status text;
- stop on terminal provider error;
- do not call publish before FINISHED/ready;
- record every provider container ID;
- record first-seen and last-checked timestamps;
- preserve provider error payload in sanitized audit evidence.

No access token may be written to logs.

## 12. Publish verification

After provider returns an Instagram media ID:

1. persist the ID immediately;
2. mark `published_unverified`;
3. fetch/read back the media where API support allows;
4. verify media identity/caption where possible;
5. perform operator-visible verification of cover, media order/audio and caption;
6. only then mark `published_verified`.

If the API publish response succeeds but verification is unavailable, do not retry publication. Hold as `published_unverified` for reconciliation.

## 13. Scheduling design

Scheduling is not part of the first provider-connection increment.

When separately authorized, scheduling must:

- store approved `publishNotBefore` in UTC;
- retain the user's editorial timezone separately for display;
- re-run freshness and approval gates immediately before execution;
- never publish a stale Daily/Weekly/Catalyst packet because it was approved earlier;
- support explicit HOLD/cancel before execution;
- use an idempotent queue/job key;
- avoid a single shared secret with unrelated production jobs.

A scheduled job is permission to re-evaluate and attempt publication, not a guarantee that the post must publish.

## 14. Secrets and tokens

Required controls:

- store tokens only in approved secret storage;
- never commit tokens, app secrets or recovery codes;
- never include tokens in issue comments, logs, screenshots or social packets;
- use separate Development/Preview/Production credentials where provider support permits;
- grant only the scopes required for publishing;
- define token expiry/refresh behavior before Production activation;
- support explicit revocation and rotation;
- use a dedicated social-publisher secret or provider credential boundary rather than reusing unrelated application secrets.

## 15. Data model — future implementation

Suggested logical records:

### `social_publish_jobs`

- id
- publish_key
- content_id
- candidate_id
- target_account_id
- state
- media_manifest
- caption_hash
- source_cutoff
- freshness_status
- publish_not_before
- created_at
- updated_at
- operator_id/reference

### `social_provider_attempts`

- job_id
- attempt_number
- provider
- container_ids
- provider_media_id
- provider_status
- sanitized_error
- started_at
- completed_at

### `social_publish_verifications`

- job_id
- provider_media_id
- verification_state
- verified_at
- operator_reference
- notes

Do not store access tokens in these tables.

## 16. Audit evidence

For every attempted provider action record:

- publish key;
- content ID;
- target account ID;
- packet version/hash;
- media hashes;
- provider container IDs;
- provider media ID;
- state transitions;
- timestamps;
- operator/automation identity;
- sanitized provider result;
- post-publication verification result.

## 17. Failure classes

### Auth failure

Examples:

- expired/revoked token;
- missing permission;
- wrong account relationship.

Action: HOLD. Do not retry until authorization is repaired.

### Media failure

Examples:

- unreachable URL;
- unsupported encoding;
- processing failure.

Action: fix media, derive a new media hash/publish key as appropriate, and create a new reviewed attempt.

### Freshness failure

Dynamic source no longer current.

Action: cancel job. Generate a new candidate from the current publication; do not reuse stale copy.

### Ambiguous publish result

Network/provider uncertainty after publish request.

Action: reconcile provider state/media IDs. Never blind-retry.

### Wrong public content

Corrective operator action may be required.

Action: HOLD related publishing, preserve evidence, correct/remove through approved provider/platform workflow, verify recovery.

## 18. Observability

Minimum operational signals:

- jobs by state;
- oldest unresolved job;
- container-processing duration;
- publish success/failure count;
- ambiguous publish states;
- duplicate-prevention events;
- auth failures;
- media-processing failures;
- stale-content holds;
- post-publication verification lag.

No token values or sensitive provider payloads in telemetry.

## 19. Rate / quota handling

Before bulk or scheduled publishing, query provider publishing limits where supported.

Rules:

- do not approach provider quota unnecessarily;
- carousel publication counts according to provider semantics;
- reject burst behavior caused by retry loops;
- quota exhaustion is a HOLD condition, not a reason to bypass the provider API.

## 20. Recommended implementation increments

### Increment A — Provider-readiness probe, read-only

- connect/authenticate in a non-publishing environment;
- verify account ID and scopes;
- verify quota endpoint;
- no container creation;
- no publish.

Requires separate explicit authorization.

### Increment B — Preview/test media container only

- create one controlled non-public/test container if provider semantics support it;
- verify processing/status;
- do not call `media_publish`.

Requires separate explicit authorization.

### Increment C — Single controlled publish

- one approved evergreen asset;
- explicit exact-asset authorization;
- publish;
- verify;
- record evidence;
- no schedule.

Requires separate explicit authorization.

### Increment D — Human-approved queue

- multiple approved packets;
- no autonomous selection;
- operator starts each publish.

Requires separate explicit authorization.

### Increment E — Scheduling

Only after duplicate prevention, reconciliation, incident handling and post-publication verification have proven reliable.

Requires separate explicit authorization.

## 21. Current decision boundary

This architecture intentionally adds **no**:

- Meta app;
- OAuth flow;
- provider token;
- Instagram account change;
- database table;
- Vercel/Supabase environment variable;
- API client;
- media upload;
- container creation;
- publish call;
- schedule;
- Production deployment.

PR #630 remains the draft/base-building boundary.
