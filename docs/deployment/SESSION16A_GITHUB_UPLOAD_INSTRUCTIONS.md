# Session 16A GitHub Upload Instructions

Repository name: `usd-impact-site`

## Manual import

1. Create a private GitHub repository named `usd-impact-site`.
2. Unzip `USD_Impact_Session16A_usd-impact-site_repo_bootstrap.zip` locally.
3. Copy the `usd-impact-site/` contents into the repository root.
4. Run:

```bash
git init
git checkout -b develop
git add .
git commit -m "bootstrap: import Session 16A Astro site scaffold"
git remote add origin <your-github-repo-url>
git push -u origin develop
```

5. Create `main` only after the first pull request passes checks.

## Branch protection

Protect `main`, require pull requests, require CI checks, and restrict direct pushes.

## Local validation

```bash
cd apps/web
npm install
npm run validate:content
npm run validate:compliance
npm run validate:links
npm run build
npm run preview
```

## Do not commit

- API keys
- environment secrets
- private business files
- raw production book packages
- paid data exports without licensing clearance
