import type { Metadata } from "next";
import Link from "next/link";
import { EMPTY_ENTRY, EntryForm } from "@/components/EntryForm";
import { listArtists } from "@/lib/queries";

export const metadata: Metadata = { title: "New record" };
export const dynamic = "force-dynamic";

export default async function NewEntryPage() {
  const artists = await listArtists();

  return (
    <>
      <Link href="/admin/entries" className="backlink">
        ← Records
      </Link>
      <h1>New record</h1>

      {artists.length === 0 ? (
        <p className="empty">
          Create an <Link href="/admin/artists/new">artist</Link> first — every record belongs to one.
        </p>
      ) : (
        <EntryForm
          values={EMPTY_ENTRY}
          artists={artists.map((artist) => ({ id: artist.id, name: artist.name }))}
        />
      )}
    </>
  );
}
