import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listUsers } from "@/lib/users";

/** GET /api/admin/users — admin only. */
export async function GET() {
  const session = await getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const users = await listUsers();
  return NextResponse.json({ count: users.length, users });
}
