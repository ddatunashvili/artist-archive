import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPlace, formatYears } from "@/components/EntryTable";
import { coverFor } from "@/components/EntryGrid";
import { getEntry } from "@/lib/queries";
import { absoluteUrl, jsonLd, site } from "@/lib/site";
import {
  ENTRY_STATUS_LABELS,
  ENTRY_TYPE_LABELS,
  type EntryStatus,
  type EntryType,
} from "@/lib/schema";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const entry = await getEntry((await params).id);
  if (!entry) return { title: "Record not found", robots: { index: false, follow: false } };

  const place = [entry.venue, entry.city, entry.country].filter(Boolean).join(", ");
  const title = `${entry.title} (${entry.year})`;
  const description =
    entry.description ??
    `${entry.title}, ${entry.year}${place ? ` — ${place}` : ""}. An archive record for ${entry.artist.name}.`;
  const path = `/entries/${entry.id}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    // Unreviewed records exist at a URL but must never be indexed.
    robots:
      entry.status === "published"
        ? undefined
        : { index: false, follow: false, nocache: true },
    openGraph: {
      type: "article",
      title,
      description,
      url: absoluteUrl(path),
      siteName: site.name,
      images: [{ url: site.ogImage, width: 2500, height: 840, alt: site.name }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function EntryPage({ params }: { params: Params }) {
  const entry = await getEntry((await params).id);
  if (!entry) notFound();

  const place = formatPlace(entry);
  const status = entry.status as EntryStatus;

  const recordLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: entry.title,
    url: absoluteUrl(`/entries/${entry.id}`),
    dateCreated: String(entry.year),
    ...(entry.images.length
      ? { image: entry.images.map((image) => absoluteUrl(image.url)) }
      : {}),
    ...(entry.description ? { description: entry.description } : {}),
    ...(entry.url ? { sameAs: entry.url } : {}),
    creator: {
      "@type": "Person",
      name: entry.artist.name,
      url: absoluteUrl(`/artists/${entry.artist.slug}`),
    },
    ...(entry.venue || entry.city
      ? {
          locationCreated: {
            "@type": "Place",
            name: entry.venue ?? entry.city,
            ...(entry.city || entry.country
              ? {
                  address: {
                    "@type": "PostalAddress",
                    ...(entry.city ? { addressLocality: entry.city } : {}),
                    ...(entry.country ? { addressCountry: entry.country } : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
    isPartOf: { "@type": "Collection", name: site.name, url: site.url },
  };

  return (
    <article>
      {status === "published" && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(recordLd) }} />
      )}
      <Link href="/" className="backlink">
        ← Catalogue
      </Link>

      <div className="detail-head">
        <p className="meta" style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
          {ENTRY_TYPE_LABELS[entry.type as EntryType] ?? entry.type} ·{" "}
          {formatYears(entry.year, entry.endYear)}
        </p>
        <h1>{entry.title}</h1>
        <p className="lede" style={{ margin: 0 }}>
          <Link href={`/artists/${entry.artist.slug}`}>{entry.artist.name}</Link>
          {place ? ` · ${place}` : ""}
        </p>
        {status !== "published" && (
          <p style={{ marginTop: 12 }}>
            <span className="tag flag">{ENTRY_STATUS_LABELS[status] ?? status}</span>{" "}
            <span className="meta" style={{ fontSize: 12, color: "var(--muted)" }}>
              not part of the public catalogue yet
            </span>
          </p>
        )}
      </div>

      {/* A CV carries no pictures, so a record with none shows its generated
          cover rather than an empty frame. */}
      {entry.images.length > 0 ? (
        <ul className="gallery">
          {entry.images.map((image) => (
            <li key={image.id}>
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.alt ?? entry.title} />
                {(image.alt || image.credit) && (
                  <figcaption>{[image.alt, image.credit].filter(Boolean).join(" — ")}</figcaption>
                )}
              </figure>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="gallery">
          <li>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverFor(entry).src} alt="" />
              <figcaption>Generated cover — no image has been added yet</figcaption>
            </figure>
          </li>
        </ul>
      )}

      {entry.description && <p style={{ maxWidth: "64ch" }}>{entry.description}</p>}

      {/* Two columns on a wide screen, so the section rules and the data they
          head line up instead of the rules running past a narrow list. */}
      <div className="detail-cols">
        <section>
      <h2>Record</h2>
      <dl className="facts">
        <dt>Type</dt>
        <dd>{ENTRY_TYPE_LABELS[entry.type as EntryType] ?? entry.type}</dd>

        <dt>Year</dt>
        <dd>{formatYears(entry.year, entry.endYear)}</dd>

        {entry.role && (
          <>
            <dt>Role</dt>
            <dd>{entry.role}</dd>
          </>
        )}

        <dt>Venue</dt>
        <dd>{entry.venue ?? "—"}</dd>

        <dt>Location</dt>
        <dd>{[entry.city, entry.country].filter(Boolean).join(", ") || "—"}</dd>

        {entry.url && (
          <>
            <dt>Link</dt>
            <dd>
              <a href={entry.url} target="_blank" rel="noreferrer noopener">
                {entry.url}
              </a>
            </dd>
          </>
        )}
      </dl>
        </section>

        <section>
      <h2>Provenance</h2>
      <dl className="facts">
        <dt>Status</dt>
        <dd>{ENTRY_STATUS_LABELS[status] ?? status}</dd>

        <dt>Extracted by</dt>
        <dd>{entry.extractedBy ?? "—"}</dd>

        <dt>Confidence</dt>
        <dd>{entry.confidence === null ? "—" : `${Math.round(entry.confidence * 100)}%`}</dd>

        <dt>Reviewed by</dt>
        <dd>{entry.reviewedBy ?? "not yet reviewed"}</dd>

        <dt>Reviewed at</dt>
        <dd>{entry.reviewedAt ? entry.reviewedAt.toISOString().slice(0, 10) : "—"}</dd>

        {entry.reviewNote && (
          <>
            <dt>Review note</dt>
            <dd>{entry.reviewNote}</dd>
          </>
        )}

        <dt>Added</dt>
        <dd>{entry.createdAt.toISOString().slice(0, 10)}</dd>
      </dl>
        </section>
      </div>

      {entry.sourceText && (
        <>
          <h2>Source line</h2>
          <blockquote className="source">{entry.sourceText}</blockquote>
        </>
      )}
    </article>
  );
}
