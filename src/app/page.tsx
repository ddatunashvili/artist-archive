import Link from "next/link";
import { EntryTable } from "@/components/EntryTable";
import { Filters } from "@/components/Filters";
import { findEntries, getArchiveStats, getFilterOptions, normaliseFilters } from "@/lib/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CataloguePage({ searchParams }: { searchParams: SearchParams }) {
  const filters = normaliseFilters(await searchParams);
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
          {stats.published} published records across {stats.artists} artists. Filter by type, year
          or location; every record keeps the CV line it came from.
        </p>
      </div>

      <Filters options={options} active={filters} />

      <p className="count">
        {entries.length} {entries.length === 1 ? "record" : "records"}
        {stats.pending > 0 && <> · {stats.pending} awaiting review</>}
      </p>

      <EntryTable entries={entries} />
    </>
  );
}
