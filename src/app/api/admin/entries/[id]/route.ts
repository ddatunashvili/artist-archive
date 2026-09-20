import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AdminEntryPatchSchema, fieldErrors } from "@/lib/schema";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/admin/entries/[id] — edit any field of one record. */
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = AdminEntryPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid record.", details: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  const existing = await prisma.archiveEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { status, reviewedBy, ...rest } = parsed.data;
  const becomesReviewed =
    status !== undefined && status !== existing.status && (status === "published" || status === "rejected");

  if (status === "published" && !(reviewedBy ?? existing.reviewedBy)) {
    return NextResponse.json({ error: "Publishing requires a reviewer name." }, { status: 400 });
  }

  const updated = await prisma.archiveEntry.update({
    where: { id },
    data: {
      ...rest,
      ...(status !== undefined ? { status } : {}),
      ...(reviewedBy !== undefined ? { reviewedBy } : {}),
      ...(becomesReviewed ? { reviewedAt: new Date() } : {}),
    },
  });

  return NextResponse.json(updated);
}

/** DELETE /api/admin/entries/[id] — remove one record permanently. */
export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const existing = await prisma.archiveEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.archiveEntry.delete({ where: { id } });
  return NextResponse.json({ deleted: id });
}
