# Artist Archive

A small, complete prototype of an AI-assisted digital archive for artists.

Paste an unstructured artist CV, let an AI provider propose structured records, validate them with
Zod, **review and correct them by hand**, and only then publish them into a filterable catalogue.

Every record keeps the CV line it came from, the extractor that produced it, a confidence score and
the name of the person who approved it.

---

## What it does

| Page | Purpose |
| --- | --- |
| `/` | Catalogue of published records, filterable by type, year, location (country / city), artist and free text |
| `/entries/[id]` | Detail page for one record: fields, provenance, source CV line |
| `/artists/[slug]` | A single artist's archive, grouped back into CV sections |
| `/import` | Paste CV text → AI extraction → human review → save |
| `/review` | Queue of records awaiting a publish / reject decision |
| `/about` | How a record gets in, and the current state of the archive |

JSON API: `GET /api/entries` (same filters as the UI), `POST /api/extract`, `POST /api/entries`,
`GET|PATCH|DELETE /api/entries/[id]`, `GET /api/extract` (which provider is active).

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

Open <http://localhost:3000>. The archive already contains three sample artists and 23 records, so
the catalogue and the review queue both have something in them immediately.

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

The local demo runs on SQLite with zero setup. The schema contains no SQLite-specific types — enum
values are plain strings validated by Zod — so it moves to a server database by changing two
variables:

```dotenv
DATABASE_PROVIDER="postgresql"
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/artist_archive?schema=public"
```

then:

```bash
npm run db:provider    # rewrites the provider line in prisma/schema.prisma
npm run db:generate
npm run db:migrate
```

`postgresql`, `mysql`, `sqlserver` and `cockroachdb` are supported.

---

## Security

- **No credentials in the repo.** `.env` is git-ignored; only `.env.example` with placeholders is
  committed. Nothing is hardcoded in the source or in `docker-compose.yml`.
- **Never paste a real password into an AI prompt or a chat window.** Put it in your local `.env`
  file. The app reads keys from `process.env` on the server only.
- API keys are never sent to the browser. `/api/extract` reports the provider name and model, never
  the key.
- Provider error bodies are not echoed to the client — only a status and a short hint.
- CV input is length-capped (`MAX_CV_CHARS`) and every payload is re-validated server-side, so a
  tampered request cannot write fields the schema does not allow.

This prototype has **no authentication**. Anyone who can reach the port can publish. Put it behind
auth before exposing it beyond localhost.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run setup` | generate + db push + seed, in one go |
| `npm run db:seed` | Re-seed the sample archive (idempotent) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:provider` | Apply `DATABASE_PROVIDER` to the Prisma schema |
| `npm run typecheck` | `tsc --noEmit` |

---

## Project layout

```
prisma/
  schema.prisma          Artist + ArchiveEntry models
  seed.ts                Sample archive (3 artists, 23 records)
src/
  app/                   Pages and API routes (Next.js App Router)
  components/            Filters, catalogue table, import workflow, review queue
  lib/
    ai/                  Provider abstraction: mock | openai | openrouter
    schema.ts            Zod contract shared by extractor, review UI and API
    queries.ts           Catalogue reads and filter options
    db.ts, env.ts        Prisma client, environment access
scripts/
  set-db-provider.mjs    Switch the Prisma datasource from an env var
docs/                    Architecture, review workflow, deployment notes
public/sample-cv.txt     Sample CV for the import demo
```

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the pieces fit, and why
- [`docs/REVIEW_WORKFLOW.md`](docs/REVIEW_WORKFLOW.md) — the human review steps in detail
- [`docs/DATABASE.md`](docs/DATABASE.md) — data model and moving off SQLite
- [`docs/AI_PROVIDERS.md`](docs/AI_PROVIDERS.md) — provider abstraction and adding a new one

---

## Known limits

This is a prototype, deliberately small:

- No authentication or user accounts.
- Free-text search uses `contains`, which is case-sensitive on SQLite.
- No pagination — the catalogue caps at 500 records per view.
- No image or document storage; records are textual.
- `db push` is used for the local demo; use `db:migrate` for anything real.
