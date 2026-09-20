#!/bin/sh
# Prepares the database, then hands over to the Next.js server.
# Credentials are never baked into the image - everything comes from the
# environment at run time.
set -e

PROVIDER="${DATABASE_PROVIDER:-sqlite}"

if [ -z "${DATABASE_URL}" ]; then
  echo "DATABASE_URL is not set. Copy .env.example to .env and try again." >&2
  exit 1
fi

# prisma/schema.prisma is generated, never shipped. Build it from the template
# for the configured engine, then refresh the client to match.
node scripts/set-db-provider.mjs
npx prisma generate

echo "> applying schema to ${PROVIDER} database"
npx prisma db push --skip-generate

# Seed only an empty archive, so restarts never overwrite real records.
if [ "${SEED_ON_START:-auto}" != "false" ]; then
  COUNT=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.archiveEntry.count().then(n=>{console.log(n);return p.\$disconnect()}).catch(()=>{console.log(-1)})")
  if [ "${COUNT}" = "0" ]; then
    echo "> empty archive, seeding sample records"
    npx prisma db seed
  fi
fi

exec "$@"
