import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedArtists } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Artists",
  description:
    "Every artist represented in the aeitos archive, with the number of published records held for each.",
  alternates: { canonical: "/artists" },
};

export const dynamic = "force-dynamic";

export default async function ArtistsIndexPage() {
  const artists = await listPublishedArtists();

  return (
    <>
      <div className="page-head">
        <h1>Artists</h1>
        <p className="lede">
          {artists.length} {artists.length === 1 ? "artist" : "artists"} with published records.
        </p>
      </div>

      {artists.length === 0 ? (
        <p className="empty">No published records yet.</p>
      ) : (
        <table className="catalogue">
          <thead>
            <tr>
              <th>Name</th>
              <th className="c-artist">Nationality</th>
              <th className="type">Born</th>
              <th className="c-venue">Based in</th>
              <th>Records</th>
            </tr>
          </thead>
          <tbody>
            {artists.map((artist) => (
              <tr key={artist.id}>
                <td className="title">
                  <Link href={`/artists/${artist.slug}`}>{artist.name}</Link>
                  <div className="sub only-narrow">
                    {[artist.nationality, artist.basedIn].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td className="c-artist">{artist.nationality ?? "—"}</td>
                <td className="type num">{artist.birthYear ?? "—"}</td>
                <td className="c-venue">{artist.basedIn ?? "—"}</td>
                <td className="year">{artist._count.entries}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
