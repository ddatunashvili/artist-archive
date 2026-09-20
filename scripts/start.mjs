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
 * 2. Builds if there is no build. `.next/` is git-ignored, so a freshly
 *    fetched repository has none and `next start` would exit with
 *    "Could not find a production build in the '.next' directory".
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
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
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

if (existsSync(resolve(root, ".next/BUILD_ID"))) {
  console.log("> production build present");
} else {
  console.log("> no production build found, building once before start");
  run("build");
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
