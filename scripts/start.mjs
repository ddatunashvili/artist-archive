#!/usr/bin/env node
/**
 * Production entry point: `npm start`.
 *
 * Hosting panels typically do no more than "git pull && npm install &&
 * npm start", so this script covers what that leaves out:
 *
 * 1. Picks the port the host actually allocated. RE:NODE exposes it as
 *    SERVER_PORT; most other hosts use PORT. Hardcoding 3000 would make the
 *    app unreachable from outside the container.
 *
 * 2. Builds when there is no build, and rebuilds when the sources that
 *    produced the existing one have changed. `.next/` is git-ignored, so a
 *    freshly fetched repository has none and `next start` would exit with
 *    "Could not find a production build in the '.next' directory" - and a panel
 *    that deploys by fetching over the same folder keeps the previous build,
 *    so a push would otherwise go live still serving the old bundle.
 *
 *    The build also runs `prebuild` (which writes prisma/schema.prisma from
 *    the template) and `prisma generate`. That ordering matters: the
 *    @prisma/client postinstall runs while dependencies are installing, before
 *    this project's own postinstall has written the schema, so the client it
 *    produces cannot be trusted.
 *
 * 3. Fails with a readable message when DATABASE_URL is missing, instead of
 *    letting Prisma throw on the first query.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

/* 1. Port ---------------------------------------------------------------- */

const port = process.env.SERVER_PORT || process.env.PORT || "3000";
if (!/^\d+$/.test(port)) {
  console.error(`Invalid port "${port}". Set SERVER_PORT or PORT to a number.`);
  process.exit(1);
}
// Mirror it so anything else reading PORT agrees with the server.
process.env.PORT = port;

/* 2. Environment --------------------------------------------------------- */

// Next.js loads .env itself, but only once it starts — too late for the checks
// and the Prisma generate below. Panel-uploaded .env files are the normal case
// here, so read it up front. Real environment variables always win.
if (!process.env.DATABASE_URL) {
  for (const file of [".env.production", ".env"]) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    try {
      process.loadEnvFile(path);
      console.log(`> loaded ${file}`);
    } catch (error) {
      console.warn(`> could not read ${file}: ${error.message}`);
    }
    if (process.env.DATABASE_URL) break;
  }
}

if (!process.env.DATABASE_URL) {
  console.error(
    [
      "",
      "DATABASE_URL is not set.",
      "",
      "This app reads every secret from the environment. Upload a .env file",
      "next to package.json, or set the variables in the host's panel:",
      "",
      "  DATABASE_PROVIDER   mysql",
      "  DATABASE_URL        mysql://USER:PASSWORD@HOST:3306/DATABASE",
      "  APP_URL             https://your-domain",
      "  ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_SESSION_SECRET",
      "",
      "See docs/DEPLOYMENT.md. Never commit these values.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

/* 3. Schema and client --------------------------------------------------- */

const npm = isWindows ? "npm.cmd" : "npm";

function run(script) {
  const result = spawnSync(npm, ["run", script], {
    cwd: root,
    stdio: "inherit",
    shell: isWindows,
  });
  if (result.status !== 0) {
    console.error(`> ${script} failed, not starting`);
    process.exit(result.status ?? 1);
  }
}

// Always reconcile prisma/schema.prisma and the generated client with the
// current DATABASE_PROVIDER. An existing .next build says nothing about which
// engine the client was generated for, and a mismatch only surfaces as a
// confusing error on the first query.
run("db:generate");

/* 4. Build --------------------------------------------------------------- */

/**
 * A build is reused only while the sources that produced it are unchanged.
 *
 * Checking merely that `.next/` exists is not enough: a panel that deploys by
 * fetching the repository over the same folder leaves the previous build in
 * place, so a push would go live still serving the old bundle.
 *
 * The fingerprint is content-based rather than mtime-based, because that same
 * fetch rewrites every tracked file on each start and would otherwise force a
 * rebuild every boot.
 */
const SOURCE_PATHS = [
  "src",
  "public",
  "prisma/schema.template.prisma",
  "prisma/seed.ts",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "tsconfig.json",
];

const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);

function hashInto(hash, path) {
  let stats;
  try {
    stats = statSync(path);
  } catch {
    return; // optional file
  }

  if (stats.isDirectory()) {
    for (const name of readdirSync(path).sort()) {
      if (SKIP_DIRS.has(name)) continue;
      hashInto(hash, join(path, name));
    }
    return;
  }

  hash.update(relative(root, path).replace(/\\/g, "/"));
  hash.update(readFileSync(path));
}

function sourceFingerprint() {
  const hash = createHash("sha256");
  for (const entry of SOURCE_PATHS) hashInto(hash, resolve(root, entry));
  return hash.digest("hex");
}

const stampPath = resolve(root, ".next/BUILD_SOURCE");
const fingerprint = sourceFingerprint();

let previous = null;
try {
  previous = readFileSync(stampPath, "utf8").trim();
} catch {
  // never built by this script
}

const hasBuild = existsSync(resolve(root, ".next/BUILD_ID"));

if (hasBuild && previous === fingerprint && process.env.FORCE_BUILD !== "true") {
  console.log("> production build is current");
} else {
  if (!hasBuild) console.log("> no production build found, building");
  else if (previous === null) console.log("> build has no fingerprint, rebuilding");
  else if (previous !== fingerprint) console.log("> sources changed since the build, rebuilding");
  else console.log("> FORCE_BUILD set, rebuilding");

  run("build");
  // Written after a successful build, so a failed one is never marked current.
  writeFileSync(stampPath, `${fingerprint}\n`);
}

/* 5. Serve --------------------------------------------------------------- */

console.log(`> starting on port ${port}`);

const next = resolve(root, "node_modules/next/dist/bin/next");
const server = spawn(process.execPath, [next, "start", "-p", port], {
  cwd: root,
  stdio: "inherit",
});

// Forward shutdown signals so the panel's stop button is not a kill -9.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
