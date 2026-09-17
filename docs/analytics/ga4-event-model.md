# GA4 event model

Status: draft implementation companion to the consent-gated GA4 foundation.

## Principles

- GA4 events are sent only after the existing USD Impact analytics consent is granted.
- GA4 receives only an allowlisted subset of the already disclosed first-party telemetry events.
- No email address, account identifier, entitlement identifier, payment identifier, persistent USD Impact session identifier, quiz answer choice, correct answer, or payment detail is sent to GA4.
- Browser checkout events are funnel signals only. They are not treated as evidence of a completed purchase.
- Purchase completion is intentionally excluded until it can be emitted from verified commerce state rather than inferred from client navigation.

## Initial event set

| GA4 event | Trigger | Parameters |
| --- | --- | --- |
| `checklist_download` | Weekly Dollar Regime Checklist download | none |
| `checkout_view` | Checkout page viewed after analytics consent | none |
| `checkout_button_click` | Visible secure-checkout button clicked | none |
| `checkout_sign_in_redirect` | Checkout redirects to the secure sign-in boundary | none |
| `quiz_start` | Quiz start | `quiz_id` |
| `quiz_retry` | Quiz retry | `quiz_id` |
| `quiz_complete` | Quiz result becomes available | `quiz_id`, `outcome`, `score`, `question_count` |

## Conversion/key-event policy

Do not mark browser checkout events as purchase conversions. A future `purchase` event must be tied to a verified provider/webhook-backed transaction and deduplicated by a provider transaction identifier on the server side. That future event should include only the GA4 commerce fields required for aggregate reporting and must not expose payment credentials or direct account identifiers.

## Next candidates

Newsletter subscription, sign-in success, Guided Edition engagement, audiobook engagement, video engagement, and report/learn interactions require separate contracts because they touch authenticated state, delivery state, or additional user-behavior semantics. They are intentionally outside this first increment.
