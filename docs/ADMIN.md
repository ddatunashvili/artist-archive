# Admin panel

Everything that changes the archive lives behind `/admin`. The public site is read-only.

## Getting in

Three kinds of account, all optional to each other:

| Account | Source | Role | Pre-filled |
| --- | --- | --- | --- |
| demo | built in, `DEMO_ADMIN` | editor | yes |
| owner | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | admin | never |
| registered | `/admin/register` | editor | n/a |

```
https://archive.renode.space/admin
demo@aeitos.com
aeitos-demo-2026
```

The form pre-fills the demo pair so a reviewer reaches the dashboard in one click, and registration
is open so anyone can make their own account instead. Both are deliberate: this is a prototype that
is meant to be tried.

The owner account exists so the archive can always be administered even if the user table is empty
or the database is unreachable — it is checked without a query.

```dotenv
ADMIN_EMAIL="you@yourdomain.com"
ADMIN_PASSWORD="a long random passphrase"
ADMIN_SESSION_SECRET="64 hex characters"   # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
DEMO_ADMIN="false"          # switch off the published account
ALLOW_REGISTRATION="false"  # close sign-up
```

## Roles

`editor` can import, review, publish, and create or edit records and artists. `admin` adds the two
things that cannot be undone: deleting an artist (which cascades to every one of their records) and
managing accounts.

Every registration is an editor. Promotion is a deliberate act by an admin on `/admin/users`, so an
open sign-up form can never hand a visitor the ability to empty the archive.

## Passwords

PBKDF2-SHA256, 210,000 iterations, a 16-byte random salt per user, stored self-describing as
`pbkdf2$sha256$<iterations>$<salt>$<hash>` so the cost can be raised later without invalidating
existing hashes. bcrypt and argon2 are native modules and the deployment host only runs
`npm install && npm start`; PBKDF2 is available through Web Crypto everywhere this app runs.

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
| `/admin/users` | Registered accounts and their roles — admin only |

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

`src/lib/auth.ts` holds the session cookie and the environment accounts, and imports no database —
that is what lets the same code run in the edge middleware and in Node route handlers. Registered
accounts are checked in `src/lib/users.ts`, which does use Prisma.

The cookie is signed with HMAC-SHA-256 via Web Crypto: no dependency, no session store. The role
travels inside the signed payload, so the middleware needs no query to authorise a request.

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
| `/admin/login`, `/admin/register` | public |
| `POST /api/admin/session`, `POST /api/admin/register` | public |
| `/admin/*` | session required (redirects to sign-in) |
| `/api/admin/*` | session required (401, never a redirect) |
| Any write to `/api/entries/*` | session required |
| `DELETE /api/admin/artists/[id]`, all of `/api/admin/users/*` | admin role required (403 otherwise) |
| `POST /api/extract` | session required — it spends money at the AI provider |

Unauthenticated API calls get a 401 rather than a redirect, because a redirect looks like success
to `fetch()`.

## What this is not

Enough to keep a prototype closed and let people try it. Not enough for real use:

- No email verification and no password reset.
- No rate limiting on sign-in or registration.
- No audit log beyond the review fields already on each record.
- The two environment accounts are compared as plain strings — they are configuration, not rows,
  and there is nothing to salt them against. Registered accounts are hashed.

Before this is more than a prototype: email verification, password reset, and rate limiting on
`/api/admin/session` and `/api/admin/register`.
