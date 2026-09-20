import Link from "next/link";
import { ENTRY_TYPE_LABELS, type EntryType } from "@/lib/schema";
import type { CatalogueEntry } from "@/lib/queries";
import { formatPlace, formatYears } from "./EntryTable";

/** An uploaded image if the record has one, otherwise its generated cover. */
export function coverFor(entry: {
  id: string;
  type: string;
  images?: { url: string; alt: string | null }[];
}): { src: string; alt: string; generated: boolean } {
  const first = entry.images?.[0];
  if (first) return { src: first.url, alt: first.alt ?? "", generated: false };
  return {
    src: `/api/cover/${entry.id}?type=${encodeURIComponent(entry.type)}`,
    alt: "",
    generated: true,
  };
}

/**
 * The visual catalogue: one card per experience, opening its own page.
 *
 * Records arrive from a CV with no imagery, so a card without an uploaded
 * photograph falls back to a generated cover rather than an empty frame. The
 * fallback is marked so an archivist can see at a glance what still needs a
 * real picture.
 */
export function EntryGrid({ entries }: { entries: CatalogueEntry[] }) {
  if (entries.length === 0) {
    return <p className="empty">No records match these filters.</p>;
  }

  return (
    <ul className="entry-grid">
      {entries.map((entry) => {
        const cover = coverFor(entry);
        const place = formatPlace(entry);

        return (
          <li key={entry.id} className="card">
            <Link href={`/entries/${entry.id}`} className="card-link">
              <span className="card-frame">
                {/* Covers are decorative or archivist-supplied; next/image
                    would need every remote host allow-listed up front. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover.src} alt={cover.alt} loading="lazy" />
                {cover.generated && <span className="card-flag">no image yet</span>}
              </span>

              <span className="card-body">
                <span className="card-meta">
                  {formatYears(entry.year, entry.endYear)} ·{" "}
                  {ENTRY_TYPE_LABELS[entry.type as EntryType] ?? entry.type}
                </span>
                <span className="card-title">{entry.title}</span>
                <span className="card-sub">{entry.artist.name}</span>
                {place && <span className="card-sub">{place}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
