import assert from 'node:assert/strict';
import {
  WAITLIST_BOOK_URL,
  WAITLIST_CONFIRMATION_SUBJECT,
  WAITLIST_PRIVACY_URL,
  WAITLIST_SUPPORT_EMAIL,
  buildWaitlistConfirmationEmail,
} from '../src/lib/waitlist-email-template.js';

const email = buildWaitlistConfirmationEmail();

assert.equal(Object.isFrozen(email), true);
assert.equal(email.subject, WAITLIST_CONFIRMATION_SUBJECT);
assert.match(email.subject, /waitlist/i);
assert.ok(email.text.length > 200);
assert.ok(email.html.length > 2000);
assert.ok(Buffer.byteLength(email.html, 'utf8') < 100_000);

assert.match(email.html, /^<!DOCTYPE html>/);
assert.match(email.html, /<html lang="en">/);
assert.match(email.html, /<meta charset="UTF-8">/);
assert.match(email.html, /<meta name="viewport" content="width=device-width, initial-scale=1.0">/);
assert.match(email.html, /<meta http-equiv="X-UA-Compatible" content="IE=edge">/);
assert.match(email.html, /<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"/);
assert.match(email.html, /max-width:600px/);
assert.match(email.html, /background-color:#071A33/);
assert.match(email.html, /Your place on the Read the Dollar First waitlist is confirmed\./);

for (const value of [WAITLIST_BOOK_URL, WAITLIST_PRIVACY_URL, WAITLIST_SUPPORT_EMAIL]) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(email.html, new RegExp(escaped));
  assert.match(email.text, new RegExp(escaped));
}

assert.match(email.text, /reply to this email with the word 'unsubscribe'/i);
assert.match(email.html, /reply to this email with the word <strong>unsubscribe<\/strong>/i);
assert.match(email.text, /not investment, legal, tax, trading, or financial advice/i);
assert.match(email.html, /not investment, legal, tax, trading, or financial advice/i);

const hrefs = [...email.html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
assert.ok(hrefs.length >= 3);
for (const href of hrefs) {
  assert.ok(
    href.startsWith('https://www.usd-impact.com/') || href.startsWith('mailto:support@usd-impact.com'),
    `Unexpected email link: ${href}`,
  );
}

for (const forbidden of [
  /<script\b/i,
  /<style\b/i,
  /<form\b/i,
  /<input\b/i,
  /<button\b/i,
  /<video\b/i,
  /<iframe\b/i,
  /<div\b/i,
  /javascript:/i,
  /\{\{[^}]+\}\}/,
  /http:\/\//i,
]) {
  assert.doesNotMatch(email.html, forbidden);
}

const second = buildWaitlistConfirmationEmail();
assert.deepEqual(second, email);

console.log('Waitlist email template tests passed.');
