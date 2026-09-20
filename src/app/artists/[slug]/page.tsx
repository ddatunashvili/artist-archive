import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPlace, formatYears } from "@/components/EntryTable";
import { getArtistBySlug } from "@/lib/queries";
import { absoluteUrl, jsonLd, site } from "@/lib/site";
import { ENTRY_TYPE_LABELS, type EntryType } from "@/lib/schema";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const artist = await getArtistBySlug((await params).slug);
  if (!artist) return { title: "Artist not found", robots: { index: false, follow: false } };

  const description =
    artist.bio ??
    `${artist.name}: ${artist.entries.length} archived exhibitions, publications, awards and residencies.`;
  const path = `/artists/${artist.slug}`;

  return {
    title: artist.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "profile",
      title: artist.name,
      description,
      url: absoluteUrl(path),
      siteName: site.name,
      images: [{ url: site.ogImage, width: 2500, height: 840, alt: site.name }],
    },
    twitter: { card: "summary_large_image", title: artist.name, description },
  };
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

  const artistLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: artist.name,
    url: absoluteUrl(`/artists/${artist.slug}`),
    ...(artist.bio ? { description: artist.bio } : {}),
    ...(artist.birthYear ? { birthDate: String(artist.birthYear) } : {}),
    ...(artist.nationality ? { nationality: artist.nationality } : {}),
    ...(artist.website ? { sameAs: [artist.website] } : {}),
    jobTitle: "Artist",
    subjectOf: artist.entries.slice(0, 50).map((entry) => ({
      "@type": "CreativeWork",
      name: entry.title,
      url: absoluteUrl(`/entries/${entry.id}`),
      dateCreated: String(entry.year),
    })),
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(artistLd) }} />
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
