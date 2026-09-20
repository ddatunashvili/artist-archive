import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findEntries, normaliseFilters } from "@/lib/queries";
import { PublishRequestSchema, fieldErrors, slugify } from "@/lib/schema";

/** GET /api/entries - the catalogue as JSON, same filters as the UI. */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const entries = await findEntries(normaliseFilters(params));
  return NextResponse.json({ count: entries.length, entries });
}

/**
 * POST /api/entries
 * Writes a reviewed batch. The payload is whatever the human corrected in the
 * review step, not the raw model output, and it is validated again here -
 * the API is the last gate before anything reaches the archive.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = PublishRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  const { artist, entries, status, reviewedBy, reviewNote, extractedBy } = parsed.data;

  // Publishing requires an explicit reviewer name so the archive keeps a
  // record of who signed off.
  if (status === "published" && !reviewedBy) {
    return NextResponse.json(
      { error: "Publishing requires a reviewer name." },
      { status: 400 },
    );
  }

  const slug = slugify(artist.name);
  const reviewed = status === "published" || status === "rejected";

  const saved = await prisma.$transaction(async (tx) => {
    const record = await tx.artist.upsert({
      where: { slug },
      update: {
        birthYear: artist.birthYear,
        deathYear: artist.deathYear,
        nationality: artist.nationality,
        basedIn: artist.basedIn,
        website: artist.website,
        bio: artist.bio,
      },
      create: {
        slug,
        name: artist.name,
        birthYear: artist.birthYear,
        deathYear: artist.deathYear,
        nationality: artist.nationality,
        basedIn: artist.basedIn,
        website: artist.website,
        bio: artist.bio,
      },
    });

    await tx.archiveEntry.createMany({
      data: entries.map((entry) => ({
        artistId: record.id,
        type: entry.type,
        title: entry.title,
        role: entry.role,
        year: entry.year,
        endYear: entry.endYear,
        venue: entry.venue,
        city: entry.city,
        country: entry.country,
        description: entry.description,
        url: entry.url,
        status,
        confidence: entry.confidence,
        sourceText: entry.sourceText,
        extractedBy: extractedBy ?? "manual",
        reviewedBy: reviewed ? reviewedBy : null,
        reviewedAt: reviewed ? new Date() : null,
        reviewNote,
      })),
    });

    return record;
  });

  return NextResponse.json(
    {
      artist: { id: saved.id, slug: saved.slug, name: saved.name },
      saved: entries.length,
      status,
    },
    { status: 201 },
  );
}
