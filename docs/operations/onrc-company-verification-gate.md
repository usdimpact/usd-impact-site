# USD Impact ONRC company-verification gate

Last updated: 2026-08-25
Tracking issue: #341

## Purpose

This gate defines when USD Impact may describe the legal-operator identifiers as checked against a current official Romanian National Trade Register Office (ONRC) document.

Until the gate is completed, the public legal-entity information remains a **first-party disclosure**. It must not be described as independently verified, registry-verified, officially verified, audited, certified, or equivalent.

## Current first-party record

USD Impact currently discloses:

- Legal operator: SC Kela Leads SRL
- Jurisdiction: Romania
- CUI: 40790448
- Trade Register number currently used by USD Impact: J38/820/2020
- Public support contact: support@usd-impact.com

These values are consistent across the current USD Impact public legal/transparency surfaces, but that consistency does not substitute for reviewing a current ONRC certificate.

## Authoritative acquisition source

Use only the official ONRC portal:

- Portal: https://myportal.onrc.ro/
- Service: Furnizare informatii RC / InfoCert-Recom
- Document type: Eliberare Certificat Constatator Online → Certificat constatator pe firmă
- Search key: CUI 40790448

ONRC's current InfoCert-Recom guide requires an authenticated portal account and payment profile. The guide instructs the requester to search the company by CUI, select the company, choose the document purpose, complete billing/payment, and download the electronically issued document from the request's `Opis` / `Actiuni` area after successful payment.

## Required comparison

Review the actual electronically issued ONRC document and record PASS/FAIL for each item:

1. Legal name matches `SC Kela Leads SRL`.
2. CUI matches `40790448`.
3. Current Trade Register / registration number is captured exactly as ONRC presents it.
4. Company status is captured if the document states it.
5. Registered office is reviewed privately and compared with the address intended for future customer-facing commerce disclosure.
6. Relevant incorporation/registration dates are captured if useful for due diligence.
7. Terms, Privacy Notice, Refund Policy, About/Transparency, checkout disclosure configuration, and provider/KYB packets contain no conflicting operator identity.

A discrepancy is a release blocker for any public claim that depends on the affected field. Do not silently normalize or reinterpret an ONRC value.

## Evidence record

Keep the original electronically signed ONRC PDF in approved company-controlled storage. Do not commit it by default.

The privacy-safe GitHub evidence should contain only:

- verification date;
- ONRC document type;
- document issue date;
- SHA-256 hash of the retained original;
- legal-name comparison: PASS/FAIL;
- CUI comparison: PASS/FAIL;
- Trade Register / registration-number comparison: PASS/FAIL;
- active/company-status observation if explicitly present in the certificate;
- registered-office comparison: PASS/FAIL without printing the address;
- reviewer/operator;
- discrepancy remediation reference, if any.

The SHA-256 hash proves which retained document was reviewed without republishing the document itself.

## Data that must not be copied to GitHub

Do not commit or paste:

- residential or unnecessary registered-office details;
- CNP or identity-document data;
- dates/places of birth unless a specific lawful diligence need requires a separate protected record;
- handwritten/electronic signatures from the certificate;
- bank or payout information;
- payment-card data;
- portal credentials, MFA material, recovery codes, cookies, tokens, or receipts containing unnecessary personal data;
- beneficial-owner information unless a separate lawful and access-controlled diligence process requires it.

## Public wording states

### State A — current / pending

Allowed:

> SC Kela Leads SRL, CUI 40790448 and Trade Register J38/820/2020 are first-party legal-operator disclosures. A current official ONRC company certificate has not yet been reviewed by USD Impact for this public verification record.

Not allowed:

- “ONRC verified”
- “independently verified”
- “officially certified”
- “registry audited”
- any equivalent wording that implies the current signed certificate has already been reviewed

### State B — after successful verification

After Issue #341 is completed against the retained signed document, public wording may say that the specified legal-operator identifiers were checked against an ONRC certificate issued on the recorded date. Do not imply ONRC endorses USD Impact, its product, Score, research, revenue, performance, or founder claims.

## Completion procedure

1. Obtain the current signed company certificate through the authenticated ONRC InfoCert-Recom flow.
2. Store the original in approved company-controlled storage.
3. Compute SHA-256 of the exact retained file.
4. Complete the comparison checklist in Issue #341 without posting sensitive values.
5. Correct any discrepancy before changing public verification wording.
6. Update the About/Transparency evidence level through a reviewed PR.
7. Run normal CI and Production verification.
8. Close Issue #341 only after the public wording and evidence record match the reviewed certificate.

## Current status

**PENDING — authenticated ONRC certificate acquisition and review required.**

The existence of an official portal, company-search flow, or first-party company identifiers is not itself evidence that the current public record has been checked against a signed ONRC certificate.
