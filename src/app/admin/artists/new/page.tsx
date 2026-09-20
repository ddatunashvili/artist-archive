import type { Metadata } from "next";
import Link from "next/link";
import { ArtistForm, EMPTY_ARTIST_FORM } from "@/components/ArtistForm";

export const metadata: Metadata = { title: "New artist" };

export default function NewArtistPage() {
  return (
    <>
      <Link href="/admin/artists" className="backlink">
        ← Artists
      </Link>
      <h1>New artist</h1>
      <ArtistForm values={EMPTY_ARTIST_FORM} />
    </>
  );
}
