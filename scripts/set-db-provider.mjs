#!/usr/bin/env node
/**
 * Generates prisma/schema.prisma from prisma/schema.template.prisma.
 *
 * Prisma requires a literal datasource provider, so a project that targets
 * both the SQLite demo and a MySQL server has to rewrite its schema. Doing
 * that to a tracked file means `git status` is dirty whenever anyone runs the
 * app locally, so the template is tracked and the schema is generated and
 * git-ignored instead.
 *
 * Two jobs:
 *
 * 1. Set the `provider` from DATABASE_PROVIDER. Connection details stay in
 *    DATABASE_URL and are never read here.
 *
 * 2. Add provider-specific column types. MySQL maps a Prisma `String` to
 *    VARCHAR(191), which is shorter than several limits in the Zod contract
 *    (a 3000-character bio, a 2000-character description). Without this the
 *    first long CV entry fails on insert. SQLite and PostgreSQL both store
 *    unbounded TEXT, so they need no annotations - and carrying MySQL ones
 *    into a SQLite schema is a validation error, hence the stripping.
 *
 *   DATABASE_PROVIDER=mysql npm run db:provider
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED = ["sqlite", "postgresql", "mysql", "sqlserver", "cockroachdb"];

/**
 * Model.field -> MySQL native type. Widths mirror the `max()` values in
 * src/lib/schema.ts; anything above a few hundred characters becomes TEXT.
 * Indexed columns stay at or below 768 bytes (utf8mb4, DYNAMIC row format).
 */
const MYSQL_NATIVE_TYPES = {
  "Artist.name": "@db.VarChar(200)",
  "Artist.website": "@db.VarChar(500)",
  "Artist.bio": "@db.Text",
  "ArchiveEntry.title": "@db.VarChar(300)",
  "ArchiveEntry.venue": "@db.VarChar(200)",
  "ArchiveEntry.description": "@db.Text",
  "ArchiveEntry.url": "@db.VarChar(500)",
  "ArchiveEntry.sourceText": "@db.Text",
  "ArchiveEntry.reviewNote": "@db.Text",
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = resolve(root, "prisma/schema.template.prisma");
const schemaPath = resolve(root, "prisma/schema.prisma");

/** Minimal .env reader: no dependency, and it never prints values. */
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

function setProvider(schema, provider) {
  return schema.replace(
    /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]+"/,
    `$1"${provider}"`,
  );
}

/** Removes every `@db.*` attribute so the next provider starts from clean. */
function stripNativeTypes(schema) {
  return schema.replace(/[ \t]+@db\.\w+(\([^)]*\))?/g, "");
}

/** Appends the configured `@db.*` attribute to each listed field. */
function applyNativeTypes(schema, types) {
  let out = schema;

  for (const [key, attribute] of Object.entries(types)) {
    const [model, field] = key.split(".");
    const block = new RegExp(`(model\\s+${model}\\s*\\{)([\\s\\S]*?)(\\n\\})`);

    out = out.replace(block, (whole, open, body, close) => {
      const line = new RegExp(`^([ \\t]*${field}\\s+\\S+)(.*)$`, "m");
      if (!line.test(body)) {
        console.warn(`warning: ${model}.${field} not found in the schema, skipping`);
        return whole;
      }
      return open + body.replace(line, `$1$2 ${attribute}`) + close;
    });
  }

  return out;
}

const fromFile = readEnvFile(resolve(root, ".env"));
const provider = (process.env.DATABASE_PROVIDER || fromFile.DATABASE_PROVIDER || "sqlite").trim();

if (!SUPPORTED.includes(provider)) {
  console.error(
    `DATABASE_PROVIDER="${provider}" is not supported. Use one of: ${SUPPORTED.join(", ")}`,
  );
  process.exit(1);
}

let template;
try {
  template = readFileSync(templatePath, "utf8");
} catch {
  console.error(
    "prisma/schema.template.prisma is missing. It is the source of truth for the data model.",
  );
  process.exit(1);
}

let schema = stripNativeTypes(setProvider(template, provider));

if (provider === "mysql") {
  schema = applyNativeTypes(schema, MYSQL_NATIVE_TYPES);
}

if (provider === "sqlserver") {
  console.warn(
    "note: SQL Server caps String at NVARCHAR(1000); long text columns need @db.NVarChar(Max).",
  );
}

const banner = `// GENERATED FILE - do not edit and do not commit.\n// Source: prisma/schema.template.prisma\n// Written by scripts/set-db-provider.mjs for DATABASE_PROVIDER="${provider}".\n\n`;
const output = banner + schema;

// Rewriting an identical file would churn the mtime and make Prisma and the
// Next.js dev server re-read it for nothing.
let current = null;
try {
  current = readFileSync(schemaPath, "utf8");
} catch {
  // not generated yet
}

if (current === output) {
  console.log(`prisma/schema.prisma already generated for "${provider}".`);
} else {
  writeFileSync(schemaPath, output);
  const detail =
    provider === "mysql"
      ? ` with ${Object.keys(MYSQL_NATIVE_TYPES).length} MySQL column types`
      : "";
  console.log(`prisma/schema.prisma generated for "${provider}"${detail}.`);
}
