# Read the Dollar First — QR and print-link plan

Date: 2026-08-29
Status: Phase 2C preparation only; no QR has been inserted into the master book.

## Principle

Printed material must never encode implementation routes that may later move. The book should use only the already released `/go/` aliases governed by `apps/web/src/data/book-site-bridge/print-links.json`.

The alias is the print contract. Its internal destination may be changed later only through a separately reviewed website release while preserving the printed short URL.

## Existing governed alias set

The released registry contains 19 aliases:

- `/go/book/`
- `/go/companion/`
- `/go/c01/` through `/go/c13/`
- `/go/dxy-practice/`
- `/go/weekly-practice/`
- `/go/score/`
- `/go/methodology/`

Chapter 3 and Chapter 11 aliases already resolve directly to their corresponding practice tools; the other chapter aliases resolve to chapter companion pages.

## Required QR placements

| Placement | Printed location | Short URL | Purpose | Requirement |
| --- | --- | --- | --- | --- |
| Chapter 3 | end of Chapter 3, printed p. 20 | `usd-impact.com/go/c03` | DXY vs. Broad USD practice | required |
| Chapter 10 | end of Chapter 10, printed p. 55 | `usd-impact.com/go/score` | current Weekly Score | required |
| Chapter 11 | end of Chapter 11, printed p. 59 | `usd-impact.com/go/c11` | Weekly Regime Lab | required |
| Appendix B | final Appendix B page, printed p. 79 | `usd-impact.com/go/methodology` | current Score v2 methodology and audit artifacts | required |

## Optional QR placement

| Placement | Printed location | Short URL | Purpose | Rule |
| --- | --- | --- | --- | --- |
| Chapter 13 | companion section, printed pp. 68-69 | `usd-impact.com/go/companion` | canonical Book Companion hub | optional; text-only if layout is tight |

The optional Chapter 13 QR should be dropped before any required QR if the layout becomes crowded.

## Printed labels

Use plain explanatory labels rather than marketing copy:

- Chapter 3: `Practice DXY vs. Broad USD`
- Chapter 10: `Open the current Weekly Score`
- Chapter 11: `Practice the weekly framework`
- Appendix B: `Open the current Score v2 methodology`
- Chapter 13 optional: `Open the Book Companion`

Do not use urgency, scarcity, performance, outcome or purchase language next to a QR.

## QR encoding rules

1. Encode HTTPS URLs only.
2. Encode the short alias, not the current destination.
3. Do not add UTM parameters, personal identifiers or session tokens to the printed QR.
4. Keep the human-readable short URL printed below or beside every QR.
5. Use a quiet zone of at least four modules around the code.
6. Use high-contrast black/dark foreground on white/light background.
7. Do not reverse the QR or place it over a photograph/texture.
8. Final physical size should be at least 25 mm x 25 mm; 28-32 mm is preferred for a book page.
9. Generate at vector quality for final print layout where supported.
10. Test every QR from both iOS and Android before manuscript freeze.

## Route behavior that must remain true before print freeze

### `/go/c03/`

Must resolve to Chapter 3 DXY-versus-broad-USD practice and preserve book context.

### `/go/score/`

Must resolve to the public Weekly Score and preserve book/Chapter 10 context.

### `/go/c11/`

Must resolve to the Weekly Regime Lab and preserve book context.

### `/go/methodology/`

Must resolve to the public Score methodology and preserve book/Appendix B context.

### `/go/companion/`

If used, must resolve to the canonical Book Companion hub.

## Search-index behavior

The `/go/**` alias pages are implementation helpers for stable printed links and should remain outside the public sitemap. Their current `noindex` treatment should remain unchanged unless a later search architecture explicitly replaces it.

The destination pages can retain their own existing indexing policy. The two practice pages and Companion remain deliberately outside normal search indexing under the current bridge architecture.

## Pre-print QR test matrix

Every required QR must pass all of the following:

- human-readable short URL matches encoded URL exactly;
- HTTPS opens without certificate warning;
- alias page returns successfully;
- alias points to the intended governed destination;
- edition/chapter context parameters survive the redirect/refresh behavior where applicable;
- destination page renders on a 320 px mobile viewport;
- no login, payment or entitlement is required for the public explanatory/practice destination;
- no unexpected checkout action occurs;
- back navigation returns normally;
- QR is readable from a printed proof at normal handheld distance.

## Change-control rule

After the manuscript/route freeze, do not rename or remove a printed `/go/` alias. If the destination must evolve, update the alias target under normal website review while keeping the public short URL stable.

Any new printed QR added after freeze requires a new publication review because it changes the durable contract between the book and the website.
