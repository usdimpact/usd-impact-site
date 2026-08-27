# USD Impact public commerce disclosure release gate

Last updated: 2026-08-27

## Purpose

This gate prevents controlled Live or public Live checkout from becoming available until the buyer-facing seller and Merchant-of-Record disclosures are complete, verified, and explicitly approved.

Lemon Squeezy is the selected Merchant of Record for the one-time *Read the Dollar First Library Pass*. Provider selection, Test Mode proof, responsibility mapping, and code-only adapter registration are complete. Activation is not complete.

Current Production remains fail-closed with `COMMERCE_MODE=disabled`, `COMMERCE_PROVIDER` unset, no provider secrets, no Live webhook, and no public checkout.

## Fixed public USD Impact identity

The application may display these already-approved public facts:

- Brand: USD Impact
- Legal operator: SC Kela Leads SRL
- Jurisdiction: Romania
- Registration: CUI 40790448 · Trade Register J38/820/2020
- Support: support@usd-impact.com

The registered street address is intentionally not committed to this repository. It must be verified from company records and then configured as customer-facing Production data only when it is approved for publication before checkout.

## Resolved provider facts

The following provider facts may be used in Draft buyer copy:

- Selected provider brand: **Lemon Squeezy**
- Current legal operator shown on the official buyer terms and privacy notice: **Link, LLC f/k/a Lemon Squeezy LLC** (verified 2026-08-27)
- Transaction role: **Merchant of Record and authorized reseller**
- Buyer terms: https://www.lemonsqueezy.com/buyer-terms
- Provider privacy notice: https://www.lemonsqueezy.com/privacy
- Lemon Squeezy owns hosted payment processing, applicable indirect-tax calculation/collection/remittance, buyer financial documents, payment refunds, disputes, chargebacks, and payment fraud controls.
- USD Impact owns product description and delivery, account access, entitlement controls, product/access support, and review of refund requests under the public USD Impact refund policy.

The authenticated USD Impact Test Mode checkout renders the **Lemon Squeezy** brand and links buyers directly to the current official buyer terms and privacy notice. Those linked legal pages identify **Link, LLC f/k/a Lemon Squeezy LLC** as the current operator. This resolves the Draft legal-entity evidence without configuring it in any environment. Reverify the entity and linked legal pages immediately before Live disclosure approval because provider legal naming can change.

## Required buyer-facing configuration

Controlled Live and Live modes require all of the following fields. The `_PUBLIC` suffix identifies values intended to be shown to buyers; it does not mean an unverified value may be invented or copied from an unrelated source.

| Configuration | Purpose | Current state |
| --- | --- | --- |
| `COMMERCE_TRADER_ADDRESS_PUBLIC` | Verified geographic trader/business address shown to the buyer | Not configured |
| `COMMERCE_TAX_STATUS_PUBLIC` | Accurate seller tax/VAT-status wording appropriate for customer disclosure | Not configured |
| `COMMERCE_MERCHANT_OF_RECORD_NAME` | Current contractual Merchant-of-Record / seller-of-record identity | Current entity resolved in Draft evidence; exact entity not configured |
| `COMMERCE_MERCHANT_OF_RECORD_TERMS_URL` | HTTPS buyer terms supplied by the selected provider | Official URL resolved; not configured |
| `COMMERCE_MERCHANT_OF_RECORD_PRIVACY_URL` | HTTPS provider privacy notice relevant to the buyer transaction | Official URL resolved; not configured |
| `COMMERCE_TAX_CHECKOUT_PUBLIC` | Final wording explaining how applicable tax and supported currency conversion are shown before payment | Not configured |
| `COMMERCE_REFUND_SUPPORT_PUBLIC` | Final allocation of product/access support versus payment/refund support | Responsibility resolved; not configured |
| `COMMERCE_SELLER_DISCLOSURE_APPROVED` | Explicit `true` only after the complete buyer-facing set has been reviewed and approved | Not granted |

## Administrative evidence track

W-8 certification remains pending accountant confirmation. The current account enforcement notice makes it an administrative pre-marketing task rather than a present implementation or Preview blocker.

The ONRC certificate request is in progress as corroborating evidence for future registry-verification wording. The certificate itself is not required to prepare code or Preview copy and does not need to be published. Its absence does not remove the separate requirement to publish accurate buyer-facing trader information before public selling, including the verified geographic address and VAT identifier where applicable.

Neither administrative track authorizes a guessed tax classification, address, provider legal entity, or approval flag.

## Validation rules

The central commerce readiness contract enforces the gate before any provider adapter can activate controlled Live or Live checkout.

- Disabled mode remains usable without these fields and public checkout remains disabled.
- Sandbox mode remains usable without these fields so provider integration can be tested safely outside Production.
- Controlled Live mode is blocked until the complete disclosure bundle is present and approved.
- Live mode is blocked until the complete disclosure bundle is present and approved, in addition to all existing sandbox, controlled-Live, provider-adapter, Production-environment, and explicit Live-approval gates.
- Merchant-of-Record terms and privacy URLs must use HTTPS and cannot contain embedded credentials.
- Partial disclosure configuration is never returned through the public commerce-readiness API.
- The checkout page renders seller/Merchant-of-Record details only when the complete approved bundle is available.

## What must not be committed

Do not put the following values in Git merely to satisfy this gate:

- beneficial-owner or representative residential address;
- government ID details;
- date of birth;
- personal phone number;
- bank or payout details;
- provider API keys, webhook secrets, passwords, recovery codes, or tokens;
- unverified VAT claims or fabricated tax wording;
- a historic or unreviewed provider legal entity presented as the current contractual Merchant of Record.

The buyer-facing geographic trader address is not treated as a secret after it is intentionally approved for public commercial disclosure, but the canonical value should still be managed through the approved Production configuration/recovery process rather than duplicated through source files.

## Activation sequence

1. Keep Production `COMMERCE_MODE=disabled` and `COMMERCE_PROVIDER` unset.
2. Keep the Lemon Squeezy adapter registration code-only and public checkout fail-closed.
3. Complete Draft legal-copy and disclosure regression checks.
4. Verify the public trader address and tax/VAT wording from authoritative company/accounting records.
5. Reverify the current contractual Merchant-of-Record identity and linked legal pages immediately before Live approval.
6. Configure the complete buyer-facing bundle in an authorized non-public verification environment without committing sensitive provider credentials.
7. Review the rendered checkout disclosure block and official provider links.
8. Set `COMMERCE_SELLER_DISCLOSURE_APPROVED=true` only after the complete set is correct and the owner separately approves it.
9. Complete the separately controlled Live-test gate if authorized.
10. Activate Production or public checkout only after all remaining launch-critical checks and separate explicit owner approval are green.

## Current status

- Provider selection: **complete — Lemon Squeezy**.
- Provider responsibility mapping: **complete**.
- Test Mode proof: **complete**.
- Adapter registration: **code only; Production inactive**.
- Official buyer-terms and privacy URLs: **resolved in Draft copy**.
- Public checkout: **disabled**.
- Verified registered street address for customer display: **not stored in Git and not configured**.
- Public tax/VAT wording: **not configured**.
- Exact contractual Merchant-of-Record entity: **resolved in Draft evidence as Link, LLC f/k/a Lemon Squeezy LLC; not configured and subject to immediate pre-Live re-verification**.
- Buyer disclosure approval: **not granted**.
- W-8 and ONRC evidence: **administrative pre-marketing work; not current implementation or Preview blockers**.

This change corrects buyer-facing provider wording without enabling commerce. It does not alter Production configuration, secrets, webhooks, payments, refunds, database state, public checkout, or merge status.
