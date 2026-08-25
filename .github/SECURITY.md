# Security Policy

USD Impact welcomes responsible reports about security issues that could affect the confidentiality, integrity, or availability of the service or its users.

## Reporting a vulnerability

Please report suspected vulnerabilities privately to **support@usd-impact.com** with the subject line `Security report`.

Include enough information for us to reproduce and assess the issue safely, such as:

- the affected URL, API route, or feature;
- the observed and expected behavior;
- clear reproduction steps;
- the security impact you believe is possible;
- relevant request/response details with secrets, authentication tokens, personal data, and payment information removed;
- any non-destructive proof of concept that helps confirm the issue.

Do not include passwords, API keys, session tokens, private customer information, or other unnecessary sensitive data in the report.

## Scope

Reports are especially useful for issues affecting:

- `https://www.usd-impact.com` and `https://usd-impact.com`;
- USD Impact API and serverless endpoints;
- authentication, session, passkey, or account controls;
- paid-access and entitlement enforcement;
- private audiobook or video delivery and signed-media controls;
- security headers, Content Security Policy, dependency or supply-chain controls;
- unintended exposure or modification of user or operational data.

Educational-content corrections, source disputes, billing/support questions, and ordinary product feedback are not security vulnerabilities; please use the normal support channel for those matters.

## Safe testing expectations

Please use the minimum activity needed to demonstrate a suspected issue. Do not:

- access, copy, alter, delete, or retain another person's data;
- intentionally degrade availability or perform denial-of-service testing;
- send unsolicited messages, spam, or high-volume automated traffic;
- attempt social engineering, phishing, credential theft, or physical intrusion;
- introduce malware or persistence;
- test third-party systems that are not operated by USD Impact;
- use a discovered issue to obtain paid content beyond what is necessary to demonstrate the access-control problem.

If testing could affect real user data, Production availability, payment state, or irreversible records, stop and report the issue instead of proceeding.

## Disclosure coordination

Please allow reasonable time for investigation and remediation before publishing vulnerability details. USD Impact may ask for additional technical information or a safe retest after a fix is prepared.

This policy does not promise a bug bounty, payment, response-time SLA, or eligibility for compensation.

## Security contact metadata

A machine-readable security contact is published at:

`https://www.usd-impact.com/.well-known/security.txt`
