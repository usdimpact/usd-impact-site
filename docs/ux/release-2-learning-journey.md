# Release 2: learning journey and welcome experience

Date: 2026-09-02

Release mode: default-off Preview pull request

Production impact: none until a separately approved merge

## Outcome

This release turns the signed-in account page into a useful learning home without introducing a new tracking system. It uses the account owner's existing `learning_progress` records to calculate a small summary and one next-step link.

The server returns only bounded counts and a validated internal URL. It does not return raw progress rows, quiz answers, mastery data, payment details, or provider metadata to the account page.

## Action list

| Priority | Action | Status | Evidence or guardrail |
| --- | --- | --- | --- |
| P0 | Add a clear recommended next step to the account page | Implemented | Falls back to Guided Edition when progress is empty or temporarily unavailable |
| P0 | Add a short “How to use USD Impact” path | Implemented | Guided Edition → audiobook/video reinforcement → Weekly Checklist/current research |
| P0 | Make library formats easier to scan | Implemented | Three compact cards with simple, decorative SVG icons and descriptive links |
| P0 | Base recommendations on existing account activity | Implemented | Owner-scoped Supabase request under current RLS; no service key and no schema change |
| P0 | Keep the existing access-ready email contract unchanged | Implemented | Release 2 does not change the global template version or any customer-message copy |
| P0 | Keep account access usable if progress storage fails | Implemented | Access response stays successful and returns a safe start recommendation |
| P1 | Verify keyboard, focus, screen-reader labels, desktop, and mobile in Preview | Pending Preview QA | Required before requesting merge |
| P1 | Run the full repository validation and production-equivalent build | Pending | Required before opening the Preview PR |
| P1 | Review the Vercel Preview runtime and function logs | Pending Preview QA | Preview only; no manual Production deployment |
| P2 | Improve the access-ready welcome email | Deferred | Requires per-template versioning or historical-render compatibility so existing outbox identities remain replay-safe |
| P2 | Add an email follow-up based on inactivity or progress | Deferred | Requires a separately approved purpose, trigger, cadence, consent/unsubscribe decision, idempotency, and Development proof |
| P2 | Include audiobook completion in recommendations | Deferred | No confirmed account-owned audiobook progress source exists; do not infer listening activity |
| P2 | Add more activity-based library recommendations | Deferred | First review real, privacy-safe usage patterns and define deterministic editorial rules |
| P2 | Recheck the public Production site with AccessibilityChecker | Scheduled separately | Quota-limited retry must scan the exact Production URL and must not modify the site |

## Recommendation rules

1. No active access: link to the Library Pass details.
2. Active access with no available progress: start with the Guided Edition.
3. An unfinished Guided Edition chapter or video: resume the most recently updated item.
4. Guided Edition activity but no video activity: explore the Video Library.
5. Completed Guided Edition and video activity: continue with the complete audiobook.

Only content IDs matching the known Guided Edition, Video Library, or Daily Card namespaces are counted. Duplicate and malformed rows are ignored, percentages and counts are bounded, and at most 500 rows are considered.

## Platform boundaries

- **Supabase:** read-only owner-scoped query against the existing `learning_progress` table; current RLS remains authoritative; no migration, policy, auth, entitlement, customer, or payment change.
- **Cloudflare:** Stream and R2/bucket audio delivery are unchanged. The account page only links to existing protected routes.
- **Vercel:** the proposed change is limited to one automatic Preview deployment from the PR. No manual redeploy or Production promotion.
- **Email:** template version, customer-message copy, outbox identity, and dispatch behavior remain unchanged. Welcome and activity follow-ups require a separate compatibility-safe release; no email is dispatched as part of development or QA.
- **HeyGen/OpenAI:** no new generated media or AI runtime is needed for this bounded release.

## Merge gate

Do not merge until targeted tests, the full validation suite, a production-equivalent build, Preview deployment status, runtime logs, and core desktop/mobile account flows pass. Any Production merge or deployment requires separate explicit approval.
