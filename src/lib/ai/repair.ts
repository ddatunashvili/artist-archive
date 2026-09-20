import { ENTRY_TYPE_LABELS, type EntryType } from "@/lib/schema";

/**
 * Repairs the reply before validation.
 *
 * A model asked for strict JSON still answers honestly when a field is not in
 * the source: a CV line like "2019 — Residency at Villa Medici, Rome" has no
 * work title, so it returns `title: null`, and a CV with no name at the top
 * returns `artist.name: null`. Both are correct readings and both would fail
 * a schema that requires strings.
 *
 * Rejecting the whole batch over that would be the wrong trade: the records
 * are good, one derived field is missing. So the known-honest nulls are
 * filled in here, the same way the rule-based parser fills them, and the
 * schema stays strict for everything else.
 */

const CONNECTOR: Partial<Record<EntryType, string>> = {
  collaboration: "with",
  publication: "in",
  award: "from",
};

function titleFrom(entry: Record<string, unknown>): string | undefined {
  const type = typeof entry.type === "string" ? (entry.type as EntryType) : "other";
  const role = typeof entry.role === "string" ? entry.role.toLowerCase() : "";
  const venue = typeof entry.venue === "string" ? entry.venue.trim() : "";
  const city = typeof entry.city === "string" ? entry.city.trim() : "";

  const label =
    type === "exhibition" && (role === "solo" || role === "group")
      ? `${role[0].toUpperCase()}${role.slice(1)} exhibition`
      : (ENTRY_TYPE_LABELS[type] ?? "Record");

  if (venue) return `${label} ${CONNECTOR[type] ?? "at"} ${venue}`;
  if (city) return `${label} in ${city}`;
  return typeof entry.year === "number" || typeof entry.year === "string"
    ? `${label}, ${entry.year}`
    : undefined;
}

function blank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && !value.trim());
}

export function repairExtraction(payload: unknown, artistName?: string): unknown {
  if (typeof payload !== "object" || payload === null) return payload;

  const result = payload as { artist?: Record<string, unknown>; entries?: unknown };

  if (result.artist && blank(result.artist.name)) {
    result.artist.name = artistName?.trim() || "Untitled artist";
  }

  if (Array.isArray(result.entries)) {
    for (const raw of result.entries) {
      if (typeof raw !== "object" || raw === null) continue;
      const entry = raw as Record<string, unknown>;
      if (blank(entry.title)) {
        const derived = titleFrom(entry);
        if (derived) entry.title = derived;
      }
    }
    // A record with no title even after repair carries nothing to show.
    result.entries = result.entries.filter(
      (raw) => typeof raw === "object" && raw !== null && !blank((raw as Record<string, unknown>).title),
    );
  }

  return result;
}
