# Security and bug review: swpt_debtors_ui

| | |
|---|---|
| Reviewed commit | `827323a` (2026-07-16) |
| Review date | 2026-10-27 |
| Scope | `src/` (payment-request parsing, debtor-info handling, Svelte components that render externally-supplied data, OAuth/token handling shared with the creditors UI) |
| Method | Manual code review; the fixed finding was reproduced with a Jest test of the URL-safety helper |

This is the issuer's (debtor's) web app. It holds the issuer's OAuth
token and can configure the currency and issue money, so the main
concern is XSS. This document covers the issue **fixed in this pull
request**, plus review notes.

## Summary

| ID | Severity | Finding | Status |
|---|---|---|---|
| SEC-1 | Medium | A payment request's description link allows `javascript:` URLs (DOM XSS on click) | Fixed |

## SEC-1: `javascript:` URL in a payment-request description (Medium, fixed)

**Where:** `src/components/PaymentInfo.svelte`; the data is parsed by
`src/payment-requests.ts`.

**Problem.** When the issuer pays someone, they open a payment request
(a `PR0` file / QR code) created by the other party. The request has a
free-form description with a `contentFormat`. When the format is `.` or
`-` (meaning the content is an IRI), the UI renders the content as a
link:

```svelte
<a href="{description.content}" target="_blank" rel="noreferrer">{description.content}</a>
```

The parser (`parsePaymentRequest` / `parseTransferNote`) only limits the
content length (3000) and does not restrict the scheme, and Svelte does
not sanitize `href`. So a counterparty can craft a payment request whose
description is `javascript:<payload>` with content format `.`. When the
issuer opens that request and clicks the description link, the payload
runs in the debtors-UI origin, which can drive the issuer's session
(configure the currency, issue money).

It needs the issuer to open the attacker's payment request and click the
link, so it is rated Medium.

**Fix.** A new `toSafeHttpUrl(uri)` helper in `payment-requests.ts`
returns the normalized URL only when its scheme is `http:` or `https:`,
and `undefined` otherwise. `PaymentInfo.svelte` renders the description
as a link only when `toSafeHttpUrl` accepts it; any other value
(including `javascript:`) falls through to being shown as plain,
auto-escaped text.

**Test:** `toSafeHttpUrl accepts only HTTP(S) URLs` in
`tests/payment-requests.test.ts` covers `javascript:`, `data:`,
`vbscript:`, non-URLs and normal URLs.

## Review notes

- **No HTML-injection sinks.** There is no `{@html}`, `innerHTML`,
  `eval`, `document.write` or `new Function` in `src/`. Svelte
  auto-escapes interpolated text.
- **`debtorHomepage`.** Unlike the creditors UI, this app does not
  render another party's `debtorHomepage` as a link. It appears only in
  `UpdateConfigAction.svelte`, as a field where the issuer edits *their
  own* homepage, and it is reconstructed as `https://<value>`. So it is
  not an untrusted-`href` sink here. (The corresponding creditors-UI
  issue, where a currency's homepage *is* rendered as a link, is fixed
  in that repository's pull request.)
- **Other `href` bindings** use either constant app URLs
  (`INSTALL_WALLET_URL`, `REGISTER_ISSUER_URL`) or `blob:`/`data:`
  download URLs the app itself builds, not untrusted input.
- **OAuth/token handling** is shared with the creditors UI: the access
  token is not stored in `localStorage` (only a token hash), PKCE uses
  S256, and the callback `state` parameter is verified.

## Tests

Full suite: 36 passed, 5 skipped (Jest). `svelte-check`: 0 errors. The
new helper test covers the dangerous schemes that the fix rejects.
