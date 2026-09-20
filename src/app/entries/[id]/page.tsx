import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPlace, formatYears } from "@/components/EntryTable";
import { getEntry } from "@/lib/queries";
import {
  ENTRY_STATUS_LABELS,
  ENTRY_TYPE_LABELS,
  type EntryStatus,
  type EntryType,
} from "@/lib/schema";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const entry = await getEntry((await params).id);
  return { title: entry ? `${entry.title} (${entry.year})` : "Record not found" };
}

export default async function EntryPage({ params }: { params: Params }) {
  const entry = await getEntry((await params).id);
  if (!entry) notFound();

  const place = formatPlace(entry);
  const status = entry.status as EntryStatus;

  return (
    <article>
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

      {entry.description && <p style={{ maxWidth: "64ch" }}>{entry.description}</p>}

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

      {entry.sourceText && (
        <>
          <h2>Source line</h2>
          <blockquote className="source">{entry.sourceText}</blockquote>
        </>
      )}
    </article>
  );
}
