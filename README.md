# aeitos archive

A small, complete prototype of an AI-assisted digital archive for artists, built for **aeitos**.

Paste an unstructured artist CV, let an AI provider propose structured records, validate them with
Zod, **review and correct them by hand**, and only then publish them into a filterable catalogue.

Every record keeps the CV line it came from, the extractor that produced it, a confidence score and
the name of the person who approved it.

---

## The idea

An artist CV is a list of experiences written for a human reader:

```
2019 — Residency at Villa Medici, Rome
2020 — Group exhibition at Palais de Tokyo, Paris
```

Each line becomes one archive record, extracted and validated:

```json
{
  "type": "residency",
  "title": "Residency at Villa Medici",
  "year": 2019,
  "venue": "Villa Medici",
  "city": "Rome",
  "country": "Italy",
  "confidence": 0.87,
  "sourceText": "2019 — Residency at Villa Medici, Rome",
  "extractedBy": "mock"
}
```

The country was not in the CV — it is resolved from the city, and only for
cities the lookup knows. Nothing is stored until a person has checked it.

[`docs/BRIEF.md`](docs/BRIEF.md) walks through the whole example, the field
list and the reasoning behind it.

---

## What it does

**Public**

| Page | Purpose |
| --- | --- |
| `/` | Visual catalogue — card grid or dense index, filterable by type, year, location (country / city), artist and free text |
| `/entries/[id]` | Detail page for one record: images, description, every field, provenance, source CV line |
| `/artists` | Index of every artist with published records |
| `/artists/[slug]` | A single artist archive, grouped back into CV sections |
| `/about` | How a record gets in, and the current state of the archive |

**Admin** (signed in — see [Admin panel](#admin-panel))

| Page | Purpose |
| --- | --- |
| `/admin` | Dashboard and analytics |
| `/admin/entries` | Every record, any status: search, edit, create, delete |
| `/admin/artists` | Artist CRUD |
| `/admin/review` | Publish / reject queue |
| `/admin/import` | Upload or paste a CV → AI extraction → human review → save |

JSON API: `GET /api/entries` and `GET /api/entries/[id]` are public. Everything that writes —
`POST /api/extract`, `POST /api/entries`, all of `/api/admin/*` — needs an admin session.

---

## Requirements

- **Node.js 24** (`.nvmrc` is provided — `nvm use`)
- npm 10+
- Docker only if you want the container route

---

## Quick start (no Docker)

```bash
git clone <this-repo> artist-archive
cd artist-archive

cp .env.example .env      # Windows: copy .env.example .env
npm install
npm run setup             # prisma generate + db push + seed
npm run dev
```

Open <http://localhost:3000>. The archive already contains 15 artists and 124 records across four
statuses, so the catalogue, the review queue and the dashboard all have something in them
immediately.

The default `AI_PROVIDER="mock"` is a **real rule-based CV parser**, not a stub — it needs no API
key, so the full import → review → publish flow works out of the box. On `/import`, press
**Load sample CV** to try it.

---

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

Open <http://localhost:3000>.

The image is Node 24. On start, the entrypoint applies the schema and seeds the sample archive
**only if the database is empty**, so restarts never overwrite real records. The SQLite file lives
on the `archive-data` volume.

Set `SEED_ON_START=false` in `.env` to skip seeding entirely.

---

## Admin panel

Anyone can try it. Two ways in at `/admin`:

```
demo@aeitos.com
aeitos-demo-2026
```

The sign-in form **pre-fills that account**, so it is one click. Or
[register](https://archive.renode.space/admin/register) for your own — sign-up is open.

Dashboard with analytics, full CRUD over records and artists, the review queue and CV import all
live here. The public site is read-only.

### Roles

| Role | Can |
| --- | --- |
| `editor` — the demo account and every registration | Import, review, publish, create and edit records and artists |
| `admin` — the `ADMIN_EMAIL` account | All of the above, plus deleting an artist with its records, and managing accounts |

Keeping sign-up at `editor` is what makes open registration safe: a visitor can exercise the whole
workflow without being able to empty a shared archive.

Passwords are stored as PBKDF2-SHA256 with a per-user salt — no native dependency, so the app still
installs on a host that only runs `npm install`.

See [`docs/ADMIN.md`](docs/ADMIN.md) for what the panel does and exactly what the lock protects.

---

## Reading a CV file

Artists send CVs as PDFs, Word files, or a photograph of a printed page. `/admin/import` takes any
of them by drag-and-drop:

| Input | Reader |
| --- | --- |
| `.txt`, `.md` | read directly |
| `.pdf` | `unpdf` (pdf.js) text layer |
| `.docx` | `mammoth` |
| `.png`, `.jpg`, `.webp` | `tesseract.js` OCR |

Every reader is pure JavaScript or WASM — a native module would need a compiler on the host, and
the deployment only runs `npm install && npm start`.

The file is never written to disk. Its text lands in the textarea first, so you can see exactly what
was read before a model is asked to interpret it — which matters most with OCR, where a bad scan is
obvious in the text long before it is obvious in the records.

A scanned PDF has no text layer and rendering its pages would need a native canvas, so the app says
so and asks for a page as an image instead, rather than half-working.

## SEO

- Per-page `title`, `description` and canonical URL, all resolved from `APP_URL`
- Open Graph and Twitter card tags, with the aeitos wordmark as the share image
- JSON-LD: `Organization` and `WebSite` sitewide, `CreativeWork` per record, `Person` per artist
- `sitemap.xml` generated from published records only
- `robots.txt` allowing the catalogue and disallowing `/admin` and `/api`
- Unpublished records are `noindex, nofollow` — they exist at a URL, but never in an index

---

## Production

Deployed at **https://archive.renode.space**, backed by MySQL and the OpenRouter extractor.
Values live in `.env.prod`, which is git-ignored and excluded from the Docker build context.

```bash
npm run db:deploy         # apply migrations to the MySQL database
npm run start:prod        # builds if needed, then serves with .env.prod
```

Or: `docker compose --env-file .env.prod up --build`.

On a hosting panel that only runs `npm install && npm start`, nothing else is needed: `npm start`
binds the port the host allocates (`SERVER_PORT`, then `PORT`), reconciles the Prisma client with
`DATABASE_PROVIDER`, and builds once if `.next/` is missing.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the migration workflow, the MySQL column types
and the go-live checklist.

---

## Configuration

All configuration is environment-based. See [`.env.example`](.env.example) for the full list.

### AI provider

```dotenv
AI_PROVIDER="mock"        # mock | openai | openrouter
```

| Provider | Needs | Notes |
| --- | --- | --- |
| `mock` | nothing | Deterministic offline parser. Default. |
| `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` | Chat Completions, JSON mode |
| `openrouter` | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Same API surface, plus attribution headers |

Adding a provider means adding one file in `src/lib/ai/` and one case in `src/lib/ai/index.ts`.
Nothing else in the app knows which model produced a record.

### Database

The local demo runs on SQLite with zero setup; production runs on MySQL. Record types and statuses
are plain strings validated by Zod rather than database enums, so the same models work on every
engine. Moving between them is two variables:

```dotenv
DATABASE_PROVIDER="mysql"
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/artist_archive"
```

then:

```bash
npm run db:deploy      # regenerates the schema, then applies prisma/migrations
```

`postgresql`, `mysql`, `sqlserver` and `cockroachdb` are supported.

The data model lives in `prisma/schema.template.prisma`. `prisma/schema.prisma` is **generated**
from it for the configured provider and is git-ignored, so switching between the SQLite demo and a
MySQL server never shows up as a modified file. Generation runs automatically on `postinstall`,
`dev`, `build` and every `db:*` script — edit the template, never the generated file.

Details, including the MySQL column types the script manages, are in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Security

- **No credentials in the repo.** `.gitignore` ignores `.env` and `.env.*`, allowing back only
  `.env.example`; `.dockerignore` excludes every `.env*` file, so no secret enters an image layer.
  Nothing is hardcoded in the source or in `docker-compose.yml`.
- **If a key or password has ever been pasted into a chat, an issue or a prompt, rotate it.** Treat
  it as public from that moment, whatever was done with it afterwards.
- **Registration is open on purpose**, so the prototype can be tried. New accounts are `editor` and
  cannot delete an artist or manage accounts. Set `ALLOW_REGISTRATION="false"` to close it.
- **Never paste a real password into an AI prompt or a chat window.** Put it in your local `.env`
  file. The app reads keys from `process.env` on the server only.
- API keys are never sent to the browser. `/api/extract` reports the provider name and model, never
  the key.
- Provider error bodies are not echoed to the client — only a status and a short hint.
- CV input is length-capped (`MAX_CV_CHARS`) and every payload is re-validated server-side, so a
  tampered request cannot write fields the schema does not allow.

The admin panel has a **published demo account** and **open registration**, both deliberate so the
prototype can be tried. That is right for a review URL and wrong for real material: set
`ALLOW_REGISTRATION="false"` and `DEMO_ADMIN="false"`, and read the limits in
[`docs/ADMIN.md`](docs/ADMIN.md).

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run setup` | generate + db push + seed, in one go |
| `npm run db:seed` | Re-seed the sample archive (idempotent) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:provider` | Apply `DATABASE_PROVIDER` to the Prisma schema |
| `npm run db:deploy` | Provider + generate + `migrate deploy` (servers) |
| `npm start` | Production server: binds SERVER_PORT/PORT, builds if needed |
| `npm run start:prod` | Same, loading `.env.prod` |
| `npm run typecheck` | `tsc --noEmit` |

---

## Project layout

```
prisma/
  schema.template.prisma Artist + ArchiveEntry models - edit this one
  schema.prisma          Generated per provider, git-ignored
  migrations/            MySQL migrations, applied with db:deploy
  seed.ts                Demo archive: 15 artists, 124 records
src/
  middleware.ts          What is public and what needs a session
  app/
    (public)             Catalogue, artists, records, about
    admin/               Dashboard, CRUD, review queue, import
    api/                 Public read API + /api/admin write API
    sitemap.ts           Published records only
    robots.ts
  components/            Filters, tables, charts, forms, workflows
  lib/
    ai/                  Provider abstraction: mock | openai | openrouter
    schema.ts            Zod contract shared by extractor, review UI and API
    queries.ts           Catalogue and admin reads
    analytics.ts         Dashboard aggregates
    auth.ts              Signed-cookie admin session
    site.ts              SEO and brand constants
    db.ts, env.ts        Prisma client, environment access
scripts/
  set-db-provider.mjs    Generates schema.prisma from the template
docs/                    Architecture, review, database, AI, deployment, admin
public/
  aeitos-logo.png        Brand wordmark
  sample-cv.txt          Sample CV for the import demo
```

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the pieces fit, and why
- [`docs/REVIEW_WORKFLOW.md`](docs/REVIEW_WORKFLOW.md) — the human review steps in detail
- [`docs/DATABASE.md`](docs/DATABASE.md) — data model and moving off SQLite
- [`docs/AI_PROVIDERS.md`](docs/AI_PROVIDERS.md) — provider abstraction and adding a new one
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production: MySQL, migrations, `.env.prod`, go-live checklist
- [`docs/ADMIN.md`](docs/ADMIN.md) — admin panel, analytics and the authentication model
- [`docs/BRIEF.md`](docs/BRIEF.md) — the original brief answered: worked example, data structure, what is automated

---

## Known limits

This is a prototype, deliberately small:

- Two roles only, and no password reset or email verification.
- Free-text search uses `contains`, which is case-sensitive on SQLite.
- No pagination — the catalogue caps at 500 records per view.
- No image or document storage; records are textual.
- `db push` is used for the local SQLite demo; servers use the committed migrations via
  `npm run db:deploy`.
