# Production accessibility evidence — 2026-09-04

Target: WCAG 2.2 AA

Release: `4f9d4b1420d8cc552ad157d6c836c1c7d9b6937c`

Production origin: `https://www.usd-impact.com/`

Scope: read-only public-route verification plus local release-contract validation. This record is evidence, not a declaration of legal conformance.

## Automated and rendered contracts

- `npm run validate:ux`: passed.
- `npm run validate:a11y-build`: passed for 15 canonical routes.
- `npm run validate:video-library`: passed.
- `npm run validate:paid-access`: passed.
- A clean static build completed with telemetry disabled, followed by successful accessibility, checkout-presentation, CSP, and Production-build verification.

## Production route evidence

The 15 canonical public routes were checked in the Production browser. The protected `/account/` route correctly returned to sign-in for the anonymous verification session.

Across the rendered routes:

- one `main#main-content` and one visible H1 were present;
- the document language and page title were present;
- no duplicate IDs, unnamed visible buttons or links, missing image alternatives, or unlabeled visible form controls were found;
- visible heading sequences did not skip levels;
- Main and Footer navigation landmarks were named, and the Video Library collection filter had its own useful name;
- the skip link was the first keyboard focus stop, became visible with a 3px outline, and moved focus to `main#main-content`;
- representative homepage, Video Library, checkout, and sign-in keyboard paths retained visible focus and did not trap focus;
- menu groups opened from the keyboard, closed with Escape, and returned focus;
- no horizontal overflow appeared at the available desktop viewport;
- status regions were present for commerce readiness, catalog filtering/progress, and sign-in feedback.

The 44px preferred target was met by primary actions and the collection filters. Some text links remain smaller than 44px in one dimension and therefore rely on their surrounding spacing; this record does not convert that observation into a blanket touch-target pass for every mobile layout.

## Contrast finding and correction

Computed-color sampling covered 1,629 visible text runs across 14 directly rendered public pages. Five identical Video Library path labels used `#9b7526` on `#f7f8fa`, which computes to approximately 3.98:1 and is below the 4.5:1 requirement for their 12px text.

The scoped correction changes those labels to the existing dark-gold text token value `#8a6518`, which computes to approximately 5.00:1 on the same background. A source regression assertion now protects that value. The change must still pass Preview and Production visual verification before the contrast finding is closed for the live site.

## Evidence that still requires owner or device access

- 200% browser zoom and 400%/320-CSS-pixel reflow could not be forced through the available cloud-browser interface. Responsive source/build contracts passed, but that is not a substitute for the manual zoom check.
- A real screen reader or other platform assistive technology was not available. DOM semantics and keyboard behavior passed, but spoken output remains unverified.
- Protected book, audiobook, video-player, progress, account-safety, and cross-section single-sign-in checks require an explicitly authorized non-customer QA/owner account and a supported sign-in method.
- Captions, transcript location, player accessibility, and saved-position announcements require authenticated protected-media access plus the provider inventory evidence recorded separately.

These limitations remain open rather than being inferred as passes.
