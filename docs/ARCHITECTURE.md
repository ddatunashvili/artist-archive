# Architecture

## Shape

One Next.js 15 App Router application. Server components read the database directly; two small
client components handle the interactive parts (import workflow, review queue). There is no
separate backend service and no state management library.

```
CV text
  │
  ▼
POST /api/extract ──► Extractor (mock | openai | openrouter)
  │                      │
  │                      ▼
  │                 Zod: ExtractionResultSchema      ← first gate
  ▼
Review UI (/import)  ← human corrects, drops, signs off   ← second gate
  │
  ▼
POST /api/entries ──► Zod: PublishRequestSchema      ← third gate
  │
  ├── status "in_review" ──► /review queue ──► PATCH /api/entries/[id]  ← fourth gate
  │
  └── status "published" ──► /  catalogue
```

Nothing is written to the database before a human has seen it. `POST /api/extract` is read-only by
design.

## Layers

| Layer | Files | Responsibility |
| --- | --- | --- |
| Contract | `src/lib/schema.ts` | Zod schemas and the type/status vocabularies. Imported by the extractor, the review UI and the API, so all three agree on what a record is. |
| AI | `src/lib/ai/*` | Turning text into candidate records. Swappable, no database access. |
| Data | `src/lib/db.ts`, `src/lib/queries.ts` | Prisma client and every read the catalogue needs. |
| HTTP | `src/app/api/*` | Validation, transactions, status transitions. |
| UI | `src/app/*`, `src/components/*` | Rendering. No business rules beyond form state. |

## Decisions

**Zod as the single contract.** The same schema validates the model's reply, the reviewer's
corrections in the browser, and the request that reaches the API. A model that invents a field or a
malformed year is rejected at the first gate rather than three layers deep.

The schemas coerce rather than merely reject where it is safe to do so: `"1998"`, `1998` and
`"1998–2000"` all normalise to a year, `"n/a"` becomes absent, a bare domain becomes a URL. That is
what makes real CV text usable without the reviewer retyping it.

**Filters in the URL.** The catalogue is a plain GET form. Every filtered view is linkable and
citable, works without JavaScript, and needs no client state.

**Strings instead of database enums.** `type` and `status` are `String` columns validated by Zod.
SQLite has no enum type, and a migration that adds an entry type should not require a schema change
on every supported engine.

**Provenance on every row.** `sourceText`, `extractedBy`, `confidence`, `reviewedBy`, `reviewedAt`
and `reviewNote` are columns, not an audit log bolted on later. An archive whose records cannot be
traced back to their source is not an archive.

**No authentication.** Out of scope for the prototype, and flagged in the README rather than half
implemented.

## Rendering

All pages that read the database are `dynamic = "force-dynamic"`, so the catalogue reflects a
publish immediately. For a public deployment, caching the catalogue with tag-based revalidation on
publish would be the first change to make.
