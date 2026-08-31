# USD Impact ONRC company-verification gate

Last updated: 2026-08-28
Tracking issue: #341

## Purpose

This gate defines when USD Impact may describe the legal-operator identifiers as checked against a current official Romanian National Trade Register Office (ONRC) document.

After completion, public wording may say only that specified company-record fields were checked against the retained ONRC certificate. It must not describe the operator, founder, product, research or performance as independently verified, audited, certified, endorsed by ONRC, or equivalent.

This is an evidence and public-claim gate, not a current implementation or Preview blocker. An ONRC certificate does not need to be published merely to sell online. Its absence does not remove the separate requirement to publish accurate buyer-facing trader information before public selling, including the legal name, verified geographic address, direct contact, trade-register identity/registration number, and VAT identifier where applicable.

## Current verified record

USD Impact currently discloses:

- Legal operator: KELA LEADS S.R.L.
- Jurisdiction: Romania
- Legal form: Societate cu Răspundere Limitată (S.R.L.)
- CUI: 40790448
- Trade Register number: J38/820/2020
- European Unique Identifier (EUID): ROONRC.J38/820/2020
- Company status stated by the certificate: funcțiune
- Public support contact: support@usd-impact.com

The legal name was corrected from the informal `SC Kela Leads SRL` form to the exact registered `KELA LEADS S.R.L.` form. The other listed company-record fields are consistent with the retained certificate. The certificate confirms the registered-office components used by USD Impact; it does not state the separately published postal code.

## Authoritative acquisition source

Use only the official ONRC portal:

- Portal: https://myportal.onrc.ro/
- Service: Furnizare informatii RC / InfoCert-Recom
- Document type: Eliberare Certificat Constatator Online → Certificat constatator pe firmă
- Search key: CUI 40790448

ONRC's current InfoCert-Recom guide requires an authenticated portal account and payment profile. The guide instructs the requester to search the company by CUI, select the company, choose the document purpose, complete billing/payment, and download the electronically issued document from the request's `Opis` / `Actiuni` area after successful payment.

## Required comparison

Review the actual electronically issued ONRC document and record PASS/FAIL for each item:

1. Legal name matches `KELA LEADS S.R.L.`.
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

### Completed privacy-safe record

- Verification date (UTC): 2026-08-28
- Document type: ONRC `Certificat constatator`
- Document issue date: 2026-08-27
- Report number: 3178140/27.08.2026
- Original retained in company-controlled storage: YES
- Retained original size: 791243 bytes; 5 pages
- SHA-256 of unaltered retained original: `ff8af906f214e983dff43bdc91d8dcaa8fd86c822fe65383e5bbafbf1ba21654`
- PDF signature integrity: PASS — ETSI.CAdES.detached signature is cryptographically valid
- Signer identity presented by the PDF: `OFICIUL NATIONAL AL REGISTRULUI COMERTULUI`
- Local certificate-chain validation: REQUIRES REVIEW — the local NSS trust database could not establish the certificate chain; this does not change the valid signed-byte result
- Exact legal-name comparison: PASS after correcting public copy to `KELA LEADS S.R.L.`
- CUI comparison: PASS
- Current registration-number comparison: PASS
- EUID comparison: PASS
- Company-status comparison: PASS (`funcțiune`)
- Registered-office private comparison: PASS; the certificate omits the separately published postal code
- Public legal-page and checkout-disclosure consistency review: PASS after the exact-name correction in this change
- Reviewer: USD Impact owner-authorized evidence review
- Discrepancies requiring remediation: exact legal-name styling corrected; no CUI, registration-number, status or registered-office conflict
- Public-status decision: VERIFIED FOR THE SPECIFIED COMPANY-RECORD FIELDS ONLY

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

### State A — historical pre-review fallback (superseded)

Allowed:

> KELA LEADS S.R.L., CUI 40790448 and Trade Register J38/820/2020 are first-party legal-operator disclosures. A current official ONRC company certificate has not yet been reviewed by USD Impact for this public verification record.

Not allowed:

- “ONRC verified”
- “independently verified”
- “officially certified”
- “registry audited”
- any equivalent wording that implies the current signed certificate has already been reviewed

### State B — current after successful verification

The specified legal-operator identifiers were checked against the retained ONRC certificate issued on 2026-08-27. Public wording must state the document date and narrow scope. It must not imply ONRC endorses USD Impact, its product, Score, research, revenue, performance, founder claims or any investment outcome.

## Completion procedure

1. Obtain the current signed company certificate through the authenticated ONRC InfoCert-Recom flow.
2. Store the original in approved company-controlled storage.
3. Compute SHA-256 of the exact retained file.
4. Complete the comparison checklist in Issue #341 without posting sensitive values.
5. Correct any discrepancy before changing public verification wording.
6. Update the About/Transparency evidence level through a reviewed PR.
7. Run normal CI and Preview verification if public copy changes. Production verification remains separately authorized release work.
8. Close Issue #341 only after the public wording and evidence record match the reviewed certificate.

## Current status

**COMPLETE — reviewed on 2026-08-28 against the retained electronically signed ONRC certificate; not an independent assurance engagement or ONRC endorsement.**

The exact registered name, CUI, current Trade Register number, EUID, company status and registered-office components are now supported by the recorded certificate comparison. The certificate remains private. A discrepancy found in a later certificate blocks any public claim or buyer disclosure that depends on the affected field and must be corrected before public selling.

This completed review supports only the specified company-record fields. It does not verify the W-8 classification, Romanian VAT-registration status, tax-treaty position, founder identity, product eligibility, revenue, customer count, research quality, investment performance or predictive power.
