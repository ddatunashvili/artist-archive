/**
 * Sessions and the environment-configured accounts.
 *
 * Deliberately free of any database import: this module runs in the edge
 * middleware as well as in Node route handlers, so it only uses Web Crypto.
 * Database-backed accounts live in src/lib/users.ts.
 *
 * Three ways in:
 *
 *   owner     ADMIN_EMAIL / ADMIN_PASSWORD. Private, never pre-filled. Role
 *             "admin", so the archive can always be administered even if the
 *             user table is empty or unreachable.
 *   demo      A published pair, pre-filled on the sign-in form so anyone can
 *             try the prototype. Role "editor".
 *   registered  Anyone who signs up. Role "editor".
 *
 * "editor" can import, review, publish and edit. Destructive and
 * administrative actions — deleting an artist and its records, managing
 * users — require "admin", so an open demo cannot be wiped by a visitor.
 */

export const SESSION_COOKIE = "aeitos_admin";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

export const ROLES = ["admin", "editor"] as const;
export type Role = (typeof ROLES)[number];

export type Session = {
  email: string;
  role: Role;
  name?: string;
};

/** Published in the README. Testing only. */
const DEMO_EMAIL = "demo@aeitos.com";
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
 * The published demo account. On by default unless DEMO_ADMIN="false", so the
 * prototype is testable by anyone who opens it.
 */
export function demoAccount(): { enabled: boolean; email: string; password: string } {
  return {
    enabled: value("DEMO_ADMIN").toLowerCase() !== "false",
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  };
}

/** Cookie options shared by sign-in and registration. */
export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function isDemoAccount(email: string): boolean {
  return email.trim().toLowerCase() === DEMO_EMAIL.toLowerCase();
}

/** Registration can be closed without redeploying. */
export function registrationOpen(): boolean {
  return value("ALLOW_REGISTRATION").toLowerCase() !== "false";
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
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(session: Session): Promise<string> {
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify({
        sub: session.email,
        role: session.role,
        name: session.name,
        exp: Date.now() + SESSION_MAX_AGE * 1000,
      }),
    ),
  );
  return `${payload}.${await sign(payload)}`;
}

/** The role travels inside the signed cookie, so no lookup is needed at the edge. */
export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (!safeEqual(signature, await sign(payload))) return null;

  try {
    const claims = JSON.parse(fromBase64Url(payload)) as {
      sub?: string;
      role?: string;
      name?: string;
      exp?: number;
    };
    if (!claims.sub || !claims.exp || claims.exp < Date.now()) return null;
    const role: Role = claims.role === "admin" ? "admin" : "editor";
    return { email: claims.sub, role, name: claims.name };
  } catch {
    return null;
  }
}

/**
 * Checks the environment accounts only. Registered users are checked in
 * src/lib/users.ts; the session route tries both.
 *
 * Every candidate is compared even after one matches, so the time taken does
 * not reveal which account an address belongs to.
 */
export function checkEnvCredentials(email: string, password: string): Session | null {
  const candidates: { email: string; password: string; role: Role }[] = [];

  const owner = ownerAccount();
  if (owner) candidates.push({ ...owner, role: "admin" });

  const demo = demoAccount();
  if (demo.enabled) candidates.push({ email: demo.email, password: demo.password, role: "editor" });

  let matched: Session | null = null;
  for (const candidate of candidates) {
    const emailOk = safeEqual(email.trim().toLowerCase(), candidate.email.toLowerCase());
    const passwordOk = safeEqual(password, candidate.password);
    if (emailOk && passwordOk) {
      matched = { email: candidate.email, role: candidate.role, name: undefined };
    }
  }
  return matched;
}
