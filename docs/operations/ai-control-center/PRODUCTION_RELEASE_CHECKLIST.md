# USD Impact Production Release Checklist

Use this checklist for every production release affecting `usdimpact/usd-impact-site`.

## 1. Scope and authority

- [ ] Change is scoped to the intended issue/task.
- [ ] No unrelated refactor or generated junk is included.
- [ ] `docs/production-deployment.md` still identifies Vercel as the canonical website production provider.
- [ ] Cloudflare Pages work is limited to the separate pipeline dashboard unless explicitly reviewed otherwise.
- [ ] No DNS, mail, payment, authentication, or Production-secret change is implied unless separately authorized.
- [ ] If the change affects authentication email, transactional email, waitlist/marketing mail, support routing, consent records, sender domains, or email provider configuration, `docs/operations/email-readiness-release-gate.md` is evaluated and its mandatory state is satisfied.

## 2. Content and sources

- [ ] Time-sensitive claims are current.
- [ ] Important factual claims have authoritative sources.
- [ ] Event dates and publication dates are not conflated.
- [ ] No fabricated citations or unsupported numerical claims.
- [ ] Content structure follows the current USD Impact editorial standard where applicable.

## 3. Compliance

- [ ] Educational/informational framing is preserved.
- [ ] No guaranteed outcomes, direct buy/sell recommendations, fake urgency, or unsupported price targets.
- [ ] Required compliance note is present where applicable.
- [ ] Paid-access, privacy, consent, refund, or account language has been reviewed when affected.
- [ ] Marketing consent is not used to gate required authentication, security, purchase, entitlement, refund, privacy, or account-deletion communications.

## 4. Repository quality gates

- [ ] Required GitHub checks are running against the exact PR head SHA.
- [ ] Content validation passes.
- [ ] Report validation passes when applicable.
- [ ] Compliance validation passes.
- [ ] Internal-link validation passes.
- [ ] Publishing validation passes.
- [ ] Automation-health validation passes.
- [ ] Function/API validation passes when affected.
- [ ] Supabase contract validation passes when affected.
- [ ] Production build passes.

## 5. Preview QA

- [ ] Vercel preview deployment is available for the PR when expected.
- [ ] Changed routes render on desktop.
- [ ] Changed routes render on mobile.
- [ ] Navigation and important CTAs work.
- [ ] Internal and external source links work.
- [ ] Canonical URL is correct.
- [ ] `noindex`/robots behavior is intentional.
- [ ] hreflang/language routing is correct when multilingual pages change.
- [ ] No obvious runtime or console failure is present.

## 6. Merge gate

- [ ] PR is reviewable and not blocked by unresolved critical feedback.
- [ ] Required GitHub quality workflow passed on the current head SHA.
- [ ] No P0/P1 issue directly invalidates the release.
- [ ] Domain-specific release gates are satisfied for any affected high-risk subsystem.
- [ ] Rollback candidate is known.
- [ ] Merge is through the protected `main` path; no direct production bypass.

## 7. Post-deploy production verification

- [ ] Vercel production deployment is `READY`.
- [ ] Production deployment corresponds to the intended merged commit.
- [ ] `https://www.usd-impact.com/` returns successfully.
- [ ] `https://usd-impact.com/` redirects to `www`.
- [ ] Changed page/version is visible in production.
- [ ] Critical forms/APIs remain operational when affected.
- [ ] Daily USD Impact automation remains operational when affected.
- [ ] No accidental duplicate publication exists.
- [ ] No major production regression is detected.

## 8. Release record

Record:

- PR number
- merge commit SHA
- Vercel production deployment ID/URL when available
- verification timestamp
- verifier
- exceptions or known follow-ups

Only after Section 7 passes may the release be marked **RELEASE VERIFIED**.

If any mandatory gate fails, use **RELEASE BLOCKED**, state the failed gate and root cause, and do not bypass the control.
