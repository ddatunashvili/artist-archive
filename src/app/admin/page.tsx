import type { Metadata } from "next";
import Link from "next/link";
import { BarList, Histogram, Stat } from "@/components/Charts";
import { formatPlace, formatYears } from "@/components/EntryTable";
import { getDashboard } from "@/lib/analytics";
import { describeProvider } from "@/lib/ai";
import { ENTRY_STATUS_LABELS, ENTRY_TYPE_LABELS, type EntryStatus, type EntryType } from "@/lib/schema";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default async function AdminDashboard() {
  const data = await getDashboard();
  const provider = describeProvider();

  return (
    <>
      <h1>Dashboard</h1>
      <p className="lede">
        The archive at a glance: what is in it, where it came from, and what still needs a decision.
      </p>

      <div className="stat-grid">
        <Stat value={data.totals.entries} label="Records" note={`${data.totals.artists} artists`} />
        <Stat
          value={data.totals.published}
          label="Published"
          note={
            data.totals.entries
              ? `${percent(data.totals.published / data.totals.entries)} of the archive`
              : undefined
          }
        />
        <Stat
          value={data.totals.inReview}
          label="Awaiting review"
          note={data.totals.inReview > 0 ? "needs a decision" : "queue is clear"}
        />
        <Stat value={data.totals.rejected} label="Rejected" note="kept for the record" />
        <Stat
          value={
            data.quality.averageConfidence === null
              ? "—"
              : percent(data.quality.averageConfidence)
          }
          label="Avg confidence"
          note={`${data.quality.lowConfidence} below 70%`}
        />
        <Stat
          value={data.recentlyReviewed}
          label="Reviewed / 30 days"
          note={`extractor: ${provider.provider}`}
        />
      </div>

      {data.totals.inReview > 0 && (
        <p className="count" style={{ marginTop: 20 }}>
          <Link href="/admin/review">
            → {data.totals.inReview} record{data.totals.inReview === 1 ? "" : "s"} waiting in the
            review queue
          </Link>
        </p>
      )}

      <h2>Records by year</h2>
      <Histogram rows={data.byYear} />

      <div className="panels">
        <section>
          <h2>By type</h2>
          <BarList
            rows={data.byType.map((row) => ({
              key: ENTRY_TYPE_LABELS[row.key as EntryType] ?? row.key,
              count: row.count,
              href: `/admin/entries?type=${row.key}`,
            }))}
          />
        </section>

        <section>
          <h2>By status</h2>
          <BarList
            rows={data.byStatus.map((row) => ({
              key: ENTRY_STATUS_LABELS[row.key as EntryStatus] ?? row.key,
              count: row.count,
              href: `/admin/entries?status=${row.key}`,
            }))}
          />
        </section>

        <section>
          <h2>Top countries</h2>
          <BarList rows={data.byCountry} />
        </section>

        <section>
          <h2>Most frequent venues</h2>
          <BarList rows={data.topVenues} />
        </section>

        <section>
          <h2>Extracted by</h2>
          <BarList rows={data.byExtractor} />
        </section>

        <section>
          <h2>Field coverage</h2>
          <BarList
            rows={[
              { key: "Has country", count: Math.round(data.quality.placeCoverage * 100) },
              { key: "Has source line", count: Math.round(data.quality.sourceCoverage * 100) },
              { key: "Has link", count: Math.round(data.quality.linkCoverage * 100) },
            ]}
          />
          <p className="count">Percentage of all records.</p>
        </section>
      </div>

      <h2>Recently added</h2>
      {data.recent.length === 0 ? (
        <p className="empty">Nothing in the archive yet.</p>
      ) : (
        <table className="catalogue">
          <tbody>
            {data.recent.map((entry) => (
              <tr key={entry.id}>
                <td className="year">{formatYears(entry.year, entry.endYear)}</td>
                <td className="title">
                  <Link href={`/admin/entries/${entry.id}`}>{entry.title}</Link>
                  <div className="sub">
                    {entry.artist.name}
                    {formatPlace(entry) ? ` · ${formatPlace(entry)}` : ""}
                  </div>
                </td>
                <td className="actions-cell">
                  <span
                    className={`tag ${entry.status === "published" ? "ok" : entry.status === "rejected" ? "warn" : "flag"}`}
                  >
                    {ENTRY_STATUS_LABELS[entry.status as EntryStatus] ?? entry.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
