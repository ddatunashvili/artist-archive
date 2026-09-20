# Deployment

Production target: **https://archive.renode.space**
Database: **MySQL / MariaDB 10.6** — host, schema and credentials live in `.env.prod` only
Extractor: **OpenRouter**

## Environment files

| File | Committed | Purpose |
| --- | --- | --- |
| `.env.example` | yes | Placeholders only. The template. |
| `.env` | no | Local development. SQLite + `mock` extractor. |
| `.env.prod` | no | Production values: MySQL, OpenRouter key, public domain. |

`.gitignore` ignores `.env` and `.env.*`, then allows `.env.example` back. `.dockerignore` excludes
every `.env*` file, so **no secret ever enters a Docker image layer**. Verify at any time:

```bash
git check-ignore -v .env.prod     # must print a matching rule
git ls-files | grep -i env        # must show only .env.example and src/lib/env.ts
```

## Running with production settings

Node 24 loads the file directly — there is no secrets plugin and nothing is read from the repo:

```bash
npm run build
npm run start:prod        # node --env-file=.env.prod next start
```

With Docker:

```bash
docker compose --env-file .env.prod up --build
```

`.env.prod` sets `ENV_FILE=".env.prod"` so Compose loads that same file into the container instead
of `.env`.

Put a TLS-terminating reverse proxy in front of port 3000 for `archive.renode.space`.

## Migrations

The committed migration in `prisma/migrations/` is **MySQL SQL**, matching
`prisma/migrations/migration_lock.toml`.

```bash
npm run db:deploy      # set-db-provider + generate + migrate deploy
```

`migrate deploy` applies pending migrations and records them in `_prisma_migrations`. It never
resets data and never needs a shadow database — which matters here, because the hosting account
cannot create the temporary database that `prisma migrate dev` requires.

The data model is edited in `prisma/schema.template.prisma`; `prisma/schema.prisma` is generated
from it per provider and is git-ignored.

To add a migration later, generate the SQL offline and deploy it:

```bash
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_your_change
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/<new folder>/migration.sql
npm run db:deploy
```

### Applied so far

| Migration | Contents |
| --- | --- |
| `20260921000000_init` | `Artist`, `ArchiveEntry`, all catalogue indexes |

## MySQL column types

MySQL maps a Prisma `String` to `VARCHAR(191)`, which is narrower than several limits in the Zod
contract — a 3000-character bio, a 2000-character description, a 1000-character source line. Left
alone, the first long CV entry would fail on insert.

`scripts/set-db-provider.mjs` therefore manages native types as well as the provider:

| Column | MySQL type |
| --- | --- |
| `Artist.name` | `VARCHAR(200)` |
| `Artist.website`, `ArchiveEntry.url` | `VARCHAR(500)` |
| `ArchiveEntry.title` | `VARCHAR(300)` |
| `ArchiveEntry.venue` | `VARCHAR(200)` |
| `Artist.bio`, `ArchiveEntry.description`, `sourceText`, `reviewNote` | `TEXT` |

Switching back to SQLite strips them again, because `@db.*` attributes are provider-specific and a
SQLite schema carrying MySQL types fails validation. The round trip is lossless:
`DATABASE_PROVIDER=sqlite npm run db:provider` then `DATABASE_PROVIDER=mysql npm run db:provider`
restores exactly the same schema.

`Artist.name` is indexed at `VARCHAR(200)` — 800 bytes in utf8mb4, inside the 3072-byte index limit
of MariaDB 10.6 with the DYNAMIC row format. Check `@@innodb_default_row_format` on an older server.

## Seeding production

The sample archive is **fictional demo data**. `.env.prod` sets `SEED_ON_START="false"` so a
container restart never writes it into the production database.

To load it deliberately:

```bash
node --env-file=.env.prod --import tsx prisma/seed.ts
```

## Before going live

- [ ] Rotate the OpenRouter key and the MySQL password if either has ever been pasted into a chat,
      an issue or a prompt.
- [ ] Replace the demo admin account. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are published in the
      README and pre-filled on the sign-in form; anyone who can reach the origin can publish.
- [ ] Set a unique `ADMIN_SESSION_SECRET`, and rotate it to sign every open session out.
- [ ] Restrict the database user to the application schema only.
- [ ] Set a real `MAX_CV_CHARS` budget for the OpenRouter account.
- [ ] Take a backup before the first real import.
