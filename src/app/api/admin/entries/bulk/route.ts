import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ENTRY_STATUSES } from "@/lib/schema";
import { getSession } from "@/lib/session";

const BulkSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "Select at least one record").max(500),
  action: z.enum([...ENTRY_STATUSES, "delete"]),
  reviewedBy: z.string().trim().max(120).optional(),
});

/**
 * POST /api/admin/entries/bulk
 *
 * One decision applied to many records: the review queue and the record list
 * both need it, and doing it a row at a time is the difference between
 * clearing a queue and giving up on it.
 *
 * Runs as a transaction, so a batch either lands whole or not at all.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = BulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const { ids, action } = parsed.data;

  if (action === "delete") {
    const removed = await prisma.archiveEntry.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ action, affected: removed.count });
  }

  // Whoever is signed in is the reviewer; a typed name is not an identity.
  const reviewedBy = parsed.data.reviewedBy?.trim() || session.name || session.email;
  const reviewed = action === "published" || action === "rejected";

  const updated = await prisma.archiveEntry.updateMany({
    where: { id: { in: ids } },
    data: {
      status: action,
      ...(reviewed ? { reviewedBy, reviewedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({ action, affected: updated.count, reviewedBy: reviewed ? reviewedBy : null });
}
