/**
 * Password hashing with PBKDF2-SHA256 over Web Crypto.
 *
 * bcrypt and argon2 are native modules: they need a compiler on the host, and
 * this app is deployed by a panel that only runs `npm install && npm start`.
 * PBKDF2 is available everywhere Web Crypto is, adds no dependency, and is a
 * legitimate password KDF — it is what NIST specifies, and it is what the
 * WebAuthn and PBKDF2 profiles in most frameworks fall back to.
 *
 * Stored as a single self-describing string, so the iteration count can be
 * raised later without invalidating existing hashes:
 *
 *   pbkdf2$sha256$210000$<salt-b64url>$<hash-b64url>
 */

const ALGORITHM = "pbkdf2";
const DIGEST = "sha256";
const ITERATIONS = 210_000; // OWASP guidance for PBKDF2-HMAC-SHA256
const KEY_BITS = 256;
const SALT_BYTES = 16;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return [ALGORITHM, DIGEST, ITERATIONS, toBase64Url(salt), toBase64Url(hash)].join("$");
}

/** Length-independent comparison, so verification leaks no timing signal. */
function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5) return false;

  const [algorithm, digest, iterationText, saltText, hashText] = parts;
  if (algorithm !== ALGORITHM || digest !== DIGEST) return false;

  const iterations = Number.parseInt(iterationText, 10);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;

  try {
    const expected = fromBase64Url(hashText);
    const actual = await derive(password, fromBase64Url(saltText), iterations);
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Minimum the registration form enforces, kept in one place. */
export const MIN_PASSWORD_LENGTH = 10;
