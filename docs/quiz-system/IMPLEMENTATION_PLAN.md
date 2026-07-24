# Quiz-gated book implementation plan

## Product rule

Readers can progress through *Read the Dollar First* at no charge by passing each chapter checkpoint. A one-time purchase grants immediate access to every chapter and bypasses the quiz gates.

- Chapter 1 is public.
- Each chapter checkpoint contains 10 questions.
- Passing score: 8/10.
- Failed attempts can be retried without penalty.
- A passed checkpoint unlocks the next chapter.
- A full-book entitlement unlocks all current and future chapters in this edition.
- Quiz results are educational checkpoints, not certifications or investment recommendations.

## Phase 1 — foundation and preview

This bundle implements the safe, reversible foundation:

1. Import all 12 signed English quiz files without changing their contents.
2. Validate quiz structure, routes, answer keys, and release flags.
3. Generate a server-only answer runtime.
4. Score released quizzes through `/api/quiz-submit`.
5. Publish a reusable accessible quiz interface and a catalog page.
6. Release only `/start-here/quiz` until the next matching chapter route exists.
7. Store a temporary completion summary in local storage for preview convenience.
8. Keep the purchase button pointed at `PUBLIC_BOOK_PURCHASE_URL`, with the existing waitlist as fallback.

Phase 1 does not claim to enforce secure chapter access. It is intended for design, content, accessibility, and scoring validation before identity and entitlement services are connected.

## Phase 2 — production access control

### Identity

Use Supabase Auth with email magic links. The lowest-friction flow is:

1. A reader opens Chapter 1 without an account.
2. The reader completes Quiz 1.
3. After a passing score, the reader enters an email address to save progress and unlock Chapter 2.
4. Supabase sends a magic link.
5. The authenticated callback claims the verified quiz pass and grants the next chapter.

Returning readers use the same email magic-link flow. Marketing consent must remain separate from transactional sign-in email.

### Payments

Use Stripe Checkout in one-time payment mode:

1. Create a server-side Checkout Session for the full-book product.
2. Include an internal product key and user/email correlation metadata.
3. Redirect to Stripe-hosted Checkout.
4. Verify Stripe's webhook signature using the raw request body.
5. Fulfill `checkout.session.completed` idempotently.
6. Write or update a full-book entitlement in Supabase.
7. Link unclaimed entitlements to a user only after that email is verified through Auth.

The success redirect is for user experience; it is not the source of truth for entitlement fulfillment.

### Protected content

Do not ship locked chapter bodies in public static HTML or browser JavaScript. Use one of these server-enforced patterns:

- preferred: on-demand rendered Astro routes with the Vercel adapter and a server-side access check;
- acceptable: a static chapter shell that requests sanitized chapter HTML from an authenticated Vercel Function.

The first chapter may remain statically generated. Every later chapter must be returned only after the server confirms either the prerequisite quiz grant or a full-book entitlement.

### Release control

The access map is the release authority. A quiz can be marked `released: true` only when:

- its lesson route exists;
- its next chapter content exists or it is the final checkpoint;
- validation and accessibility checks pass;
- the production access gate has been tested for anonymous, quiz-pass, paid, and unauthorized states.

## Phase 3 — complete book rollout

1. Import and review each chapter.
2. Add each chapter to the protected-content registry.
3. Release the matching quiz and next-chapter mapping in sequence.
4. Add account, progress, and purchase links to the book navigation.
5. Run end-to-end tests for free progression, retries, sign-in recovery, purchase bypass, refunds, and revoked entitlements.
6. Add the Quiz navigation item only after production QA.

## Required business decisions before live payments

- sale price and currency;
- tax handling and customer location rules;
- refund policy and entitlement revocation behavior;
- final purchase terms and privacy language;
- whether a refunded customer keeps access;
- whether future editions are included in the same entitlement.
