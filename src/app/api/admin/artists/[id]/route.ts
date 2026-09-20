import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AdminArtistPatchSchema, fieldErrors } from "@/lib/schema";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/admin/artists/[id] */
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = AdminArtistPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid artist.", details: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  const existing = await prisma.artist.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const clash = await prisma.artist.findUnique({ where: { slug: parsed.data.slug } });
    if (clash) {
      return NextResponse.json(
        { error: `An artist already uses the address "${parsed.data.slug}".` },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.artist.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

/**
 * DELETE /api/admin/artists/[id]
 * Entries cascade, so the count is returned to make the consequence explicit
 * and the UI can confirm before calling this.
 */
export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const existing = await prisma.artist.findUnique({
    where: { id },
    include: { _count: { select: { entries: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.artist.delete({ where: { id } });
  return NextResponse.json({ deleted: id, entriesRemoved: existing._count.entries });
}
