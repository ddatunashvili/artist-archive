import type { Metadata } from "next";
import { ReviewQueue, type PendingEntry } from "@/components/ReviewQueue";
import { getPendingEntries } from "@/lib/queries";

export const metadata: Metadata = { title: "Review queue" };
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const pending = await getPendingEntries();

  const entries: PendingEntry[] = pending.map((entry) => ({
    id: entry.id,
    title: entry.title,
    type: entry.type,
    year: entry.year,
    endYear: entry.endYear,
    venue: entry.venue,
    city: entry.city,
    country: entry.country,
    role: entry.role,
    confidence: entry.confidence,
    sourceText: entry.sourceText,
    extractedBy: entry.extractedBy,
    status: entry.status,
    artistName: entry.artist.name,
    artistSlug: entry.artist.slug,
  }));

  return (
    <>
      <h1>Review queue</h1>
      <p className="lede">
        {entries.length} {entries.length === 1 ? "record is" : "records are"} waiting for a decision.
        Low-confidence extractions are flagged. Publishing requires a reviewer name, which is stored
        with the record.
      </p>
      <ReviewQueue entries={entries} />
    </>
  );
}
