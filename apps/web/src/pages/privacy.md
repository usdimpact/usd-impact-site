---
layout: ../layouts/BaseLayout.astro
title: "Privacy Notice | USD Impact"
description: "How USD Impact handles waitlist information and limited learning telemetry."
---

# Privacy notice

_Last updated: July 28, 2026_

## What we collect

When you join the *Read the Dollar First* waitlist, we collect the email address you submit and the time the contact record is created.

The website also records limited first-party learning events needed to understand whether educational resources work. These events can include:

- a Weekly Dollar Regime Checklist download;
- a quiz start or retry;
- quiz completion, pass or fail outcome, and aggregate score;
- the page route where the event occurred; and
- campaign values explicitly present in `utm_source`, `utm_medium`, or `utm_campaign` URL parameters.

Learning telemetry does not include quiz answer choices, correct answers, email addresses, account identifiers, advertising identifiers, persistent session identifiers, or raw IP addresses in the application event record.

## Why we collect it

Waitlist information is used only to:

- confirm that you joined the waitlist;
- send the purchase link when the book becomes available; and
- send essential availability updates directly related to the book.

Learning telemetry is used to:

- measure whether the checklist and quizzes are used;
- identify completion and retry patterns;
- improve question clarity and the learning sequence; and
- detect failures in educational workflows.

Joining the waitlist does not subscribe you to unrelated market commentary, trading alerts, or third-party promotions.

## Service providers

The website is deployed through Vercel. Vercel processes website requests and application runtime logs needed to operate and troubleshoot the service. Aggregate learning counters and short-lived duplicate-event identifiers are stored through Upstash Redis connected to the Vercel project. Waitlist contacts and confirmation emails are processed through Resend. These providers process data on behalf of USD Impact to operate the website, learning tools, waitlist, and requested email delivery.

## Retention and deletion

Your waitlist record is retained until you unsubscribe, request deletion, or the waitlist is retired. You may withdraw at any time by replying to a waitlist email with a deletion request. Future availability messages will include an unsubscribe mechanism where required.

Daily aggregate learning counters are retained for up to 24 months. Duplicate event identifiers are retained for up to 24 hours and are used only to prevent repeated counting. Raw learning event bodies are not stored in the durable analytics database. Operational runtime-log retention follows the hosting plan and project settings.

## Sharing and sale

USD Impact does not sell waitlist email addresses or learning telemetry. Information may be shared only with service providers required to operate the website, store aggregate telemetry, store the waitlist, deliver requested email, and maintain production systems.

## Security

API credentials are stored as protected deployment environment variables and are not exposed in the public website source. Learning event payloads use a strict allowlist and deliberately exclude cookies, user-agent strings, referrers, email addresses, persistent session identifiers, and quiz answer selections. Reporting access is restricted through a protected server endpoint. No online system can guarantee absolute security, but access is limited to the services required to operate the website.

## Your choice

Submitting the waitlist form is optional. The consent checkbox is not preselected. You may continue using the educational website without joining the waitlist. Learning events are designed not to block downloads, quiz scoring, retries, or navigation if telemetry is unavailable.

This notice describes current website operations and is not legal advice.
