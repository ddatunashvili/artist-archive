import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type Session } from "@/lib/auth";

/** The signed-in session for server components and route handlers. */
export async function getSession(): Promise<Session | null> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Only same-site paths, so ?next= cannot be used as an open redirect. */
export function safeNext(raw: string | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/admin";
}

export async function isAdmin(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}
