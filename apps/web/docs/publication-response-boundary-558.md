# Recorded-publication HTTP response boundary - issue 558

## Status and scope

Draft-only integration component. No HTTP route, middleware matcher, provider
setting, database, credential, admission writer or public deployment is enabled.
It advances the final-response requirement; it does not complete issue 558.

Prepared against PR 559 head `0c7429f8168292ea2686690ed183c372b28911f8`
and main `058d4d893ab12ce7ddd51ad43154d02b8536ca59`.

Four-file increment: a native Node HTTP handler factory, loopback HTTP tests,
this document, and one awaited test import in `validate-publishing.mjs`.
Existing calendar and serving-policy implementations are unchanged.

## Boundary contract

`createRecordedPublicationHandler` takes trusted server configuration: surface,
exact path, source loader, authenticated authority/history readers, renderer and
clock. It has no default provider and cannot write admission records. Only a
previously uncommitted native `ServerResponse` paired with its request is accepted.
A request cannot choose the evidence, clock, surface or source set through its
query, Host or forwarding headers. Authentication of provider evidence and of the
actual public serving context remains the responsibility of unimplemented adapters.

The factory creates a separate policy instance for each request. It snapshots
bounded Markdown inputs, obtains authority/history, and passes only filtered,
frozen content to the renderer. The renderer is trusted application code, not
user-supplied code. It never receives request/response objects or raw held sources.

Only bounded immutable string output is accepted. Streams, Response objects,
Buffers, arbitrary header objects and oversized output are rejected. No response
headers or content are sent while authority reads or rendering are pending.
After rendering, the handler independently reads authority/history again and
checks both the original and refreshed policy tickets. Authority/history drift
holds the response. A recorded preview leaving a current-news projection may
cause one bounded re-render, so an expiry transition can remove that item without
removing unrelated admitted content. A second unstable projection holds.

After encoding the final body and preparing headers, it checks the tickets and
exact selected projection immediately before synchronous `writeHead`/`end`.
There is no await or renderer/provider callback between that final decision and
the native response write. This is an in-process dispatch decision, not proof
of the time a remote browser receives bytes or of distributed transaction order.
An older successful check or cached rendered string is not sufficient.

The handler owns all response headers on its eventual routes. It removes queued
headers, including validators, redirects, cookies and preload links, then writes
fixed security and browser/CDN/Vercel no-store headers. It does not return 304 or
partial cached content based on request validators. Real Vercel routing, header
merging, warm-cache and framework response-wrapper compatibility remain untested.
Existing site route headers have not changed.

GET and HEAD use the same eligibility policy; HEAD does not render or send a
body. Unsupported methods produce 405. A held article produces generic 404;
provider, renderer and final-evidence failures produce generic 503. Error messages
and provider-supplied pseudo-error codes cannot enter responses or diagnostics.
An already-flushed response is refused and cannot be retroactively made safe.
Duplicate invocations cannot share or reclaim a response.

A bounded real-time preparation timer and client-disconnect cancellation prevent
late completion from dispatching a second response. Abort signals reach callbacks;
already-running remote work is not claimed to be cancelled unless its adapter
honors the signal. No additional adapter calls begin after detected cancellation.
The timer does not turn an expired publication decision into a pass.

## Tests and limitations

The test file opens temporary HTTP servers on `127.0.0.1` and exercises actual
Node request/response bytes. It closes connections and servers after each case.
It uses synthetic content, controlled clocks and mocked authority/history.
It does not contact BLS, Vercel, any database or any AI provider.

Sixty regression groups cover stable serving, held/pending/revoked records,
legitimate archives, aggregate exclusion, expiry during async rendering,
re-rendered archive labels, final-write-time expiry, authority/history changes,
renderer errors, streaming/oversized output, HEAD/methods, exact paths, header
cleanup, conditional requests, spoofed context, duplicate/concurrent requests,
callback timeouts, disconnects and post-cancellation completion.

The aggregate renderers in tests serialize the filtered view. They are not the
production Astro HTML/RSS/XML renderers. The route table is an exact-match handler
contract, not installed route coverage. It rejects unregistered slash/encoded/
`.html` variations locally; it cannot prevent Vercel from serving an unguarded
static file on another path. The proposed archive route is not created here.

Before activation: obtain raw provider/control/role/artifact evidence; implement
trusted adapters, durable transactional admission and outage-safe archive reads;
wire every actual article/aggregate/cache/alias route; resolve unsupported event
families; test delayed cutover and warm CDN caches with authorized isolated
infrastructure; then request exact-head/base and protected-control release approval.
Do not close issue 558 on this component's tests.

## Primary references

- Node HTTP response API: https://nodejs.org/api/http.html
- Vercel Routing Middleware: https://vercel.com/docs/routing-middleware

These references describe transport/platform behavior, not installed controls.
