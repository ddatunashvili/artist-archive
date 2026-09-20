import type { Metadata } from "next";
import Link from "next/link";
import { DeleteButton } from "@/components/DeleteButton";
import { formatPlace, formatYears } from "@/components/EntryTable";
import { findAdminEntries, normaliseFilters } from "@/lib/queries";
import {
  ENTRY_STATUSES,
  ENTRY_STATUS_LABELS,
  ENTRY_TYPE_LABELS,
  type EntryStatus,
  type EntryType,
} from "@/lib/schema";

export const metadata: Metadata = { title: "Records" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function statusClass(status: string): string {
  if (status === "published") return "ok";
  if (status === "rejected") return "warn";
  return "flag";
}

export default async function AdminEntriesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const base = normaliseFilters(params);

  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const status =
    rawStatus && (ENTRY_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as EntryStatus)
      : "all";

  const entries = await findAdminEntries({ ...base, status });

  const tabs: { key: string; label: string }[] = [
    { key: "all", label: "All" },
    ...ENTRY_STATUSES.map((value) => ({ key: value, label: ENTRY_STATUS_LABELS[value] })),
  ];

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Records</h1>
          <p className="lede" style={{ margin: 0 }}>
            Every record in the archive, whatever its status.
          </p>
        </div>
        <Link href="/admin/entries/new" className="button">
          New record
        </Link>
      </div>

      <form className="filters" method="get" action="/admin/entries">
        <div className="field">
          <label htmlFor="q">Search</label>
          <input id="q" name="q" type="search" defaultValue={base.q ?? ""} placeholder="Title, venue…" />
        </div>
        <input type="hidden" name="status" value={status} />
        <div className="actions">
          <button type="submit">Search</button>
          {base.q && (
            <Link href={`/admin/entries?status=${status}`} className="button ghost">
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="pill-row">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/entries?status=${tab.key}${base.q ? `&q=${encodeURIComponent(base.q)}` : ""}`}
            className={`pill${status === tab.key ? " on" : ""}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <p className="count">
        {entries.length} {entries.length === 1 ? "record" : "records"}
      </p>

      {entries.length === 0 ? (
        <p className="empty">No records match.</p>
      ) : (
        <table className="catalogue">
          <thead>
            <tr>
              <th>Year</th>
              <th>Title / Artist</th>
              <th className="type">Type</th>
              <th className="place">Place</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="year">{formatYears(entry.year, entry.endYear)}</td>
                <td className="title">
                  <Link href={`/admin/entries/${entry.id}`}>{entry.title}</Link>
                  <div className="sub">{entry.artist.name}</div>
                </td>
                <td className="type">
                  <span className="tag">
                    {ENTRY_TYPE_LABELS[entry.type as EntryType] ?? entry.type}
                  </span>
                </td>
                <td className="place">{formatPlace(entry) || "—"}</td>
                <td className="actions-cell">
                  <span className={`tag ${statusClass(entry.status)}`}>
                    {ENTRY_STATUS_LABELS[entry.status as EntryStatus] ?? entry.status}
                  </span>
                </td>
                <td className="actions-cell">
                  <DeleteButton endpoint={`/api/admin/entries/${entry.id}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
