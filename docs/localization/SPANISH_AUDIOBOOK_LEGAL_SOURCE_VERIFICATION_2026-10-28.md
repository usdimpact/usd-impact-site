# Spanish audiobook — current legal-source verification and conservative wording packet — 2026-10-28

Status: **PRIMARY SOURCES RE-VERIFIED / CONSERVATIVE PRODUCT WORDING READY / COUNSEL-PUBLISHER DECISION STILL REQUIRED / RELEASE HOLD**

This packet updates the legal/publisher handoff with current primary-source verification. It does **not** make a legal conclusion, classify the narration as a statutory deep fake, determine national accessibility-law applicability, establish historical voice-provider licensing, or authorize distribution.

Related:
- `SPANISH_AUDIOBOOK_LEGAL_PUBLISHER_HANDOFF_2026-10-28.md`;
- `SPANISH_AUDIOBOOK_RELEASE_BLUEPRINT_2026-10-28.md`;
- `SPANISH_AUDIOBOOK_TRACK00_SOURCE_PROVENANCE_2026-10-28.md`.

## 1. Verified current legal / terms sources

### EU Artificial Intelligence Act — Article 50

Current consolidated source:
https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02024R1689-20260727

Commission Article 50 reference based on the consolidated text:
https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50

Verified points:
- Article 50(2) places synthetic-content marking duties on providers of AI systems generating synthetic audio/image/video/text.
- Article 50(4) requires deployers to disclose artificially generated/manipulated image/audio/video where the content constitutes a deep fake, subject to the provision's exceptions/qualifications.
- Article 50(5) requires applicable disclosures to be clear and distinguishable no later than first interaction/exposure and to conform to applicable accessibility requirements.

Decision still required:
- whether this specific narration is within Article 50(4)'s deep-fake scope;
- what operator/deployer disclosure is legally mandatory;
- what evidence should be retained concerning provider-side Article 50(2) marking.

Engineering/editorial must not convert the current factual evidence into a legal classification.

## 2. HeyGen terms — current-state verification

Current terms:
https://www.heygen.com/terms

Current page states:
- last updated July 23, 2026;
- for Creator, Pro and Business users, as between HeyGen and the user, the user owns User Input/User Output and HeyGen states it does not restrict use of User Output for the user's own purposes, including commercial purposes, subject to the terms and the user's responsibility for third-party rights;
- User Output must not be distributed in a misleading way as entirely human-generated;
- applicable AI-origin disclosure remains the user's responsibility where law requires it;
- current Free-plan terms restrict output to personal/non-commercial/internal evaluation use.

Historical production evidence already retained separately states that the account was on Creator during the relevant October production window. The currently connected account being Free now does **not** rewrite that historical state.

Remaining evidentiary limitation:
- current terms do not prove the exact terms text in force on every generation timestamp;
- current terms do not prove the historical catalog/source classification or third-party voice rights for Narrator Mateo;
- current absence of the historical voice ID from today's catalog does not establish loss of historical rights and does not prove them either.

Counsel/publisher must decide whether the historical Creator evidence plus current/output evidence is sufficient or whether additional generation-date terms, invoice/plan evidence, catalog provenance, or voice-provider rights evidence must be retained.

## 3. European Accessibility Act — current source verification

Primary source:
https://eur-lex.europa.eu/eli/dir/2019/882/oj

Verified points:
- the Directive covers consumer services including e-books/dedicated software and e-commerce services after 28 June 2025;
- Article 4(5) provides an exemption for microenterprises providing services from the service accessibility requirements referenced by that paragraph and related compliance obligations;
- Annex I includes accessibility requirements for e-commerce identification/security/payment functions;
- Annex I's e-book section includes synchronized text/audio when an e-book contains audio in addition to text and other navigation/assistive-technology requirements.

Remaining decisions:
- whether KELA factually and legally qualifies for the relevant national microenterprise exemption;
- whether the standalone protected Spanish audiobook is itself treated as an e-book service for the specific e-book requirements;
- which national transposition(s) apply to the member/e-commerce journey;
- whether the accessibility statement/product information needs a Spanish-audiobook-specific update.

Do not claim the Directive-level exemption as self-executing proof.

## 4. Consumer digital-content information and conformity

Consumer Rights Directive:
https://eur-lex.europa.eu/eli/dir/2011/83/oj/eng

Digital Content Directive:
https://eur-lex.europa.eu/eli/dir/2019/770/oj/eng

Verified points:
- distance-contract information must be clear and comprehensible and include main characteristics;
- digital-content information includes, where applicable, functionality/technical protections and relevant interoperability;
- the Digital Content Directive treats contractual description, language/version, functionality, compatibility and interoperability as conformity-relevant;
- objective conformity includes qualities/performance such as functionality, compatibility, accessibility, continuity and security that consumers may reasonably expect, including expectations shaped by public statements.

This makes accurate release-facing product description important even before final legal wording is selected.

## 5. Conservative product wording — editorial recommendation only

The following wording is designed to be factually accurate and conservative. It is **not** presented as a legal safe harbor.

### Visible narration disclosure

Preferred Spanish:
**“Narración generada por IA, con revisión humana de calidad.”**

English equivalent:
**“AI-generated narration with human quality review.”**

Rationale:
- does not imply the speech is human-recorded;
- matches the existing English product's conservative disclosure principle;
- remains understandable at first exposure.

Counsel/publisher must decide whether this is legally sufficient, needs a different placement, or requires additional wording.

### Product/access facts

Recommended release-facing facts, subject to final publisher/legal approval:

- Spanish-language audiobook of *Read the Dollar First*;
- included for active Library Pass members under the same permanent Library Pass entitlement model;
- streamed through the USD Impact member player;
- sign-in and valid Library Pass entitlement required;
- audio delivered privately using short-lived signed access URLs;
- ordinary current browser audio support required;
- listening position stored locally in the browser;
- Spanish audiobook does not replace or alter the English audiobook;
- printed page-number navigation aids are not narrated literally; structured track navigation and written editions remain available;
- narration is AI-generated and human quality-reviewed.

Do not promise:
- offline download;
- permanent public file URLs;
- synchronized text/audio unless deliberately implemented;
- a particular device/browser beyond the tested compatibility statement;
- TradingView or Research Membership features as part of the Library Pass audiobook.

## 6. Edition / provenance wording

Current source authority:
**Spanish Edition 1.3 Candidate 1**

Do not silently describe it as a different final edition unless publisher/editorial approval explicitly changes that designation.

If released without a manuscript metadata revision, preserve truthful version/date/data-cutoff provenance in release-facing help/about copy.

If publisher decides that candidate-era or historical metadata should be revised:
- make the text change first in the authoritative manuscript;
- scope any required spoken replacement;
- reopen listening/QA only for the affected audio passage;
- do not blanket-regenerate the accepted 20-track programme.

## 7. Track 00 status after provenance resolution

Current-main provenance now identifies:
- private project: `2f542797-4a70-4d44-a164-76dee15859ca`;
- selected composition: `91240c6b-78df-4910-a994-43c616f9b53f`;
- selected source media: `00 - Lee primero el dólar.wav`;
- Descript media reference: `12e94d44-66e7-4baf-9731-9a8470697b63`;
- duration: **113.345306 s**;
- shorter 105.308073 s fallback is explicitly not the selected release source.

Source identity is resolved.

Raw-byte materialization + SHA-256 remain pending before final Track 00 MP3 materialization.

## 8. Decision matrix — still required

Counsel/publisher should return:

| Decision | PASS / EDIT / PROCESS / HOLD | Exact requirement if not PASS |
|---|---|---|
| A. AI narration disclosure / Article 50 | | |
| B. HeyGen / Narrator Mateo commercial-rights evidence | | |
| C. Accessibility / EAA / microenterprise scope | | |
| D. Consumer digital-content / pre-contract wording | | |
| E1. Spoken rights label | | |
| E2. Rights-scope grammar | | |
| E3. Edition/candidate metadata | | |
| E4. Printed navigation adaptation | | |
| Final Spanish audiobook publisher release | | |

Also specify:
- mandatory exact wording changes;
- whether any new audio must be generated;
- whether existing owner/editorial acoustic QA may be relied upon after legal wording decisions;
- whether the proposed visible AI disclosure is sufficient;
- required pre-release records/filings/notices.

## 9. Current disposition

What engineering/editorial can now treat as settled:
- Track 00 source identity;
- 20-track private QA programme;
- 192 kbps no-processing MP3 delivery profile QA;
- private member-delivery architecture shape;
- conservative draft disclosure/product-description wording.

Still HOLD:
- Track 00 exact binary materialization/hash;
- legal/publisher decision matrix;
- final distribution authorization;
- Production storage upload;
- Spanish protected member route;
- `audiobookMemberDelivery=true`;
- Production release.

No public/member Spanish audiobook delivery is authorized by this packet.
