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

export function EntryTable({ entries }: { entries: CatalogueEntry[] }) {
  if (entries.length === 0) {
    return <p className="empty">No records match these filters.</p>;
  }

  return (
    <table className="catalogue">
      <thead>
        <tr>
          <th scope="col">Year</th>
          <th scope="col">Title / Artist</th>
          <th scope="col" className="type">
            Type
          </th>
          <th scope="col" className="place">
            Venue, City, Country
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td className="year">{formatYears(entry.year, entry.endYear)}</td>
            <td className="title">
              <Link href={`/entries/${entry.id}`}>{entry.title}</Link>
              <div className="sub">
                {entry.artist.name}
                {entry.role ? ` · ${entry.role}` : ""}
              </div>
            </td>
            <td className="type">
              <span className="tag">{ENTRY_TYPE_LABELS[entry.type as EntryType] ?? entry.type}</span>
            </td>
            <td className="place">{formatPlace(entry) || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
