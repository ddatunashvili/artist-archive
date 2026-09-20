/**
 * Minimal admin authentication for the prototype.
 *
 * A single operator account, credentials from the environment, and a
 * stateless HMAC-signed cookie. No dependency, no session store, and it runs
 * unchanged in the edge middleware and in Node route handlers because it only
 * uses Web Crypto.
 *
 * This is deliberately the smallest thing that keeps /admin closed. It is not
 * a user system: no registration, no roles, no password reset. See
 * docs/ADMIN.md before putting it in front of anything that matters.
 */

export const SESSION_COOKIE = "aeitos_admin";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

/** Demo defaults so a fresh clone can sign in immediately. */
const DEMO_EMAIL = "admin@aeitos.com";
const DEMO_PASSWORD = "aeitos-demo-2026";
const DEMO_SECRET = "aeitos-prototype-development-secret-change-me";

export function adminCredentials() {
  return {
    email: process.env.ADMIN_EMAIL || DEMO_EMAIL,
    password: process.env.ADMIN_PASSWORD || DEMO_PASSWORD,
  };
}

/** True when the deployment is still running on the published demo values. */
export function usingDemoCredentials(): boolean {
  const { email, password } = adminCredentials();
  return email === DEMO_EMAIL && password === DEMO_PASSWORD;
}

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || DEMO_SECRET;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
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

/** Constant-time credential check. */
export function checkCredentials(email: string, password: string): boolean {
  const expected = adminCredentials();
  const emailOk = safeEqual(email.trim().toLowerCase(), expected.email.toLowerCase());
  const passwordOk = safeEqual(password, expected.password);
  return emailOk && passwordOk;
}
