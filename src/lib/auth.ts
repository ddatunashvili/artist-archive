/**
 * Admin authentication for the prototype.
 *
 * Two accounts, both configured from the environment:
 *
 *   owner — your real credentials. Never published, never pre-filled.
 *   demo  — the published pair, pre-filled on the sign-in form so the
 *           prototype can be tested in one click.
 *
 * The demo account is on by default only while no owner is configured, so a
 * fresh clone works immediately but setting a real password does not silently
 * leave the published one live. Keep it alongside an owner account by setting
 * DEMO_ADMIN="true" explicitly.
 *
 * Sessions are stateless HMAC-signed cookies: no dependency, no session store,
 * and the same code runs in the edge middleware and in Node route handlers
 * because it only uses Web Crypto.
 *
 * This is deliberately the smallest thing that keeps /admin closed. It is not
 * a user system. See docs/ADMIN.md before putting it in front of anything
 * that matters.
 */

export const SESSION_COOKIE = "aeitos_admin";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

/** Published in the README. Testing only. */
const DEMO_EMAIL = "admin@aeitos.com";
const DEMO_PASSWORD = "aeitos-demo-2026";
const DEV_SECRET = "aeitos-prototype-development-secret-change-me";

function value(name: string): string {
  const raw = process.env[name];
  return raw === undefined ? "" : raw.trim();
}

/** The private account, or null when none is configured. */
export function ownerAccount(): { email: string; password: string } | null {
  const email = value("ADMIN_EMAIL");
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !password) return null;
  return { email, password };
}

/**
 * The published demo account. Enabled by default only when there is no owner;
 * DEMO_ADMIN="true" keeps it alongside one, DEMO_ADMIN="false" always disables.
 */
export function demoAccount(): { enabled: boolean; email: string; password: string } {
  const flag = value("DEMO_ADMIN").toLowerCase();
  const enabled = flag === "false" ? false : flag === "true" ? true : ownerAccount() === null;
  return { enabled, email: DEMO_EMAIL, password: DEMO_PASSWORD };
}

export function isDemoAccount(email: string): boolean {
  return email.trim().toLowerCase() === DEMO_EMAIL.toLowerCase();
}

function sessionSecret(): string {
  return value("ADMIN_SESSION_SECRET") || DEV_SECRET;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

/** Length-independent comparison, so a wrong guess leaks no timing signal. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(email: string): Promise<string> {
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ sub: email, exp: Date.now() + SESSION_MAX_AGE * 1000 })),
  );
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (!safeEqual(signature, await sign(payload))) return null;

  try {
    const claims = JSON.parse(fromBase64Url(payload)) as { sub?: string; exp?: number };
    if (!claims.sub || !claims.exp || claims.exp < Date.now()) return null;
    return claims.sub;
  } catch {
    return null;
  }
}

/**
 * Checks a sign-in against both accounts.
 *
 * Every candidate is compared even after one matches, so the time taken does
 * not reveal which account an address belongs to. Returns the canonical email
 * to store in the session, or null.
 */
export function checkCredentials(email: string, password: string): string | null {
  const candidates: { email: string; password: string }[] = [];

  const owner = ownerAccount();
  if (owner) candidates.push(owner);

  const demo = demoAccount();
  if (demo.enabled) candidates.push({ email: demo.email, password: demo.password });

  let matched: string | null = null;
  for (const candidate of candidates) {
    const emailOk = safeEqual(email.trim().toLowerCase(), candidate.email.toLowerCase());
    const passwordOk = safeEqual(password, candidate.password);
    if (emailOk && passwordOk) matched = candidate.email;
  }
  return matched;
}
