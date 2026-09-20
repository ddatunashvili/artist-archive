# Data model and databases

## Models

### `Artist`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String` | cuid |
| `name` | `String` | |
| `slug` | `String` | unique, derived from the name; used in URLs |
| `birthYear`, `deathYear` | `Int?` | |
| `nationality`, `basedIn` | `String?` | |
| `website`, `bio` | `String?` | |

### `ArchiveEntry`

One line of a CV.

| Field | Type | Notes |
| --- | --- | --- |
| `type` | `String` | `exhibition`, `publication`, `award`, `residency`, `education`, `collection`, `screening`, `talk`, `performance`, `other` |
| `title` | `String` | |
| `role` | `String?` | `solo`, `group`, `curator`, `author`, `editor`, `speaker` |
| `year` | `Int` | start year; indexed |
| `endYear` | `Int?` | for ranges such as residencies |
| `venue`, `city`, `country` | `String?` | indexed for filters |
| `description`, `url` | `String?` | |
| `status` | `String` | `draft`, `in_review`, `published`, `rejected` |
| `confidence` | `Float?` | 0–1 |
| `sourceText` | `String?` | the verbatim CV line |
| `extractedBy` | `String?` | `mock`, `openai`, `openrouter`, `manual` |
| `reviewedBy`, `reviewedAt`, `reviewNote` | | sign-off trail |

Deleting an artist cascades to their entries.

### Why strings, not enums

SQLite has no native enum, and Prisma enums are not portable across every supported engine. The
vocabularies live in `src/lib/schema.ts` and are enforced by Zod at every boundary, so adding a
record type is a one-line change with no migration.

## Local demo: SQLite

```dotenv
DATABASE_PROVIDER="sqlite"
DATABASE_URL="file:./dev.db"
```

```bash
npm run setup     # generate + db push + seed
```

`dev.db` is git-ignored. Delete it and run `npm run setup` again for a clean archive.

## Moving to a server database

The models use no SQLite-specific features. To switch:

1. Set both variables in `.env` (never in code, never in `docker-compose.yml`):

   ```dotenv
   DATABASE_PROVIDER="postgresql"
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/artist_archive?schema=public"
   ```

2. Apply the provider to the schema and migrate:

   ```bash
   npm run db:provider
   npm run db:generate
   npm run db:migrate
   ```

`scripts/set-db-provider.mjs` rewrites only the `provider` line of `prisma/schema.prisma`, because
Prisma requires a literal there. Supported: `sqlite`, `postgresql`, `mysql`, `sqlserver`,
`cockroachdb`.

In Docker, set `DOCKER_DATABASE_URL` in `.env` instead of `DATABASE_URL` — the compose file maps it
into the container so the host and the container can point at different databases. A commented
PostgreSQL service is included in `docker-compose.yml`.

## Notes when leaving SQLite

- Free-text search uses `contains` with no `mode` flag, so it stays valid on every engine but is
  case-sensitive on SQLite. On PostgreSQL, add `mode: "insensitive"` in `buildWhere`
  (`src/lib/queries.ts`).
- Use `prisma migrate` rather than `db push` once the data matters.
- Existing indexes cover the catalogue filters (`status`, `type`, `year`, `city`, `country`).
