# Phase 1 pull-request checklist

## Automated

- [ ] `npm run validate:quizzes`
- [ ] existing `npm run validate`
- [ ] existing `npm run build`
- [ ] Vercel Preview is READY
- [ ] generated quiz runtime is current
- [ ] source quiz checksums match the signed package

## Functional

- [ ] `/quiz/` lists all 12 checkpoints
- [ ] only `/start-here/quiz` is linked as released
- [ ] 10/10 passes
- [ ] 8/10 passes
- [ ] 7/10 fails
- [ ] failed attempt can be retried
- [ ] answer explanations render after submission
- [ ] unreleased canonical IDs return 404 from the score API
- [ ] current purchase CTA falls back to the book waitlist when no purchase URL is configured

## Accessibility

- [ ] keyboard-only completion
- [ ] visible focus state
- [ ] screen-reader question and progress announcement
- [ ] mobile layout at 320 px
- [ ] no new Lighthouse accessibility regression

## Security and release control

- [ ] correct answers do not appear in rendered page source before submission
- [ ] locked chapter bodies are not part of this PR
- [ ] no secrets or credentials are added
- [ ] Quiz is not added to the global navigation yet
- [ ] the remaining 11 quizzes stay unreleased
