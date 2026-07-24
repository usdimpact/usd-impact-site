# Implementation Notes — USD Impact A–Z Quiz Spine v1

## Purpose
This package consolidates the first 12 USD Impact quiz JSON files for Astro / Cloudflare website implementation.

## Recommended file placement
Copy the quiz files into:

```text
src/content/quizzes/en/
```

Keep support files in a project documentation folder, for example:

```text
docs/quiz-system/
```

## Routing
Use `ROUTE_INDEX.json` to create quiz pages and next/previous navigation.

## UX recommendations
- Show quiz title, learning objective, key concepts, questions, practical scenarios, score guide, follow-up path, and compliance note.
- Keep answer explanations hidden until the learner submits or reveals answers.
- Keep common-mistake checkpoints visible after completion.
- Use progress labels such as `Quiz 1 of 12`.

## Localization readiness
Each quiz includes `canonicalId`. Localized files should preserve canonicalId and change:
- language
- title
- seoTitle
- metaDescription
- slug
- relatedLessonUrl
- question wording
- explanations
- compliance note only if legally adapted by language/market

## Compliance rule
No quiz should be rendered as investment advice, trading advice, or a recommendation to buy/sell any asset. Avoid guaranteed outcomes and universal hedge or allocation instructions.
