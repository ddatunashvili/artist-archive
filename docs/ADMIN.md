# Admin panel

Everything that changes the archive lives behind `/admin`. The public site is read-only.

## Demo credentials

```
https://archive.renode.space/admin
admin@aeitos.com
aeitos-demo-2026
```

The sign-in form **pre-fills these**, so a reviewer reaches the dashboard in one click. That is a
deliberate prototype affordance, and it is exactly as insecure as it sounds.

The prefill is not hardcoded into the form: `usingDemoCredentials()` compares the configured values
against the published demo pair. Change `ADMIN_EMAIL` or `ADMIN_PASSWORD` in `.env` and the prefill,
the hint box and the "demo account" badge all disappear on their own.

```dotenv
ADMIN_EMAIL="you@yourdomain.com"
ADMIN_PASSWORD="a long random passphrase"
ADMIN_SESSION_SECRET="64 hex characters"   # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Pages

| Page | What it does |
| --- | --- |
| `/admin` | Dashboard: totals, year histogram, breakdowns by type, status, country, venue and extractor, field coverage, recent additions |
| `/admin/entries` | Every record at any status. Search, filter by status, edit, delete |
| `/admin/entries/new` | Create a record by hand |
| `/admin/entries/[id]` | Edit every field, change status, delete |
| `/admin/artists` | Artist list with record counts |
| `/admin/artists/new`, `/admin/artists/[id]` | Create and edit artists |
| `/admin/review` | The review queue: publish or reject, with a reviewer name |
| `/admin/import` | Paste a CV, extract, review, save |

## Analytics

The dashboard is built from `getDashboard()` in `src/lib/analytics.ts` — a handful of indexed
`groupBy` and `count` queries, never a full table read. The charts are plain divs; a charting
library would have been the largest dependency in the project.

It reports:

- totals by status, and published share of the archive
- record distribution by year, type, country and venue
- which extractor produced the records, and the average confidence
- how many records fall below 70% confidence
- field coverage: the share of records carrying a country, a source line and a link
- review throughput over the last 30 days

## How the lock works

`src/lib/auth.ts` — one operator account, credentials from the environment, and a stateless
session cookie signed with HMAC-SHA-256 via Web Crypto. No dependency and no session store, so the
same code runs in the edge middleware and in Node route handlers.

- The cookie is `httpOnly`, `sameSite=lax`, and `secure` in production.
- It expires after 12 hours; rotating `ADMIN_SESSION_SECRET` invalidates every open session.
- Credential and signature comparisons are length-independent, so neither leaks a timing signal.
- Sign-in answers "Incorrect email or password" for both failure cases, so the endpoint cannot be
  used to confirm that an account exists.
- `?next=` only accepts same-site paths, so it cannot be turned into an open redirect.

`src/middleware.ts` decides what is open:

| Surface | Access |
| --- | --- |
| Catalogue, artist and record pages | public |
| `GET /api/entries`, `GET /api/entries/[id]` | public — the archive's JSON API |
| `/admin/*` | session required (redirects to sign-in) |
| `/api/admin/*` | session required (401, never a redirect) |
| Any write to `/api/entries/*` | session required |
| `POST /api/extract` | session required — it spends money at the AI provider |

Unauthenticated API calls get a 401 rather than a redirect, because a redirect looks like success
to `fetch()`.

## What this is not

A single shared account is enough to keep a prototype closed. It is not enough for real use:

- No individual accounts, so "reviewed by" is a typed name, not an identity.
- No roles — whoever signs in can publish and delete.
- No rate limiting on sign-in.
- No audit log beyond the review fields already on each record.
- Passwords are compared as plain strings from the environment, not hashed. There is no user table
  to hash them into.

Before this is more than a prototype: real accounts, hashed passwords, a role for "can publish",
and rate limiting on `/api/admin/session`.
