# Spanish EN/ES public destinations — editorial Preview contract (2026-11-01)

**Status: Draft translation review, not production authorization.** This work is stacked on accepted [UI-39 Draft #1047](https://github.com/usdimpact/usd-impact-site/pull/1047) and keeps the parent PR's exact navigation, account, payment and source-code safeguards.

## Scope in this Draft

| Original English destination | Spanish Preview route | Scope genuinely translated | Still English and explicitly marked |
|---|---|---|---|
| /news | /es/news/ | Spanish page heading, instructions, dates, archive navigation and compliance | Per-edition headlines, summaries, full published daily stories and feeds |
| /score | /es/score/ | Spanish educational framework, methodology limitations and member access descriptions | Complete methodology, underlying data, Research-only verified dashboard and member archive |
| /reports | /es/reports/ | Spanish report index, weekly/monthly access labels, actual 4-consecutive-Friday gate interpretation, compliance | Published weekly/monthly titles, summaries and full source reports |
| /video-library | /es/video-library/ | Full five-collection hierarchy and *all 51* public catalogue film titles/descriptions in neutral LATAM Spanish | Original English spoken films, authenticated member player and currently non-default Spanish captions |

The four routes are generated only in an explicitly identified Vercel **Preview** build (and are `noindex`). They must never become production routes through an accidental merged branch; `getStaticPaths()` returns **zero** Spanish review pages outside `VERCEL_ENV=preview`. The language navigation and persisted explicit preference point to these routes **in Preview only**. The five existing authorized public Spanish routes remain as-is.

**All 51 titles/descriptions** are translated as a discrete slug-keyed source-paired Draft dataset. No source film order, slug, duration, captions, UID, titles in English, member entitlement, audio stream, or Cloudflare delivery URL is altered. Spanish voice is NOT available on original videos, and Spanish captions are NOT currently auto-default until separate approved [account-media PR #1028](https://github.com/usdimpact/usd-impact-site/pull/1028).

## Provenance / content review checklist

- [ ] Editorial: validate 51 film title/description translations against each literal source slug, economic vocabulary, derivative/video marketing rights and relevant source-licence restrictions. Correct only misread sections. Do not translate new claims or alter the source.
- [ ] Spanish Daily: static UI is translated but full data-backed English news editions remain English. Translate individual articles only via existing publication/primary-source/rights process; do not claim live news is Spanish when not.
- [ ] Spanish Score: methodology page and member dashboard remain English, member Research entitlement unchanged, rights-gated historical Score stays protected. Check the wording on recalculated historical data vs contemporaneous evidence, and Score public-rights status.
- [ ] Spanish Reports: review current 4-consecutive-Friday monthly guard and avoid implied publication from readiness. Full weekly/monthly brief paragraphs stay source English until a separate editorial publishing gate.
- [ ] Video Library: subtitles for 51/51 originals exist in Cloudflare Stream and will preselect Spanish **only after** separate media-preference QA/activation; spoken English remains. Do not infer audio dubbing or create free signed videos.
- [ ] Public legal: preserve canonical/hreflang of the five established Spanish pages. All four Draft preview pages have `noindex`; do not index, sitemap, generate JSON-LD, or flip a locale manifest `releaseStatus` without another approval.
- [ ] Preview QA: exact source/translation pair link and menu, 375px/desktop layout, functional explicit language preference without account, storage disabled, protected page negative access, no `/es` route collision, original EN page untouched.
- [ ] English member video and audiobook protected access, $39 Library Pass entitlements, paid Research, symbolic-support audiobook merchant HOLD and existing signup continue untouched.
- [ ] Brand/commerce: free educational content is the future Fundraising direction **only where rights-cleared**, and Research/audiobook remain paid separately. These noindex pages do not authorize or activate the independent Fundraising frontend.

## Outstanding items (do not hide as translated)

- Weekly Dollar Regime Checklist: the linked original PDF is English; a genuine Spanish PDF/html equivalent requires source-document review, attribution, file/version checks and separate publication.
- Guided Edition member menu/book/audiobook/video player: still English because 13-chapter Spanish book/20-track Spanish audiobook release and account-language security controls are separate gates. Never publish paid media via a public Spanish index route.
- Individual Daily articles and Weekly/Monthly full reports: new translations need date/edition/source pairing and same fact checks as English; no blind machine translation of per-day market facts.
- Other legal pages: Spanish Privacy Notice is already public; English Terms/Refund/Disclosure language is not yet approved as a Spanish legal translation.

## Next safe release step

Review the **Preview-only** four Spanish public landing pages and 51 public video metadata entries. Record editorial and mobile QA PASS/FAIL plus screenshot receipts in this Draft. A separate owner approval must authorize any change to public locale releases, /es navigation, sitemap, caption defaults or market-data localization. No merge/deploy of these pages is authorized by this checklist.
