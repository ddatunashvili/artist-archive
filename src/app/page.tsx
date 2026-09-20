import Link from "next/link";
import { EntryGrid } from "@/components/EntryGrid";
import { EntryTable } from "@/components/EntryTable";
import { Filters } from "@/components/Filters";
import { QuickActions } from "@/components/QuickActions";
import { findEntries, getArchiveStats, getFilterOptions, normaliseFilters } from "@/lib/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Keeps the active filters when switching between grid and index. */
function hrefWithView(
  params: Record<string, string | string[] | undefined>,
  view: "grid" | "index",
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "view" || value === undefined) continue;
    search.set(key, Array.isArray(value) ? value[0] : value);
  }
  if (view === "index") search.set("view", "index");
  const query = search.toString();
  return query ? `/?${query}` : "/";
}

export default async function CataloguePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = normaliseFilters(params);

  const rawView = Array.isArray(params.view) ? params.view[0] : params.view;
  const view = rawView === "index" ? "index" : "grid";

  const [entries, options, stats] = await Promise.all([
    findEntries(filters),
    getFilterOptions(),
    getArchiveStats(),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Catalogue</h1>
        <p className="lede">
          {stats.published} published records across {stats.artists} artists. Each record is a
          single experience from an artist&rsquo;s CV — filter by type, year or location, and open
          any of them for the full entry and the line it was extracted from.
        </p>
      </div>

      <QuickActions pending={stats.pending} />

      <Filters options={options} active={filters} />

      <div className="toolbar">
        <p className="count" style={{ margin: 0 }}>
          {entries.length} {entries.length === 1 ? "record" : "records"}
          {stats.pending > 0 && <> · {stats.pending} awaiting review</>}
        </p>

        <div className="view-switch">
          <Link
            href={hrefWithView(params, "grid")}
            className={`pill${view === "grid" ? " on" : ""}`}
          >
            Grid
          </Link>
          <Link
            href={hrefWithView(params, "index")}
            className={`pill${view === "index" ? " on" : ""}`}
          >
            Index
          </Link>
        </div>
      </div>

      {view === "grid" ? <EntryGrid entries={entries} /> : <EntryTable entries={entries} />}
    </>
  );
}
