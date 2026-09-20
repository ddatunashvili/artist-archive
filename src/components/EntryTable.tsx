import Link from "next/link";
import { ENTRY_TYPE_LABELS, type EntryType } from "@/lib/schema";
import type { CatalogueEntry } from "@/lib/queries";

export function formatYears(year: number, endYear?: number | null): string {
  return endYear && endYear !== year ? `${year}–${endYear}` : String(year);
}

export function formatPlace(entry: {
  venue?: string | null;
  city?: string | null;
  country?: string | null;
}): string {
  return [entry.venue, entry.city, entry.country].filter(Boolean).join(", ");
}

/**
 * The catalogue index.
 *
 * Venue, city and country each get their own column rather than being joined
 * into one "place" string: at full width a four-column table leaves a dead gap
 * in the middle, and separate columns are how a printed archive index reads
 * anyway. They drop away one at a time as the viewport narrows.
 */
export function EntryTable({ entries }: { entries: CatalogueEntry[] }) {
  if (entries.length === 0) {
    return <p className="empty">No records match these filters.</p>;
  }

  return (
    <table className="catalogue">
      <thead>
        <tr>
          <th scope="col">Year</th>
          <th scope="col">Title</th>
          <th scope="col" className="c-artist">
            Artist
          </th>
          <th scope="col" className="type">
            Type
          </th>
          <th scope="col" className="c-venue">
            Venue
          </th>
          <th scope="col" className="c-city">
            City
          </th>
          <th scope="col" className="c-country">
            Country
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td className="year">{formatYears(entry.year, entry.endYear)}</td>
            <td className="title">
              <Link href={`/entries/${entry.id}`}>{entry.title}</Link>
              {entry.role && <div className="sub">{entry.role}</div>}
              {/* Folded in when the dedicated columns are hidden. */}
              <div className="sub only-narrow">
                {entry.artist.name}
                {formatPlace(entry) ? ` · ${formatPlace(entry)}` : ""}
              </div>
            </td>
            <td className="c-artist">
              <Link href={`/artists/${entry.artist.slug}`}>{entry.artist.name}</Link>
            </td>
            <td className="type">
              <span className="tag">{ENTRY_TYPE_LABELS[entry.type as EntryType] ?? entry.type}</span>
            </td>
            <td className="c-venue">{entry.venue ?? "—"}</td>
            <td className="c-city">{entry.city ?? "—"}</td>
            <td className="c-country">{entry.country ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
