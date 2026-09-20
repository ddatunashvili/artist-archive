import Link from "next/link";

/**
 * Charts built from divs. A charting library would be the single largest
 * dependency in the project, and the dashboard only needs proportion.
 */

export type ChartRow = { key: string | number; count: number; href?: string };

export function BarList({ rows, empty = "No data yet." }: { rows: ChartRow[]; empty?: string }) {
  if (rows.length === 0) return <p className="empty">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <div className="bars">
      {rows.map((row) => (
        <div className="bar-row" key={String(row.key)}>
          <span className="bar-label" title={String(row.key)}>
            {row.href ? <Link href={row.href}>{row.key}</Link> : row.key}
          </span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }}
            />
          </span>
          <span className="bar-value">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

/** Year distribution. Sparse years are filled in so gaps stay visible. */
export function Histogram({ rows }: { rows: { key: number; count: number }[] }) {
  if (rows.length === 0) return <p className="empty">No dated records yet.</p>;

  const first = rows[0].key;
  const last = rows[rows.length - 1].key;
  const counts = new Map(rows.map((row) => [row.key, row.count]));
  const max = Math.max(...rows.map((row) => row.count), 1);

  const years: { year: number; count: number }[] = [];
  for (let year = first; year <= last; year += 1) {
    years.push({ year, count: counts.get(year) ?? 0 });
  }

  return (
    <div>
      <div className="histogram">
        {years.map(({ year, count }) => (
          <div
            key={year}
            className="col"
            style={{ height: `${(count / max) * 100}%` }}
            title={`${year}: ${count} record${count === 1 ? "" : "s"}`}
          />
        ))}
      </div>
      <div className="histogram-axis">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}

export function Stat({
  value,
  label,
  note,
}: {
  value: string | number;
  label: string;
  note?: string;
}) {
  return (
    <div className="stat">
      <span className="value">{value}</span>
      <span className="key">{label}</span>
      {note && <span className="delta">{note}</span>}
    </div>
  );
}
