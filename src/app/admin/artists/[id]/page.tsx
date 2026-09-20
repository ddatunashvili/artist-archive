import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtistForm } from "@/components/ArtistForm";
import { DeleteButton } from "@/components/DeleteButton";
import { getArtistById } from "@/lib/queries";

export const metadata: Metadata = { title: "Edit artist" };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const text = (value: string | null | undefined) => value ?? "";
const year = (value: number | null | undefined) => (value ? String(value) : "");

export default async function EditArtistPage({ params }: { params: Params }) {
  const artist = await getArtistById((await params).id);
  if (!artist) notFound();

  return (
    <>
      <Link href="/admin/artists" className="backlink">
        ← Artists
      </Link>

      <div className="toolbar">
        <h1>{artist.name}</h1>
        <div className="actions">
          <Link href={`/artists/${artist.slug}`} className="button ghost">
            View public page
          </Link>
          <DeleteButton
            endpoint={`/api/admin/artists/${artist.id}`}
            warning="also deletes their records"
          />
        </div>
      </div>

      <ArtistForm
        values={{
          id: artist.id,
          name: artist.name,
          slug: artist.slug,
          birthYear: year(artist.birthYear),
          deathYear: year(artist.deathYear),
          nationality: text(artist.nationality),
          basedIn: text(artist.basedIn),
          website: text(artist.website),
          bio: text(artist.bio),
        }}
      />
    </>
  );
}
