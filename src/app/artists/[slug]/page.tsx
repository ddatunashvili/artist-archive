import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPlace, formatYears } from "@/components/EntryTable";
import { getArtistBySlug } from "@/lib/queries";
import { ENTRY_TYPE_LABELS, type EntryType } from "@/lib/schema";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const artist = await getArtistBySlug((await params).slug);
  return { title: artist ? artist.name : "Artist not found" };
}

export default async function ArtistPage({ params }: { params: Params }) {
  const artist = await getArtistBySlug((await params).slug);
  if (!artist) notFound();

  // Group the CV back into the sections an artist would recognise.
  const sections = new Map<string, typeof artist.entries>();
  for (const entry of artist.entries) {
    const list = sections.get(entry.type) ?? [];
    list.push(entry);
    sections.set(entry.type, list);
  }

  return (
    <article>
      <Link href="/" className="backlink">
        ← Catalogue
      </Link>

      <div className="detail-head">
        <h1>{artist.name}</h1>
        <p className="lede" style={{ margin: 0 }}>
          {[
            artist.birthYear ? `b. ${artist.birthYear}` : null,
            artist.nationality,
            artist.basedIn ? `lives in ${artist.basedIn}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {artist.bio && <p style={{ maxWidth: "64ch" }}>{artist.bio}</p>}
      {artist.website && (
        <p>
          <a href={artist.website} target="_blank" rel="noreferrer noopener">
            {artist.website}
          </a>
        </p>
      )}

      {[...sections.entries()].map(([type, entries]) => (
        <section key={type}>
          <h2>{ENTRY_TYPE_LABELS[type as EntryType] ?? type}</h2>
          <table className="catalogue">
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="year">{formatYears(entry.year, entry.endYear)}</td>
                  <td className="title">
                    <Link href={`/entries/${entry.id}`}>{entry.title}</Link>
                    <div className="sub">{formatPlace(entry)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {artist.entries.length === 0 && <p className="empty">No published records for this artist.</p>}
    </article>
  );
}
