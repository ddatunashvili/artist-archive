import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, sessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/password";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";

const optional = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null),
    z.string().max(max).nullable(),
  );

const ProfileSchema = z.object({
  name: optional(120),
  title: optional(120),
  bio: optional(2000),
  avatarUrl: z.preprocess((value) => {
    if (typeof value !== "string" || !value.trim()) return null;
    const trimmed = value.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }, z.string().url().max(600).nullable()),
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().max(200).optional(),
});

/**
 * PATCH /api/admin/profile
 *
 * Edits the signed-in account and nothing else — there is no id in the body,
 * so this endpoint cannot be pointed at somebody else's row.
 *
 * The environment owner and demo accounts are configuration rather than rows;
 * they have no profile to edit and are refused rather than silently ignored.
 */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const user = await findUserByEmail(session.email);
  if (!user) {
    return NextResponse.json(
      {
        error:
          "This account is configured in the environment and has no editable profile. Register an account to have one.",
      },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = ProfileSchema.safeParse(body);
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

  const { name, title, bio, avatarUrl, currentPassword, newPassword } = parsed.data;

  let passwordHash: string | undefined;
  if (newPassword) {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `The new password needs at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 },
      );
    }
    // Knowing the current password is what makes this a change rather than a
    // takeover of a session someone left open.
    if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
    }
    passwordHash = await hashPassword(newPassword);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name, title, bio, avatarUrl, ...(passwordHash ? { passwordHash } : {}) },
    select: { email: true, name: true, title: true, bio: true, avatarUrl: true, role: true },
  });

  // The display name lives in the session cookie, so refresh it.
  const response = NextResponse.json(updated);
  response.cookies.set(
    sessionCookie(
      await createSessionToken({
        email: updated.email,
        role: session.role,
        name: updated.name ?? undefined,
      }),
    ),
  );
  return response;
}
