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

  const { status, reviewedBy, images, ...fields } = parsed.data;

  if (status === "published" && !(reviewedBy ?? existing.reviewedBy)) {
    return NextResponse.json({ error: "Publishing requires a reviewer name." }, { status: 400 });
  }

  // Only stamp a review time when the decision actually changes.
  const becomesReviewed =
    status !== undefined &&
    status !== existing.status &&
    (status === "published" || status === "rejected");

  const updated = await prisma.$transaction(async (tx) => {
    const entry = await tx.archiveEntry.update({
      where: { id },
      data: {
        ...fields,
        ...(status !== undefined ? { status } : {}),
        ...(reviewedBy !== undefined ? { reviewedBy } : {}),
        ...(becomesReviewed ? { reviewedAt: new Date() } : {}),
      },
    });

    // Images are sent as the complete set, so the old ones are replaced.
    if (images) {
      await tx.entryImage.deleteMany({ where: { entryId: id } });
      if (images.length > 0) {
        await tx.entryImage.createMany({
          data: images.map((image, index) => ({
            entryId: id,
            url: image.url,
            alt: image.alt,
            credit: image.credit,
            sortOrder: index,
          })),
        });
      }
    }

    return entry;
  });

  return NextResponse.json(updated);
}

/** DELETE /api/admin/entries/[id] — remove one record permanently. */
export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const existing = await prisma.archiveEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Images cascade with the record.
  await prisma.archiveEntry.delete({ where: { id } });
  return NextResponse.json({ deleted: id });
}
