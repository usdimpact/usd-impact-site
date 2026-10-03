# Vendored http-cache-semantics security patch

Temporary USD Impact fork of `http-cache-semantics` 4.2.0.

- Upstream repository: https://github.com/kornelski/http-cache-semantics
- Upstream commit: `f01112e954b83cfa8765b633ba880e5e980aa54c`
- Advisory: `GHSA-ch52-4w7c-c8xp`
- Local version: `4.2.1`
- License: BSD-2-Clause (see `LICENSE`)

The only behavioral change is in stale-request handling: client `max-stale`
cannot revive a response when reuse without revalidation is forbidden by
response `no-cache`, shared-cache `proxy-revalidate`, or the package's
shared-cache Set-Cookie safety rule.

This fork is temporary. Replace it with an upstream fixed release after that
release is available and the regression test remains green.
