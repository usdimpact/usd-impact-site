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

## Repository policy

The certified full-book PDF, canonical chapter text, mastery answer key, and corrective feedback are controlled content. None is stored in the public repository or offered as a customer download. The repository contains only source metadata, integrity hashes, generic rendering/scoring code, and synthetic test fixtures.

Published content is stored as versioned JSON in `public.guided_content_releases`. The table has forced row-level security, an explicit deny policy for browser roles, no client privileges, and a read-only grant for the server-side `service_role`. A stable chapter number and partial unique indexes make the published rows the server-side catalog while preserving older versioned rows. The protected server route reads that catalog or resolves one published release only after account entitlement succeeds, then checks both the source-document hash and reader-text hash before rendering. Interactive questions remain a separate learning layer inside the protected payload and are not presented as canonical manuscript text.
