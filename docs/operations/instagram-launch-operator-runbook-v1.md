# Instagram Launch Operator Runbook v1

Status: pre-publication operational specification. No credentials, Meta connection, scheduling or live posting are authorized by this document.

## 1. Purpose

Define the human-controlled path from an approved USD Impact social candidate to a post-ready package while preserving source authority, compliance, accessibility and rollback/hold controls.

## 2. Roles

### Source owner
Confirms the governing Daily, Weekly Score, Catalyst or Report source artifact is correct and current.

### Editorial reviewer
Confirms one primary lesson, clear fact/interpretation separation, correct CTA and no unsupported certainty.

### Compliance reviewer
Confirms educational framing and absence of personalized recommendations, trading instructions, guarantees or unsupported forecasts.

### Creative reviewer
Checks final media, cover, captions/subtitles, safe areas, typography, diagrams and mobile readability.

### Publishing operator
Performs the final platform action only after all gates are green.

One person may hold multiple roles, but the checks remain distinct.

## 3. Publish packet

Every post-ready packet must contain:

- canonical content ID;
- final media asset;
- canonical cover;
- final caption;
- alt text;
- CTA and destination;
- source artifact and cutoff;
- evidence/source references where applicable;
- freshness state;
- editorial approval;
- compliance approval;
- visual QA approval;
- caption/subtitle QA;
- operator identity;
- intended publish date/time if later authorized.

If any required field is missing: **HOLD**.

## 4. Fail-closed rules

Set status to HOLD if any of the following is true:

- source cannot be verified;
- current content is stale;
- event result is not yet verified;
- dynamic source edition/week is wrong;
- CTA destination is broken or mismatched;
- product claim no longer matches Production;
- captioned video is missing where required;
- cover/media mismatch exists;
- final media contains a visual hallucination or incorrect label;
- compliance wording is ambiguous;
- account/publishing ownership is unclear;
- platform returns a partial/uncertain result.

Do not substitute another dated post simply to fill a slot.

## 5. Launch-day first-nine procedure

1. Confirm canonical sequence.
2. Resolve slot 7 from the current Daily or select IG-008 fallback.
3. Resolve slot 9 from current Weekly Score or select IG-007 fallback.
4. Re-test Start Here, Daily, Score and any other CTA destinations.
5. Recheck PIN-003 against current platform navigation and product wording.
6. Review all nine covers at phone scale.
7. Review every Reel using the captioned MP4.
8. Check SRT against spoken narration.
9. Confirm captions, alt text and one CTA per post.
10. Confirm editorial/compliance approval.
11. Only after separate publishing authorization, execute platform actions.

## 6. Post-publication verification

Immediately after a post is created:

- confirm correct media;
- confirm cover;
- confirm caption;
- confirm alt text where supported;
- confirm link/profile destination;
- record Instagram media/post ID;
- record published timestamp;
- verify no accidental crop or muted/failed audio state;
- verify carousel order if applicable.

If the wrong asset/caption is public, use the platform's normal correction/removal path under operator control. Do not silently leave a known wrong version live.

## 7. Measurement contract

Collect at consistent checkpoints where available and privacy-compliant.

### Reels
- plays/views;
- average watch time;
- completion rate;
- replays where exposed;
- saves;
- shares;
- comments;
- profile visits;
- website/profile-link actions.

### Carousels
- reach/views;
- swipe/completion proxy where available;
- saves;
- shares;
- comments;
- profile visits;
- destination actions.

### Stories
- views;
- completion;
- exits;
- replies;
- poll/quiz responses;
- link actions where used.

### Funnel
- Start Here visits;
- Daily visits;
- Weekly Score visits;
- report visits;
- free sample visits;
- Library evaluation/conversion where attribution is privacy-compliant.

## 8. Snapshot timing

Recommended analysis windows:

- 24 hours: delivery and early quality;
- 7 days: topic/format performance;
- 30 days: durable saves, shares and funnel effects.

Do not make editorial decisions from one post alone.

## 9. Review dimensions

After the first 30 published posts, compare by:

- content family;
- format;
- hook type;
- duration;
- CTA;
- evergreen vs current-context;
- educational depth;
- completion/saves/shares;
- downstream site behavior.

Do not optimize solely for likes or follower count.

## 10. Incident classes

### Wrong content
Wrong media, caption, cover, carousel order or post ID.

### Stale/current-context error
A Daily/Weekly/Catalyst post is no longer appropriate for the intended publish time.

### Compliance error
Advice-like wording, guarantee, unsupported forecast or misleading certainty appears.

### Destination error
CTA points to a broken, gated or wrong route.

### Platform error
Upload, audio, cover, processing or visibility behaves unexpectedly.

For any incident: HOLD further related posts until root cause is known.

## 11. Recovery evidence

For each meaningful incident record:

- affected content ID;
- post/media ID;
- time detected;
- symptom;
- impact;
- action taken;
- root cause;
- corrected asset/version;
- verification result.

## 12. Security / credential boundary

Instagram/Meta credentials, tokens, OAuth grants and recovery secrets must remain outside repository content and be stored only in approved provider secret storage when a separately authorized publishing integration is implemented.

Do not place credentials in captions, docs, commits, issue comments, logs or screenshots.

## 13. Automation boundary

Candidate generation and QA packet assembly may be automated later.

Public posting remains human-controlled until a separately reviewed implementation explicitly authorizes:

- provider connection;
- credential model;
- permission scopes;
- scheduling;
- idempotency;
- duplicate prevention;
- audit logging;
- rollback/recovery;
- post-publication verification.

## 14. Current status

PR #630 is the draft/base-building boundary. This runbook does not authorize merge, Production deployment or live Instagram actions.
