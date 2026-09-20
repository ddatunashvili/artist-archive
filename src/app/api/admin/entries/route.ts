import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AdminEntrySchema, fieldErrors } from "@/lib/schema";

/** POST /api/admin/entries — create one record by hand. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = AdminEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid record.", details: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  const { artistId, status, reviewedBy, reviewNote, extractedBy, images, ...entry } = parsed.data;

  if (status === "published" && !reviewedBy) {
    return NextResponse.json({ error: "Publishing requires a reviewer name." }, { status: 400 });
  }

  const artist = await prisma.artist.findUnique({ where: { id: artistId } });
  if (!artist) return NextResponse.json({ error: "Unknown artist." }, { status: 400 });

  const reviewed = status === "published" || status === "rejected";
  const created = await prisma.archiveEntry.create({
    data: {
      ...entry,
      artistId,
      status,
      reviewNote,
      extractedBy: extractedBy ?? "manual",
      reviewedBy: reviewed ? reviewedBy : null,
      reviewedAt: reviewed ? new Date() : null,
      images: images?.length
        ? {
            create: images.map((image, index) => ({
              url: image.url,
              alt: image.alt,
              credit: image.credit,
              sortOrder: index,
            })),
          }
        : undefined,
    },
    include: { images: true },
  });

  return NextResponse.json(created, { status: 201 });
}
