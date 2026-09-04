# Authoritative private-media manifest — 2026-09-04

Status: **authoritative application manifest**

Owner: USD Impact product/engineering

Delivery provider: Supabase Storage through server-mediated, entitlement-checked signed URLs

## Authority and boundaries

- Audiobook identity, order, filenames, byte sizes, SHA-256 digests, object paths, route mapping, and signed lifetime are governed by `apps/web/src/lib/private-audiobook.js` plus `apps/web/src/data/read-the-dollar-first-audiobook.js`.
- Book identity, filename, byte size, SHA-256 digest, object path, route mapping, and signed lifetime are governed by `apps/web/src/lib/private-book.js`.
- The protected browser never receives a Storage credential. The server checks access before minting a signed URL.
- The two buckets are private and intentionally have no browser-facing `storage.objects` policy.
- Storage inventory may contain a placeholder or operational object. It is not a published track and is excluded from the 20-track user-facing count.
- The book accessibility statement is part of the manifest: the current PDF is untagged and must not be represented as PDF/UA-conformant.

## Published objects

| Kind | Version | Bucket | Logical ID | Title | Filename | Bytes | MIME | SHA-256 | State | Application route | Signed TTL |
|---|---|---|---|---|---|---:|---|---|---|---|---:|
| book | 1.3 | library-pass-books | book | Read the Dollar First | `USD_Impact_Read_the_Dollar_First_Edition_1.3_v5.95_Phase2C_Scoped_Candidate_2.pdf` | 2281645 | application/pdf | `b96bf8cdc90a69112f367ef66dafe30b1e0fc2402edc43f249d8525db9fe3666` | published | /guided-edition/book/ | 300s |
| audiobook | v1 | library-pass-assets | read-the-dollar-first | Read the Dollar First | `00-read-the-dollar-first.mp3` | 2128764 | audio/mpeg | `946012ea5010c48be184b0d358741ec7926a844bb42960398443aac9dc4ddb91` | published | /guided-edition/audiobook/track/read-the-dollar-first/ | 3600s |
| audiobook | v1 | library-pass-assets | acknowledgments-and-reader-guide | Acknowledgments and Reader Guide | `01-acknowledgments-and-reader-guide.mp3` | 4293594 | audio/mpeg | `404c79abe686a0811ae480aaff7e406bfe6885ad62139d6a5a237271328d160d` | published | /guided-edition/audiobook/track/acknowledgments-and-reader-guide/ | 3600s |
| audiobook | v1 | library-pass-assets | introduction-why-this-book-exists | Introduction - Why This Book Exists | `02-introduction-why-this-book-exists.mp3` | 16648680 | audio/mpeg | `a79212c7e18919292b89737e851e02a63df18339e017ff2deee52d9a7f9315eb` | published | /guided-edition/audiobook/track/introduction-why-this-book-exists/ | 3600s |
| audiobook | v1 | library-pass-assets | chapter-1-why-the-dollar-comes-first | Chapter 1 - Why the Dollar Comes First | `03-chapter-1-why-the-dollar-comes-first.mp3` | 21081767 | audio/mpeg | `8b4ac6c668566c61dc4d2a8b1b60c85667fa6d901fd8494f8073ce41c8ec96bb` | published | /guided-edition/audiobook/track/chapter-1-why-the-dollar-comes-first/ | 3600s |
| audiobook | v1 | library-pass-assets | chapter-2-from-bretton-woods-to-fiat-discipline | Chapter 2 - From Bretton Woods to Fiat Discipline | `04-chapter-2-from-bretton-woods-to-fiat-discipline.mp3` | 21711851 | audio/mpeg | `d4b0cce22e9f86de380cf70dbc46f8abdf159eac0e9809a8366efb71d2596e56` | published | /guided-edition/audiobook/track/chapter-2-from-bretton-woods-to-fiat-discipline/ | 3600s |
| audiobook | v1 | library-pass-assets | chapter-3-usd-is-not-dxy | Chapter 3 - USD Is Not DXY | `05-chapter-3-usd-is-not-dxy.mp3` | 22664148 | audio/mpeg | `65a7678580e9fbf7e1e50c436d5d9e9fc88326bde1a8f5d3d89b92023460ec7f` | published | /guided-edition/audiobook/track/chapter-3-usd-is-not-dxy/ | 3600s |
| audiobook | v1 | library-pass-assets | chapter-4-how-the-dollar-moves-oil-gold-bitcoin-gas-and-fx | Chapter 4 - How the Dollar Moves Oil, Gold, Bitcoin, Gas, and FX | `06-chapter-4-how-the-dollar-moves-oil-gold-bitcoin-gas-and-fx.mp3` | 27391305 | audio/mpeg | `89858e715b9385a2e2d5afbecbeec9c62a656420e2f3a459ed72684c0abda70c` | published | /guided-edition/audiobook/track/chapter-4-how-the-dollar-moves-oil-gold-bitcoin-gas-and-fx/ | 3600s |
| audiobook | v1 | library-pass-assets | chapter-5-oil-is-not-a-dollar-trade-only | Chapter 5 - Oil Is Not a Dollar Trade Only | `07-chapter-5-oil-is-not-a-dollar-trade-only.mp3` | 24178221 | audio/mpeg | `b9e1eb43b60266a7bb1dbc59c35c9bcd195fbe221b193098b17cd3b13d1ba7ea` | published | /guided-edition/audiobook/track/chapter-5-oil-is-not-a-dollar-trade-only/ | 3600s |
| audiobook | v1 | library-pass-assets | chapter-6-gold-and-the-dollar | Chapter 6 - Gold and the Dollar | `08-chapter-6-gold-and-the-dollar.mp3` | 19479304 | audio/mpeg | `00b5efa8428fe6f80b43a099ac9f9f544ec08ad95af93035b730416cd76566b1` | published | /guided-edition/audiobook/track/chapter-6-gold-and-the-dollar/ | 3600s |
| audiobook | v1 | library-pass-assets | chapter-7-bitcoin-and-the-dollar | Chapter 7 - Bitcoin and the Dollar | `09-chapter-7-bitcoin-and-the-dollar.mp3` | 21664190 | audio/mpeg | `b0432e533278983f478c6ee973ea04b8422d150f61f2469dbbd26408e4bd92bf` | published | /guided-edition/audiobook/track/chapter-7-bitcoin-and-the-dollar/ | 3600s |
| audiobook | v1 | library-pass-assets | chapter-8-gas-lng-and-the-dollar | Chapter 8 - Gas, LNG, and the Dollar | `10-chapter-8-gas-lng-and-the-dollar.mp3` | 19505015 | audio/mpeg | `d0c5214d762c179953e74070074143db639771bf7c79f579a6105a29c7464f3e` | published | /guided-edition/audiobook/track/chapter-8-gas-lng-and-the-dollar/ | 3600s |
| audiobook | v1 | library-pass-assets | chapter-9-fx-carry-and-translation-risk | Chapter 9 - FX, Carry, and Translation Risk | `11-chapter-9-fx-carry-and-translation-risk.mp3` | 18167135 | audio/mpeg | `3cb80f6f9d8a68c0ac5ba1af9a7ea91803a49b2f0178df2bba72b0b6ba2b982d` | published | /guided-edition/audiobook/track/chapter-9-fx-carry-and-translation-risk/ | 3600s |
| audiobook | v1 | library-pass-assets | chapter-10-reading-regimes-the-eleven-year-record | Chapter 10 - Reading Regimes: The Eleven-Year Record | `12-chapter-10-reading-regimes-the-eleven-year-record.mp3` | 37150223 | audio/mpeg | `eb6b24eba2cff93ad0d35680ced2a4c113f3cd0ae42e62e2adbe2aab5b5ae127` | published | /guided-edition/audiobook/track/chapter-10-reading-regimes-the-eleven-year-record/ | 3600s |
| audiobook | v1 | library-pass-assets | chapter-11-the-weekly-operating-framework | Chapter 11 - The Weekly Operating Framework | `13-chapter-11-the-weekly-operating-framework.mp3` | 18683105 | audio/mpeg | `26554932d63675ce4452847341793834cfc5b909ab09e9289f2a4405e6688879` | published | /guided-edition/audiobook/track/chapter-11-the-weekly-operating-framework/ | 3600s |
| audiobook | v1 | library-pass-assets | chapter-12-common-mistakes-in-dollar-and-cross-asset-analysis | Chapter 12 - Common Mistakes in Dollar and Cross-Asset Analysis | `14-chapter-12-common-mistakes-in-dollar-and-cross-asset-analysis.mp3` | 23274825 | audio/mpeg | `6bd33b69d966b04cb857985a0707056e0ed74cc70d20a88c23f072ae065a328f` | published | /guided-edition/audiobook/track/chapter-12-common-mistakes-in-dollar-and-cross-asset-analysis/ | 3600s |
| audiobook | v1 | library-pass-assets | chapter-13-what-to-watch-from-here | Chapter 13 - What to Watch from Here | `15-chapter-13-what-to-watch-from-here.mp3` | 26885965 | audio/mpeg | `53c3fe19f740405c3c08b8d3d90f30f2248766fb300d97b0606b1c8f32bb370e` | published | /guided-edition/audiobook/track/chapter-13-what-to-watch-from-here/ | 3600s |
| audiobook | v1 | library-pass-assets | further-reading | Further Reading | `16-further-reading.mp3` | 3219632 | audio/mpeg | `9a9565410970b5f5c1f7bfec39313c1b82656f7546177cec518e3603d4483e6d` | published | /guided-edition/audiobook/track/further-reading/ | 3600s |
| audiobook | v1 | library-pass-assets | appendix-a-quick-glossary | Appendix A - Quick Glossary | `17-appendix-a-quick-glossary.mp3` | 24751856 | audio/mpeg | `450b6a97b096708435f0db891e4ee9dec17458a3338c4dbddfc587a4c9699c6c` | published | /guided-edition/audiobook/track/appendix-a-quick-glossary/ | 3600s |
| audiobook | v1 | library-pass-assets | appendix-b-usd-impact-score-methodology | Appendix B - USD Impact Score Methodology | `18-appendix-b-usd-impact-score-methodology.mp3` | 18886231 | audio/mpeg | `349844333398a408d01c714f511a1b1e805874a7b2ed2a4e09c34db677593b3f` | published | /guided-edition/audiobook/track/appendix-b-usd-impact-score-methodology/ | 3600s |
| audiobook | v1 | library-pass-assets | about-usd-impact | About USD Impact | `19-about-usd-impact.mp3` | 881779 | audio/mpeg | `faf54b3a98488ee8b8386a7adaa208f47ed2bb9f8ef549bca5f1188a4b6d1d00` | published | /guided-edition/audiobook/track/about-usd-impact/ | 3600s |

## Reconciliation and access gates

Release validation must keep all four sources aligned: this authority index, the two application manifests above, the UI chapter list, and the private Storage inventory. Anonymous access and access after entitlement revocation must fail closed. A placeholder or operational object must never be counted as a track or linked by the UI.

The source files remain executable authority if a prose row ever conflicts with them. Update this document in the same change that intentionally changes a media identity.
