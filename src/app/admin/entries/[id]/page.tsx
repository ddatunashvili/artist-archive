import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { EntryForm } from "@/components/EntryForm";
import { getEntry, listArtists } from "@/lib/queries";

export const metadata: Metadata = { title: "Edit record" };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const text = (value: string | null | undefined) => value ?? "";

export default async function EditEntryPage({ params }: { params: Params }) {
  const { id } = await params;
  const [entry, artists] = await Promise.all([getEntry(id), listArtists()]);
  if (!entry) notFound();

  return (
    <>
      <Link href="/admin/entries" className="backlink">
        ← Records
      </Link>

      <div className="toolbar">
        <div>
          <h1>{entry.title}</h1>
          <p className="lede" style={{ margin: 0 }}>
            {entry.artist.name} · added {entry.createdAt.toISOString().slice(0, 10)}
          </p>
        </div>
        <div className="actions">
          <Link href={`/entries/${entry.id}`} className="button ghost">
            View public page
          </Link>
          <DeleteButton endpoint={`/api/admin/entries/${entry.id}`} warning="permanent" />
        </div>
      </div>

      <EntryForm
        values={{
          id: entry.id,
          artistId: entry.artistId,
          type: entry.type,
          title: entry.title,
          role: text(entry.role),
          year: String(entry.year),
          endYear: entry.endYear ? String(entry.endYear) : "",
          venue: text(entry.venue),
          city: text(entry.city),
          country: text(entry.country),
          url: text(entry.url),
          description: text(entry.description),
          status: entry.status,
          reviewedBy: text(entry.reviewedBy),
          reviewNote: text(entry.reviewNote),
          sourceText: text(entry.sourceText),
          images: entry.images.map((image) => image.url).join("\n"),
        }}
        artists={artists.map((artist) => ({ id: artist.id, name: artist.name }))}
      />
    </>
  );
}
