# USD Impact Launch Email Template Matrix

## Status

Template contract version: `2026-09-02.v2`

This document records the approved source-level customer-message copy and security boundaries for the one-time Read the Dollar First Library Pass. The executable registry is `apps/web/src/lib/launch-email-templates.js`.

The registry is fail-closed and provider-neutral. It does not send email, register a provider, grant access, alter a commercial state, or replace real Preview/Production delivery proof.

The provider-neutral intent, eligibility, durable enqueue, and injected-adapter execution contract is `apps/web/src/lib/launch-email-dispatch.js`. Its operating boundary is documented in `launch-email-dispatch.md`. The dispatch module is disabled by default and does not register a sender, provider, webhook, Production migration, or business-event trigger.

## Template ownership

| Message | Source owner | Delivery boundary | Key customer statement |
|---|---|---|---|
| Secure sign-in | Supabase Auth configuration | Provider-managed | A secure account sign-in was requested |
| Purchase pending | USD Impact commerce operations | Shared after provider selection | Access is not granted before a verified completed-payment event |
| Access ready | USD Impact commerce operations | Application after verified event | The Library Pass is active and the account provides a simple learning path |
| Purchase failed | USD Impact commerce operations | Shared after provider selection | No access was granted from an incomplete attempt or browser redirect |
| Refund approved | USD Impact commerce operations | Application after verified event | Matching access was removed; provider controls refund timing |
| Dispute warning | USD Impact commerce operations | Application after verified event | Access is temporarily suspended while the dispute is reviewed |
| Chargeback complete | USD Impact commerce operations | Application after verified event | Matching access was revoked |
| Reversal restored | USD Impact commerce operations | Application after verified event | Matching access was restored only after an eligible verified reversal |
| Privacy export acknowledgement | USD Impact privacy operations | Application | Request recorded; export payload is never placed in ordinary email |
| Deletion requested | USD Impact privacy operations | Application | Deletion process started; unexpected requests should be escalated |
| Deletion completed | USD Impact privacy operations | Application | Account access ended; any approved hold remains controlled |
| Support case received | USD Impact support operations | Application | Request recorded; secrets and card data must not be sent by email |
| Waitlist confirmation | USD Impact editorial operations | Existing audited renderer | Consent-bound confirmation with one-click unsubscribe |
| Book availability | USD Impact editorial operations | Application | Review current price, scope, policies, and provider before payment |

## Security and compliance rules

Every app-owned template:

- uses deterministic plain-text and mobile-safe HTML output;
- contains only a bounded opaque business reference, never raw provider payloads;
- links only to canonical USD Impact routes or `support@usd-impact.com`;
- identifies the relevant state without promising an investment or financial outcome;
- avoids provider-specific customer copy until a replacement provider is approved;
- excludes scripts, forms, inputs, iframes, videos, remote tracking images, and unresolved placeholders;
- contains no raw card data, passwords, provider secrets, full authentication links, private learning responses, or privacy-export payloads;
- treats browser redirects as informational and never as proof of payment or entitlement.

Marketing and consent-bound templates additionally require:

- a current purpose-specific consent grant;
- a signed HTTPS `/unsubscribe?token=...` URL;
- `List-Unsubscribe` and `List-Unsubscribe-Post` headers;
- a consent explanation in both plain text and HTML.

Required authentication, security, account, purchase, entitlement, refund, dispute, privacy, deletion, and support messages must not depend on marketing consent.

## Reference handling

App-owned state templates accept only a bounded opaque reference matching the reviewed identifier pattern. The reference is used for customer support correlation and must not contain:

- an email address or customer name;
- a complete provider transaction payload;
- a secret, token, authorization header, or signed URL;
- card or bank data;
- private learning input;
- a privacy export.

The dispatch contract derives this customer-facing reference from the immutable business-state identity. The raw business-object identifier remains in the backend outbox record and is not copied into customer-facing message text.

## Provider boundary

`auth_sign_in` remains provider-managed. Its actual sender, subject, HTML, secure action URL, Site URL, redirect allowlist, and expiration behavior must be verified directly in Supabase Auth. The application registry and dispatch layer refuse to render or enqueue it and therefore cannot create a parallel or stale magic-link implementation.

Purchase, refund, dispute, and chargeback messages remain source-ready but inactive until Issue #53 selects a provider and maps Merchant-of-Record, tax, settlement, receipt, refund, dispute, and accounting responsibilities. Provider receipts do not replace USD Impact account/access/privacy/support communication unless the reviewed responsibility matrix explicitly says so.

The dispatch layer rejects the shared `purchase_pending` and `purchase_failed` boundaries unless the caller supplies an explicit reviewed responsibility approval. Application-owned messages still require an authoritative durable business event before enqueue. Before provider delivery, the dispatcher reloads the durable row and uses compare-and-set status and attempt-count conditions so concurrent workers fail closed rather than issuing parallel sends.

## Release gates still required

The source template and dispatch contracts do not close Issue #130. Before launch:

1. review the exact final copy against the selected provider and legal/accounting responsibilities;
2. wire each real business event through the provider-neutral dispatch contract using an immutable business-state identity and version;
3. prove idempotent enqueue and injected-adapter delivery for representative application-owned messages in Development;
4. prove duplicate suppression, bounce/complaint/suppression, and retry exhaustion in Development;
5. complete mobile and representative mailbox placement checks;
6. verify the provider-managed Production Auth template and callback;
7. apply and verify the Production email migration through the approved gate;
8. complete one controlled Production delivery lifecycle.

Until those gates pass, public checkout remains disabled and Issue #130 remains `RELEASE BLOCKED`.
