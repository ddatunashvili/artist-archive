import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, registrationOpen, sessionCookie } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { createUser } from "@/lib/users";

const RegisterSchema = z.object({
  name: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined),
      z.string().max(120).optional(),
    ),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(200),
});

/**
 * POST /api/admin/register
 *
 * Open sign-up: this is a prototype meant to be tried. Every account is
 * created as "editor", which can import, review, publish and edit but cannot
 * delete an artist or manage users — so a visitor can exercise the whole
 * workflow without being able to empty the archive.
 */
export async function POST(request: Request) {
  if (!registrationOpen()) {
    return NextResponse.json({ error: "Registration is closed." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Check the form.",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const result = await createUser(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Signed in immediately, so registering lands straight in the panel.
  const response = NextResponse.json(
    { email: result.session.email, role: result.session.role },
    { status: 201 },
  );
  response.cookies.set(sessionCookie(await createSessionToken(result.session)));
  return response;
}
