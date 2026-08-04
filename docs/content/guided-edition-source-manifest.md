# Guided Interactive Edition source manifest

## Canonical source

- Document: `USD_Impact_Read_the_Dollar_First_v5_94_Session15A_Certified_NoISBN_DigitalReader_WithBookmarks.pdf`
- PDF title: `USD Impact - Read the Dollar First - Session 15A Certified Digital Reader`
- Edition: `1.2 (April 2026)`
- Production build: `v5.94 Session 15A Certified Digital Reader`
- SHA-256: `ca3f7d14f5fe4e863e1e83562034cf1d8bacfe6cf6a71fe612a2446f82d9b5da`
- Total pages: 83

## Chapter 1 extraction boundary

- Title: `Why the Dollar Comes First`
- Printed pages: 8-11
- Physical PDF pages: 9-12
- Next boundary: Chapter 2 begins on printed page 12 / physical PDF page 13
- Canonical reader text SHA-256: `919554b9255ba0e5a2da48e1c9fd326e8d1757378a7561e87b3151b1d93ee7a8`

The reader hash covers the ordered title, description, purpose, section headings, paragraphs, recap items, references, and compliance note. The physical PDF page index includes an unnumbered cover, so it is one page ahead of the printed page number. The boundary was checked against the rendered contents page, visually reviewed page by page, and compared after whitespace normalization with the extracted source text.

## Chapter 2 extraction boundary

- Title: `From Bretton Woods to Fiat Discipline`
- Printed pages: 12-15
- Physical PDF pages: 13-16
- Next boundary: Chapter 3 begins on printed page 16 / physical PDF page 17
- Canonical reader text SHA-256: `f86d58471126bac277f51024e74b4327e87133f760284f2d40384f832ce8257d`

The same extraction, rendering, visual-review, and normalized text-comparison process was repeated for Chapter 2. Its first release is deliberately data-only: adding it does not require a new hard-coded application registry entry.

## Chapter 3 extraction boundary

- Title: `USD Is Not DXY`
- Printed pages: 16-20
- Physical PDF pages: 17-21
- Next boundary: Chapter 4 begins on printed page 21 / physical PDF page 22
- Canonical reader text SHA-256: `16ce02ba0096a878eeb32522b6d598270545fc715149a8a346f9fa1dae97e16a`

Chapter 3 includes a source diagram and a four-column cross-check table. Their labels and relationships were visually reviewed and represented through the existing structured text model; the remaining narrative was compared against the certified PDF after whitespace and line-wrap normalization. This release requires no application-code or schema change, demonstrating that the published catalog supports reusable data-only chapter ingestion.


## Chapter 4 extraction boundary

- Title: `How the Dollar Moves Oil, Gold, Bitcoin, Gas, and FX`
- Printed pages: 21-26
- Physical PDF pages: 22-27
- Next boundary: Chapter 5 begins on printed page 27 / physical PDF page 28
- Canonical reader text SHA-256: `1cc90b04e249fe200a5ec2ea907043906c5493bfc703402daac647bf376929d1`

Chapter 4 includes the Dollar Transmission Chain figure. Its labels and relationships were visually reviewed and represented through the existing structured text model; the complete chapter boundary was rendered and checked page by page, and the narrative was compared against the certified PDF after whitespace and line-wrap normalization. The release contains eleven reader sections and five mastery questions in the private payload, requires no application-code or schema change, and leaves Production untouched.


## Chapter 5 extraction boundary

- Title: `Oil Is Not a Dollar Trade Only`
- Printed pages: 27-31
- Physical PDF pages: 28-32
- Next boundary: Chapter 6 begins on printed page 32 / physical PDF page 33
- Canonical reader text SHA-256: `d9a41ffd7b8ada135bd64a802309837cec329236d2c144c93e04bb5ea22b512f`

Chapter 5 contains three source examples, including a worked local-currency oil-cost example. The complete boundary was rendered and checked page by page, the examples were represented through the existing structured group model, and all remaining narrative was compared against the certified PDF after whitespace and line-wrap normalization. The release contains twelve reader sections and five mastery questions in the private payload, requires no application-code or schema change, and leaves Production untouched.

## Chapter 6 extraction boundary

- Title: `Gold and the Dollar`
- Printed pages: 32-35
- Physical PDF pages: 33-36
- Next boundary: Chapter 7 begins on printed page 36 / physical PDF page 37
- Canonical reader text SHA-256: `8da55ca266864f2f43ba2668ba1beb91a184a52ca5bcd3f9d022f79f7a7ad8ed`

Chapter 6 contains three source examples, including a worked real-yield opportunity-cost example. The complete boundary was rendered and checked page by page, the examples were represented through the existing structured group model, and all remaining narrative was compared against the certified PDF after whitespace and line-wrap normalization. The release contains eleven reader sections and five mastery questions in the private payload, requires no application-code or schema change, and leaves Production untouched.

## Chapter 7 extraction boundary

- Title: `Bitcoin and the Dollar`
- Printed pages: 36-40
- Physical PDF pages: 37-41
- Next boundary: Chapter 8 begins on printed page 41 / physical PDF page 42
- Canonical reader text SHA-256: `f3a16b4def4972fc5b8fc3f7190adf63a4ebe17d7c1326b4e69afb9aee22615f`

Chapter 7 contains three anchor examples, including a worked short-term dollar hurdle-rate example. The complete boundary was rendered and checked page by page, the examples were represented through the existing structured group model, and all remaining narrative was compared exactly against the certified PDF after whitespace and line-wrap normalization. The release contains ten reader sections and five mastery questions in the private payload, requires no application-code or schema change, and leaves Production untouched.

## Repository policy

The certified full-book PDF, canonical chapter text, mastery answer key, and corrective feedback are controlled content. None is stored in the public repository or offered as a customer download. The repository contains only source metadata, integrity hashes, generic rendering/scoring code, and synthetic test fixtures.

Published content is stored as versioned JSON in `public.guided_content_releases`. The table has forced row-level security, an explicit deny policy for browser roles, no client privileges, and a read-only grant for the server-side `service_role`. A stable chapter number and partial unique indexes make the published rows the server-side catalog while preserving older versioned rows. The protected server route reads that catalog or resolves one published release only after account entitlement succeeds, then checks both the source-document hash and reader-text hash before rendering. Interactive questions remain a separate learning layer inside the protected payload and are not presented as canonical manuscript text.
