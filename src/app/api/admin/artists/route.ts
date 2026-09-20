import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AdminArtistSchema, fieldErrors, slugify } from "@/lib/schema";

/** GET /api/admin/artists — every artist, with record counts. */
export async function GET() {
  const artists = await prisma.artist.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { entries: true } } },
  });
  return NextResponse.json({ count: artists.length, artists });
}

/** POST /api/admin/artists — create an artist. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = AdminArtistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid artist.", details: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  const { slug, ...artist } = parsed.data;
  const finalSlug = slug ?? slugify(artist.name);

  const clash = await prisma.artist.findUnique({ where: { slug: finalSlug } });
  if (clash) {
    return NextResponse.json(
      { error: `An artist already uses the address "${finalSlug}".` },
      { status: 409 },
    );
  }

  const created = await prisma.artist.create({ data: { ...artist, slug: finalSlug } });
  return NextResponse.json(created, { status: 201 });
}
