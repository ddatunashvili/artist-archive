import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EntryReviewSchema, fieldErrors } from "@/lib/schema";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const entry = await prisma.archiveEntry.findUnique({
    where: { id: (await params).id },
    include: { artist: true },
  });
  if (!entry) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(entry);
}

/**
 * PATCH /api/entries/[id]
 * The single-record half of the review workflow: correct fields, then
 * publish or reject. A status change always stamps who did it.
 */
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = EntryReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  const { status, reviewedBy, reviewNote, patch } = parsed.data;

  if (status === "published" && !reviewedBy) {
    return NextResponse.json({ error: "Publishing requires a reviewer name." }, { status: 400 });
  }

  const existing = await prisma.archiveEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const entry = await prisma.archiveEntry.update({
    where: { id },
    data: {
      ...patch,
      ...(status ? { status, reviewedBy: reviewedBy ?? null, reviewedAt: new Date() } : {}),
      ...(reviewNote !== undefined ? { reviewNote } : {}),
    },
  });

  return NextResponse.json(entry);
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const existing = await prisma.archiveEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.archiveEntry.delete({ where: { id } });
  return NextResponse.json({ deleted: id });
}
