# Canonical-route accessibility regression checklist

Target: WCAG 2.2 AA

Status: automated source contracts exist; manual execution is required per release candidate

Important: completion of this checklist is evidence, not a declaration of legal conformance.

## Routes

- `/`
- `/start-here/`
- `/book/read-the-dollar-first/`
- `/audiobook/read-the-dollar-first/`
- `/video-library/`
- `/account/sign-in/`
- `/account/`
- Protected Guided Edition, audiobook, and video routes using an authorized non-customer QA account only

## Evidence header

Record release SHA, Preview URL, test date/time and timezone, tester, browser/OS, viewport, zoom, assistive technology, authentication state, and any intentionally excluded provider-backed action. Never put a customer email, user ID, token, signed media URL, or protected object path in the record.

## Automated release checks

- Build and source contracts: exactly one main landmark/skip target and one H1 on canonical public templates; accessible form labels/names; duplicate-ID checks; menu keyboard contract; reduced-motion rules; responsive image dimensions/srcset; captions indicated; no public Stream UID/token/origin disclosure.
- Run an automated accessibility engine on every rendered canonical route available in Preview. Fail the release for a new critical violation; triage serious/moderate findings with route and selector.
- Record Lighthouse accessibility and performance results as diagnostic evidence, not as a conformance score.

## Manual checks

| # | Test | Pass condition | Result/evidence |
|---:|---|---|---|
| 1 | Landmarks | One main; header/nav/footer/aside names are distinct and useful | |
| 2 | Heading navigation | One descriptive H1; levels communicate structure without skipping for appearance | |
| 3 | Skip link | First keyboard action reveals it and moves focus to main content | |
| 4 | Full keyboard path | All links, controls, disclosures, dialogs, media controls, and forms work without a pointer | |
| 5 | Focus visibility | Every interactive element has a visible, non-obscured focus indicator | |
| 6 | Menu open/close | Button announces state; groups work; Escape/outside click close; focus returns appropriately | |
| 7 | Focus order | Order follows the visual/reading sequence; no trap or unexpected jump | |
| 8 | Touch targets | Primary navigation/actions meet the 44×44 preferred target or have adequate spacing | |
| 9 | 200% zoom | Text reflows; functionality and content remain available without overlap | |
| 10 | 400% / 320 CSS px | Single-column reflow works; no two-dimensional scroll for ordinary content | |
| 11 | Text contrast | Body, muted, gold, legal, link, and disabled text meet required contrast | |
| 12 | Non-text contrast | Inputs, focus rings, boundaries, icons, and status indicators remain perceivable | |
| 13 | Text resizing | No clipping or loss when browser text-only size is increased | |
| 14 | Reduced motion | No essential information depends on animation; motion is suppressed when requested | |
| 15 | Link purpose | Link text is understandable in context; repeated links have predictable targets | |
| 16 | Images/icons | Informative images have appropriate alt text; decorative line icons are hidden from AT | |
| 17 | Forms | Labels, instructions, required state, errors, and recovery are announced and associated | |
| 18 | Status updates | Loading, cooldown, success, failure, progress, and filtering are announced without focus theft | |
| 19 | Authentication | Passkey, email link, six-digit code, cooldown/429, and intended-route return are understandable | |
| 20 | Audio | Player is keyboard/AT operable; chapter and saved-position status is clear | |
| 21 | Video | Captions can be enabled; transcript location is present; progress announcements are useful | |
| 22 | Account safety | Export/support/passkey/sign-out/delete controls are distinguishable; destructive action is separated | |

## Release disposition

Record each failure with severity, route, exact reproduction steps, screenshot or DOM evidence, owner, and decision. New critical failures block release. Any accepted limitation needs named ownership, documented impact, mitigation, and a review date.
