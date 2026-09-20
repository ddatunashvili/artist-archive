#!/usr/bin/env node
/**
 * Rewrites the `provider` line of prisma/schema.prisma from DATABASE_PROVIDER.
 *
 * Prisma requires a literal provider in the schema, so switching from the
 * local SQLite demo to a server database is a one-line patch rather than a
 * second schema file. Connection details stay in DATABASE_URL.
 *
 *   DATABASE_PROVIDER=postgresql npm run db:provider
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED = ["sqlite", "postgresql", "mysql", "sqlserver", "cockroachdb"];

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(root, "prisma/schema.prisma");

// Minimal .env reader: no dependency, and it never prints values.
function readEnvFile(path) {
  try {
    const out = {};
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      out[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

const fromFile = readEnvFile(resolve(root, ".env"));
const provider = (process.env.DATABASE_PROVIDER || fromFile.DATABASE_PROVIDER || "sqlite").trim();

if (!SUPPORTED.includes(provider)) {
  console.error(
    `DATABASE_PROVIDER="${provider}" is not supported. Use one of: ${SUPPORTED.join(", ")}`,
  );
  process.exit(1);
}

const schema = readFileSync(schemaPath, "utf8");
const patched = schema.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]+"/,
  `$1"${provider}"`,
);

if (patched === schema) {
  console.log(`prisma/schema.prisma already uses provider "${provider}".`);
} else {
  writeFileSync(schemaPath, patched);
  console.log(`prisma/schema.prisma provider set to "${provider}".`);
  console.log("Next: npm run db:generate && npm run db:migrate");
}
