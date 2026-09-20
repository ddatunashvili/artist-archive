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
      <h1>Artists</h1>
      <p className="lede">
        {artists.length} {artists.length === 1 ? "artist" : "artists"} with published records.
      </p>

      {artists.length === 0 ? (
        <p className="empty">No published records yet.</p>
      ) : (
        <table className="catalogue">
          <thead>
            <tr>
              <th>Name</th>
              <th className="type">Born</th>
              <th className="place">Based in</th>
              <th>Records</th>
            </tr>
          </thead>
          <tbody>
            {artists.map((artist) => (
              <tr key={artist.id}>
                <td className="title">
                  <Link href={`/artists/${artist.slug}`}>{artist.name}</Link>
                  {artist.nationality && <div className="sub">{artist.nationality}</div>}
                </td>
                <td className="type">{artist.birthYear ?? "—"}</td>
                <td className="place">{artist.basedIn ?? "—"}</td>
                <td className="year">{artist._count.entries}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
