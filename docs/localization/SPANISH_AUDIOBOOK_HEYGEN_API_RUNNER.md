# HeyGen API balance runner

This branch-only workflow is intentionally dormant until
`docs/localization/heygen-api-trigger.json` changes.

Security rules:

- Store the Developer API key only as the GitHub Actions repository secret
  `HEYGEN_API_KEY`.
- Never commit or paste the key into source, issues, PRs, logs, or chat.
- The workflow permits Track 06 only at this stage.
- It refuses to regenerate any segment whose manifest status is not `pending`.
- The first funded-API test target is Track 06 / segment 11.
- Output is retained as a private GitHub Actions artifact for 7 days.
- No Production, member storage, entitlement, auth, commerce, or deployment
  action is performed by this workflow.
