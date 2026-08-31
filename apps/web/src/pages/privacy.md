---
layout: ../layouts/LegalLayout.astro
title: "Privacy Notice | USD Impact"
description: "How USD Impact handles account, purchase, support, waitlist, Daily Learning email, and limited learning information."
---

# Privacy notice

_Last updated: August 31, 2026_

## What we collect

When you join the *Read the Dollar First* waitlist, we collect the email address you submit and the time the contact record is created.

When you separately subscribe to USD Impact Daily Learning email, we collect the email address you submit, the consent purpose and version, the time consent is recorded, and any later withdrawal record. Daily Learning email consent is stored separately from book-waitlist consent.

If you create an account or purchase the Guided Interactive Edition, we may process:

- your email address and authentication records needed to secure your account;
- payment-provider customer, transaction, refund, and adjustment identifiers;
- purchase status, price tier, currency, and entitlement status;
- learning progress and quiz results associated with your account;
- video viewing position, completion status, and the film identifier needed to resume playback; and
- account, billing, refund, deletion, or support requests you send to us.

Payment-card details are collected and processed by **Lemon Squeezy**, the selected Merchant of Record, under its [Privacy Notice](https://www.lemonsqueezy.com/privacy). USD Impact does not receive or store complete payment-card numbers or card security codes.

If you permit aggregate analytics, the website records limited first-party learning and checkout-funnel events needed to understand whether educational resources and the purchase path work. These events can include:

- a Weekly Dollar Regime Checklist download;
- a quiz start or retry;
- quiz completion, pass or fail outcome, and aggregate score;
- a checkout-page view, checkout-button click, or redirect to secure sign-in;
- the page route where the event occurred; and
- campaign values explicitly present in `utm_source`, `utm_medium`, or `utm_campaign` URL parameters.

This telemetry does not include quiz answer choices, correct answers, email addresses, account identifiers, advertising identifiers, persistent session identifiers, payment details, or raw IP addresses in the application event record. Checkout-funnel counts are aggregate events, not unique visitors and not evidence of a buyer or completed purchase.

## Cookies, browser storage, and consent

USD Impact uses a small first-party privacy control rather than an advertising-oriented consent platform. On a first visit, aggregate analytics remains off unless you select **Accept analytics** or enable it under **Review settings**. **Reject analytics** is available at the same level. You may later change or withdraw this choice through **Privacy settings** in the website footer. A withdrawal stops future optional analytics events from this browser; it does not affect processing that was lawful before withdrawal.

The current first-party cookie inventory is:

- `usd_impact_consent`: stores only privacy-choice version `v1` and whether aggregate analytics was accepted or rejected; retained for up to 180 days so the website can remember the choice;
- `usd_impact_access`: short-lived, HTTP-only authentication access cookie; retained for up to one hour after successful sign-in;
- `usd_impact_refresh`: HTTP-only authentication refresh cookie needed to maintain a signed-in account securely; retained for up to 30 days; and
- `usd_impact_pkce`: temporary HTTP-only proof used to complete one-time email-link authentication safely; retained for up to 10 minutes.

Authentication cookies use `Secure` on HTTPS, `SameSite=Lax`, and the narrow purpose described above. They are not used for advertising or cross-site profiling. The consent cookie is considered essential because, without it, the site cannot remember a rejection or withdrawal and would have to ask again on every page.

The account sign-in page loads Cloudflare Turnstile for abuse prevention. Turnstile processes the security request and returns a short-lived verification token; Cloudflare may use security data or a clearance cookie when its challenge features apply. USD Impact does not use Turnstile for advertising. See the [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/).

USD Impact does not use browser `localStorage` or `sessionStorage` for consent or aggregate analytics. The website's service worker is network-only, does not create an application content cache, and is registered only after a signed-in user explicitly selects **Enable notifications** and grants browser permission. Disabling notifications removes that browser's push subscription and service-worker registration.

## Why we collect it

Waitlist information is used only to:

- confirm that you joined the waitlist;
- send the purchase link when the book becomes available; and
- send essential availability updates directly related to the book.

Daily Learning email information is used only to send the educational Daily Card series you explicitly requested and to maintain delivery, suppression, and unsubscribe evidence for that series. Subscribing to Daily Learning does not subscribe you to the book waitlist, unrelated promotions, or trading alerts.

Account and commerce information is used to:

- authenticate your account and protect it from unauthorized access;
- create and confirm checkout transactions;
- grant, maintain, suspend, refund, or revoke paid access when required;
- prevent duplicate purchases and reconcile payment events;
- answer account, billing, refund, and deletion requests; and
- meet fraud-prevention, accounting, tax, and other legal obligations.

When you permit it, learning and checkout-funnel telemetry is used to:

- measure whether the checklist and quizzes are used;
- identify completion and retry patterns;
- improve question clarity and the learning sequence;
- detect failures in educational workflows; and
- understand aggregate movement from the checkout page to the secure sign-in boundary without tracking a person.

Joining the waitlist does not subscribe you to unrelated market commentary, trading alerts, or third-party promotions.

## Service providers

The website is deployed through Vercel. Vercel processes website requests and application runtime logs needed to operate and troubleshoot the service. Cloudflare Stream processes protected video playback requests and delivers the adaptive video and caption files requested by an authorized account. Aggregate learning and checkout-funnel counters and short-lived duplicate-event identifiers are stored through Upstash Redis connected to the Vercel project. Account, entitlement, commerce, consent, notification-delivery, and saved video-progress records are stored through Supabase. Waitlist contacts and requested email delivery are processed through Resend. When public checkout is separately enabled, Lemon Squeezy processes payment, tax, buyer financial-document, refund, fraud-prevention, and related transaction information as Merchant of Record. Applicable indirect taxes are calculated, collected and remitted by Lemon Squeezy as Merchant of Record and shown before payment. USD Impact remains responsible for the account, product access, learning records, and product-support information it processes.

These providers process information only as needed to operate the website, accounts, learning tools, commerce workflow, support, and requested email delivery. Their own privacy notices apply where they act independently, including Lemon Squeezy's privacy notice for the payment transaction.

## Legal bases

Depending on the activity, we process information because it is necessary to provide the service you requested, to comply with legal obligations, with your consent, or for legitimate interests such as security, fraud prevention, service reliability, and support. Optional aggregate learning and checkout-funnel analytics runs only with your consent. Where processing relies on consent, you may withdraw that consent without affecting earlier lawful processing.

## Retention and deletion

Your waitlist record is retained until you unsubscribe, request deletion, or the waitlist is retired. Future availability messages include an unsubscribe mechanism where required.

Daily Learning consent and withdrawal evidence is retained as needed to demonstrate the requested subscription state, honor suppression, and prevent messages after withdrawal. Daily Learning messages include a purpose-specific unsubscribe mechanism. Withdrawing Daily Learning consent does not cancel required account, security, purchase, refund, privacy, or support communications.

Account and entitlement records are retained while your account or purchased access remains active. If you request account deletion, access is disabled and the account enters the documented safety period before eligible account data is deleted or anonymized. Transaction, refund, invoice, fraud-prevention, and accounting records may be retained for the periods required by the payment provider, payment networks, tax, accounting, dispute, and other applicable legal obligations.

Daily aggregate learning and checkout-funnel counters are retained for up to 24 months. Duplicate event identifiers are retained for up to 24 hours and are used only to prevent repeated counting. Raw telemetry event bodies are not stored in the durable analytics database. Operational runtime-log retention follows the hosting plan and project settings.

## Sharing and sale

USD Impact does not sell personal information, waitlist or Daily Learning email addresses, account information, or learning telemetry. Information may be shared only with service providers required to operate the website, process purchases and refunds, provide account access, store data, deliver requested email, answer support requests, prevent fraud, and meet legal obligations.

## Security

API credentials are stored as protected deployment environment variables and are not exposed in the public website source. Learning event payloads use a strict allowlist and deliberately exclude cookies, user-agent strings, referrers, email addresses, persistent session identifiers, and quiz answer selections. Reporting access is restricted through a protected server endpoint. No online system can guarantee absolute security, but access is limited to the services required to operate the website.

## Your choice

Submitting the waitlist form or Daily Learning email form is optional. Consent checkboxes are not preselected. You may continue using the public educational website without subscribing to either email purpose or accepting aggregate analytics. Each consent purpose can be withdrawn independently. Rejecting analytics does not block public content, downloads, quiz scoring, retries, account security, or navigation.

Subject to applicable law, you may ask to access, correct, delete, restrict, or export your personal information, or object to certain processing. You may also complain to the relevant data-protection authority. Some transaction or accounting records cannot be deleted immediately where retention is legally required.

For privacy, account, or data-rights requests, contact [support@usd-impact.com](mailto:support@usd-impact.com). We may need to verify that a request relates to your account before acting on it.

## Operator

USD Impact is operated by **KELA LEADS S.R.L.**, a Romanian limited liability company registered under CUI **40790448**, Trade Register number **J38/820/2020**, and EUID **ROONRC.J38/820/2020**. Registered business address: **Str. Doctor Hacman nr. 28, bl. 83, sc. B, ap. 9, 240232 Râmnicu Vâlcea, România**.

This notice describes current website operations and is not legal advice.
