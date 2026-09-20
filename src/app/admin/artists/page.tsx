import type { Metadata } from "next";
import Link from "next/link";
import { DeleteButton } from "@/components/DeleteButton";
import { listArtists } from "@/lib/queries";

export const metadata: Metadata = { title: "Artists" };
export const dynamic = "force-dynamic";

export default async function AdminArtistsPage() {
  const artists = await listArtists();

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Artists</h1>
          <p className="lede" style={{ margin: 0 }}>
            {artists.length} {artists.length === 1 ? "artist" : "artists"} in the archive.
          </p>
        </div>
        <Link href="/admin/artists/new" className="button">
          New artist
        </Link>
      </div>

      {artists.length === 0 ? (
        <p className="empty">No artists yet.</p>
      ) : (
        <table className="catalogue">
          <thead>
            <tr>
              <th>Name</th>
              <th className="type">Born</th>
              <th className="place">Based in</th>
              <th>Records</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {artists.map((artist) => (
              <tr key={artist.id}>
                <td className="title">
                  <Link href={`/admin/artists/${artist.id}`}>{artist.name}</Link>
                  <div className="sub">/{artist.slug}</div>
                </td>
                <td className="type">{artist.birthYear ?? "—"}</td>
                <td className="place">{artist.basedIn ?? "—"}</td>
                <td className="actions-cell">
                  <Link href={`/admin/entries?q=${encodeURIComponent(artist.name)}`} className="tag">
                    {artist._count.entries}
                  </Link>
                </td>
                <td className="actions-cell">
                  <DeleteButton
                    endpoint={`/api/admin/artists/${artist.id}`}
                    warning={
                      artist._count.entries > 0
                        ? `also deletes ${artist._count.entries} records`
                        : undefined
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
