# Book-Site Bridge QA plan

Status: Preview gate. No Production authorization.

## Automated static QA

Run from `apps/web`:

```bash
node scripts/test-book-site-bridge.mjs
```

The test verifies:

- exactly 13 governed chapters;
- unique chapter IDs, numbers and print aliases;
- reciprocal chapter/tool relationships;
- exactly three use steps for every tool;
- declared agreement, divergence and limitations;
- required implementation files;
- no network calls, local storage or checkout links in the prototypes;
- Chapter 3 classifier cases;
- Chapter 11 comparison cases;
- reviewer matrix parity with the canonical registry.

## Repository build QA

Run the existing repository gates without changing package or environment configuration:

```bash
npm run validate
npm run build:preview
```

If the full validation requires unavailable external services, record the exact skipped gate and do not mark it passed.

## Preview browser routes

Check:

- `/book/read-the-dollar-first/companion/`
- all chapter routes from `01` through `13`;
- `/practice/dxy-vs-broad-usd/`;
- `/practice/weekly-regime/`;
- `/go/book/`, `/go/c03/`, `/go/c11/`, `/go/methodology/`;
- existing book, Three-Dial, Transmission Chain, Score and methodology links.

## Interaction QA

### Chapter 3

- required fields prevent incomplete submission;
- narrow versus broad disagreement returns a divergence classification;
- confirmation conflict reduces confidence in the text;
- result receives focus and is announced through `aria-live`;
- no data leaves the browser.

### Chapter 11

- comparison remains hidden before submission;
- the written reading requires at least 40 characters;
- fixture is visibly labeled as static and non-current;
- labels are aligned, partly aligned or materially different;
- differences link to the relevant chapter;
- user text is inserted with `textContent`, not HTML;
- no data leaves the browser.

## Accessibility QA

- keyboard-only completion;
- visible focus states;
- logical heading order;
- fieldset/legend or label/select relationships;
- result focus management;
- 200 percent zoom;
- mobile widths at 320, 375 and 768 CSS pixels;
- screen-reader check for forms and result announcements;
- sufficient contrast against current brand variables.

## Compliance QA

Confirm:

- no advice, recommendation, target, entry, exit or position-sizing language;
- no predictive use of the Score;
- no live-data implication in the static prototypes;
- no generic book sales placement;
- no checkout, payment or entitlement change;
- no manuscript, ISBN or publication change.

## Release decision

GO only for a Vercel Preview after automated and build gates pass.

NO-GO for merge, public navigation, sitemap approval or Production until a separate explicit authorization is recorded.
