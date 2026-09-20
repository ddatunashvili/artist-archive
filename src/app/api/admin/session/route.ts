import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, checkEnvCredentials, createSessionToken, sessionCookie } from "@/lib/auth";
import { verifyUserLogin } from "@/lib/users";

const LoginSchema = z.object({
  email: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
});

/** POST /api/admin/session — sign in. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const { email, password } = parsed.data;

  // Registered accounts first, then the environment ones. A database outage
  // therefore never locks the owner out.
  let session = await verifyUserLogin(email, password).catch(() => null);
  if (!session) session = checkEnvCredentials(email, password);

  if (!session) {
    // One message for both cases, so the response cannot be used to
    // enumerate valid accounts.
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const response = NextResponse.json({ email: session.email, role: session.role });
  response.cookies.set(sessionCookie(await createSessionToken(session)));
  return response;
}

/** DELETE /api/admin/session — sign out. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return response;
}
