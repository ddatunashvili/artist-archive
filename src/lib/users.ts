import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { Role, Session } from "@/lib/auth";

/**
 * Database-backed accounts.
 *
 * Kept apart from src/lib/auth.ts because that module runs in the edge
 * middleware, where Prisma cannot.
 */

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: normaliseEmail(email) } });
}

export async function countUsers(): Promise<number> {
  return prisma.user.count();
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, createdAt: true, lastLoginAt: true },
    take: 500,
  });
}

export type CreateUserResult =
  | { ok: true; session: Session }
  | { ok: false; error: string; status: number };

/**
 * Registers an account.
 *
 * Everyone who signs up gets "editor". Promotion to "admin" is a deliberate
 * act by an existing admin, so an open sign-up form cannot hand a visitor the
 * ability to delete the archive.
 */
export async function createUser(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<CreateUserResult> {
  const email = normaliseEmail(input.email);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "That email is already registered.", status: 409 };
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: "editor",
    },
  });

  return {
    ok: true,
    session: { email: user.email, role: "editor", name: user.name ?? undefined },
  };
}

/** Verifies a sign-in against the user table. */
export async function verifyUserLogin(email: string, password: string): Promise<Session | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;

  if (!(await verifyPassword(password, user.passwordHash))) return null;

  // Best effort: a failure to record the timestamp must not block sign-in.
  await prisma.user
    .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    .catch(() => undefined);

  const role: Role = user.role === "admin" ? "admin" : "editor";
  return { email: user.email, role, name: user.name ?? undefined };
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}

export async function setUserRole(id: string, role: Role) {
  return prisma.user.update({ where: { id }, data: { role } });
}
