import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLES, type Role } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { deleteUser, setUserRole } from "@/lib/users";

type Context = { params: Promise<{ id: string }> };

const PatchSchema = z.object({ role: z.enum(ROLES) });

/** PATCH /api/admin/users/[id] — change a role. Admin only. */
export async function PATCH(request: Request, { params }: Context) {
  const session = await getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Role must be admin or editor." }, { status: 400 });
  }

  const updated = await setUserRole((await params).id, parsed.data.role as Role);
  return NextResponse.json({ id: updated.id, role: updated.role });
}

/** DELETE /api/admin/users/[id] — admin only. */
export async function DELETE(_request: Request, { params }: Context) {
  const session = await getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { id } = await params;
  const removed = await deleteUser(id).catch(() => null);
  if (!removed) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Signing yourself out is handled by the client; the session cookie stays
  // valid until it expires, which is acceptable for a single-operator tool.
  return NextResponse.json({ deleted: id });
}
