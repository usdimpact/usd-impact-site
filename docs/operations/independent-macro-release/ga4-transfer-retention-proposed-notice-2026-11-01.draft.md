# USD Impact — GA4 transfer and retention notice: non-public owner review (2026-11-01)

**Status: DRAFT ONLY — not an amendment to the public Privacy Notice, not a legal opinion, not approved for release.**

**Purpose.** Prepare accurate, narrowly scoped language for the live Privacy Notice after independent read-only verification of the USD Impact — Web Google Analytics property and the site's anonymous consent behavior. This document must not be merged or deployed while Macro Weekly PR #1025 remains on HOLD.

## Verified facts to preserve

- The operator's GA4 admin view on November 1, 2026 showed **event data retention: 2 months**; **user data retention: 14 months**, with **reset on new user activity enabled**. The 14-month setting is **not a maximum lifetime for continuously active user data**.
- Google's data-processing terms were shown as **accepted September 17, 2026** in the account settings. This does not independently certify the applicable processor identity, transfer route or all downstream subprocessors.
- Google Signals was **inactive**, while device/location collection was **enabled**. The GA4 UI showed behavioral and advertising consent-signal indicators as **inactive**; that indicator should not be treated alone as evidence of unconsented collection.
- Independent anonymous Chromium test [GitHub run #41322389260](https://github.com/usdimpact/usd-impact-site/actions/runs/41322389260) observed **0 GA requests/cookies before consent and after Reject; 2 tag + 4 collect requests and 2 _ga-family cookie names after Accept; 0 GA requests and 0 _ga-family cookies on a newly opened denied page after Withdraw**. One earlier coarsely timed run observed an ambiguous single request and failed safely; its record remains part of the audit. This is one-runner, one-geography evidence, not universal certification.
- The public website's browser consent-choice cookie is configured for **180 days**, GA4 browser analytics cookies for **up to one year**. These are not GA4 server-side event/user retention settings.

## Draft text for legal/owner review only

> **Optional Google Analytics and retention.** With your consent, we use Google Analytics 4 to help understand how educational pages and website features are used. Our Google Analytics property currently retains event data for 2 months and user data for 14 months, with its user-data retention period reset when a user becomes active again. Those Google Analytics settings are distinct from the shorter or longer duration of browser cookies. You may decline or withdraw optional analytics at any time using **Privacy settings** in the website footer; withdrawing prevents new optional analytics events from that browser but does not erase processing already lawfully completed.
>
> **International processing.** Google may process consented analytics information outside the European Economic Area. Where an international transfer requires safeguards, the appropriate mechanism depends on the recipient, the data flow and the terms governing that processing. Google's published measures describe the EU–U.S. Data Privacy Framework for qualifying transfers to eligible certified recipients and Standard Contractual Clauses in certain other circumstances. Information about Google's data-transfer measures and its processing terms is available at https://business.safety.google/adsdatatransfers/ and https://business.safety.google/adsprocessorterms/. For information about safeguards relevant to your personal data, contact support@usd-impact.com.

## Review gates before any live copy change

1. **Actual transfer applicability:** identify the contract entity for this GA4 property, applicable Google legal terms, recipient geographies and onward recipients before claiming a particular safeguard as legally operative for every USD Impact data flow.
2. **Retention necessity:** decide whether **14 months + reset** for user-level data is proportionate to the specific educational analytics purposes; do not change the Google property without an explicit owner decision and record of expected data impact. An event data value of 2 months is not by itself proof of compliance.
3. **Other providers:** do not mistake this *Google-only* draft for a complete Vercel/Cloudflare/Supabase/Upstash/Resend/Lemon Squeezy transfer inventory.
4. **Language and privacy transparency:** verify an accurate short notice, contact route, legal basis for optional analytics, provider identity and rights under GDPR Articles 13 and 44, and the applicable cookie-consent requirements. Avoid claiming a universal foreign-use license or legal certification.
5. **Release:** only then prepare a separate, exact-diff Privacy Notice PR and require a site-specific owner approval. Do not edit apps/web/src/pages/privacy.md, live GA4 settings, GA4 credentials or Production now.

## Authoritative references

- Live current public notice: https://www.usd-impact.com/privacy/
- GDPR Articles 13 and 44: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- ePrivacy Directive Article 5(3): https://eur-lex.europa.eu/eli/dir/2002/58/oj/eng
- Google Analytics retention: https://support.google.com/analytics/answer/7667196
- Google processing terms: https://business.safety.google/adsprocessorterms/
- Google transfers: https://business.safety.google/adsdatatransfers/
- Google LLC DPF listing: https://www.dataprivacyframework.gov/participant/5780
- Project decision trail: https://github.com/usdimpact/usd-impact-site/issues/1031#issuecomment-6560142868

This draft is evidence and wording for human review, **not authorization to publish or certification of any legal conclusion**.
