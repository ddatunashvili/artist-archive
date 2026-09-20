"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ENTRY_TYPE_LABELS, type EntryType } from "@/lib/schema";

export type PendingEntry = {
  id: string;
  title: string;
  type: string;
  year: number;
  endYear: number | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  role: string | null;
  confidence: number | null;
  sourceText: string | null;
  extractedBy: string | null;
  status: string;
  artistName: string;
  artistSlug: string;
};

/**
 * Second review gate. Records saved as "in review" sit here until a named
 * reviewer publishes or rejects them; nothing here is visible in the
 * public catalogue.
 */
export function ReviewQueue({ entries }: { entries: PendingEntry[] }) {
  const router = useRouter();
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, status: "published" | "rejected") {
    if (!reviewer.trim()) {
      setError("Enter your name as reviewer first.");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/entries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewedBy: reviewer, reviewNote: note[id] || undefined }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Could not update the record.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the archive.");
    } finally {
      setBusyId(null);
    }
  }

  if (entries.length === 0) {
    return <p className="empty">Nothing waiting. Every record has been reviewed.</p>;
  }

  return (
    <div className="stack">
      {error && <div className="notice error">{error}</div>}

      <div className="review-card">
        <div className="field">
          <label htmlFor="reviewer">Reviewer name</label>
          <input
            id="reviewer"
            value={reviewer}
            onChange={(event) => setReviewer(event.target.value)}
            placeholder="Who is signing off"
          />
        </div>
      </div>

      {entries.map((entry) => (
        <div key={entry.id} className="review-card">
          <div className="card-head">
            <div>
              <h3>{entry.title}</h3>
              <div className="sub meta" style={{ fontSize: 13, color: "var(--muted)" }}>
                {entry.artistName} ·{" "}
                {entry.endYear && entry.endYear !== entry.year
                  ? `${entry.year}–${entry.endYear}`
                  : entry.year}{" "}
                · {[entry.venue, entry.city, entry.country].filter(Boolean).join(", ") || "no place"}
              </div>
            </div>
            <div className="actions">
              <span className="tag">{ENTRY_TYPE_LABELS[entry.type as EntryType] ?? entry.type}</span>
              <span className={`tag ${entry.confidence !== null && entry.confidence < 0.7 ? "flag" : ""}`}>
                {entry.confidence === null
                  ? "no score"
                  : `confidence ${Math.round(entry.confidence * 100)}%`}
              </span>
              <span className="tag">{entry.extractedBy ?? "manual"}</span>
            </div>
          </div>

          {entry.sourceText && <blockquote className="source">{entry.sourceText}</blockquote>}

          <div className="actions" style={{ marginTop: 12 }}>
            <input
              placeholder="Review note (optional)"
              style={{ flex: "1 1 240px" }}
              value={note[entry.id] ?? ""}
              onChange={(event) => setNote({ ...note, [entry.id]: event.target.value })}
            />
            <button type="button" onClick={() => decide(entry.id, "published")} disabled={busyId === entry.id}>
              Publish
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => decide(entry.id, "rejected")}
              disabled={busyId === entry.id}
            >
              Reject
            </button>
            <a className="button ghost" href={`/entries/${entry.id}`}>
              Open
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
