# USD Impact public commerce disclosure release gate

Last updated: 2026-08-25

## Purpose

This gate prevents controlled Live or public Live checkout from becoming available until the buyer-facing seller and Merchant-of-Record disclosures are complete, verified, and explicitly approved.

It is deliberately provider-neutral. It does not select FastSpring, Lemon Squeezy, PayPro Global, or any other provider. It does not create a payment entry point, register an adapter, configure provider credentials, or approve Production commerce.

Current Production remains fail-closed with commerce disabled.

## Fixed public USD Impact identity

The application may display these already-approved public facts:

- Brand: USD Impact
- Legal operator: SC Kela Leads SRL
- Jurisdiction: Romania
- Registration: CUI 40790448 · Trade Register J38/820/2020
- Support: support@usd-impact.com

The registered street address is intentionally not committed to this repository. It must be verified from company records and then configured as customer-facing Production data only when it is approved for publication before checkout.

## Required buyer-facing configuration

Controlled Live and Live modes require all of the following fields. The `_PUBLIC` suffix identifies values intended to be shown to buyers; it does not mean an unverified value may be invented or copied from an unrelated source.

| Configuration | Purpose |
| --- | --- |
| `COMMERCE_TRADER_ADDRESS_PUBLIC` | Verified geographic trader/business address shown to the buyer |
| `COMMERCE_TAX_STATUS_PUBLIC` | Accurate seller tax/VAT-status wording appropriate for customer disclosure |
| `COMMERCE_MERCHANT_OF_RECORD_NAME` | Selected contractual Merchant of Record / seller-of-record identity |
| `COMMERCE_MERCHANT_OF_RECORD_TERMS_URL` | HTTPS buyer terms supplied by the selected provider |
| `COMMERCE_MERCHANT_OF_RECORD_PRIVACY_URL` | HTTPS provider privacy/data-processing notice relevant to the buyer transaction |
| `COMMERCE_TAX_CHECKOUT_PUBLIC` | Final wording explaining how applicable tax and supported currency conversion are shown before payment |
| `COMMERCE_REFUND_SUPPORT_PUBLIC` | Final allocation of product/access support versus payment/refund support |
| `COMMERCE_SELLER_DISCLOSURE_APPROVED` | Explicit `true` only after the complete buyer-facing set has been reviewed and approved |

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
- a candidate provider name presented as selected before written selection approval.

The buyer-facing geographic trader address is not treated as a secret after it is intentionally approved for public commercial disclosure, but the canonical value should still be managed through the approved Production configuration/recovery process rather than duplicated through source files.

## Provider-selection dependency

Do not populate provider-specific fields merely because a candidate is under review.

Before setting the Merchant-of-Record fields, Issue #53 must contain authoritative evidence and explicit selection covering at minimum:

1. product/company eligibility;
2. Romanian-company onboarding and settlement;
3. Merchant-of-Record / seller-of-record allocation;
4. tax calculation, filing/remittance, invoicing and receipt responsibilities;
5. fees, reserves and payout schedule;
6. refunds, disputes, chargebacks and buyer-support allocation;
7. webhook/event coverage and raw-body signature verification;
8. sandbox/test behavior;
9. privacy/DPA/subprocessor obligations; and
10. incident, rollback and secret-rotation procedures.

## Activation sequence

1. Keep `COMMERCE_MODE=disabled` while provider selection is unresolved.
2. Select exactly one provider through the existing provider responsibility gate.
3. Implement and validate the provider adapter in sandbox outside Production.
4. Verify the public trader address and tax/VAT wording from authoritative company/accounting records.
5. Verify the provider's exact legal Merchant-of-Record identity, buyer terms, privacy terms and support allocation from authoritative provider materials/contract.
6. Configure the seven buyer-facing values in the correct environment without committing sensitive provider credentials.
7. Review the rendered checkout disclosure block and links.
8. Set `COMMERCE_SELLER_DISCLOSURE_APPROVED=true` only after the complete set is correct.
9. Complete the separately controlled Live-test gate.
10. Activate Live mode only after all remaining launch-critical issues and explicit Live approval are green.

## Current status

- Provider selection: **not complete**.
- Public checkout: **disabled**.
- Verified registered street address for customer display: **not stored in Git and not assumed by this gate**.
- Merchant of Record: **not selected**.
- Buyer disclosure approval: **not granted**.

Therefore this change strengthens the release boundary but does not move USD Impact closer to accepting a payment until the required real-world evidence is supplied and approved.
