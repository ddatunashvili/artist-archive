"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ENTRY_STATUSES,
  ENTRY_STATUS_LABELS,
  ENTRY_TYPE_LABELS,
  type EntryStatus,
  type EntryType,
} from "@/lib/schema";

export type AdminRow = {
  id: string;
  title: string;
  type: string;
  year: number;
  endYear: number | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  status: string;
  artistName: string;
};

function statusClass(status: string): string {
  if (status === "published") return "ok";
  if (status === "rejected") return "warn";
  return "flag";
}

function place(row: AdminRow): string {
  return [row.venue, row.city, row.country].filter(Boolean).join(", ");
}

/**
 * The record list, with editing in place.
 *
 * Status is the field that changes most often and the one least worth opening
 * a form for, so it is a control in the row. Selection plus a bulk bar covers
 * the other half: clearing a review queue one round-trip at a time is how a
 * queue stops getting cleared.
 *
 * The reviewer recorded against a published record is the signed-in account,
 * filled in by the server — there is nothing to type here.
 */
export function AdminEntriesTable({ rows }: { rows: AdminRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)));
  }

  async function setStatus(id: string, status: string) {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/entries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Could not change the status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the archive.");
    } finally {
      setBusy(null);
    }
  }

  async function bulk(action: string) {
    if (selected.size === 0) return;

    // Deleting many rows is the one action worth a second press.
    if (action === "delete" && !armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 5000);
      return;
    }

    setBusy("bulk");
    setError(null);
    try {
      const response = await fetch("/api/admin/entries/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], action }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "That action failed.");
        return;
      }
      setSelected(new Set());
      router.refresh();
    } catch {
      setError("Could not reach the archive.");
    } finally {
      setBusy(null);
      setArmed(false);
    }
  }

  if (rows.length === 0) return <p className="empty">No records match.</p>;

  return (
    <>
      {error && <div className="notice error">{error}</div>}

      <div className={`bulk-bar${selected.size > 0 ? " on" : ""}`}>
        <span className="count" style={{ margin: 0 }}>
          {selected.size > 0
            ? `${selected.size} selected`
            : "Select records for a bulk change"}
        </span>

        <div className="actions">
          {ENTRY_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className="ghost small"
              disabled={selected.size === 0 || busy !== null}
              onClick={() => bulk(status)}
            >
              {ENTRY_STATUS_LABELS[status]}
            </button>
          ))}
          <button
            type="button"
            className="ghost danger small"
            disabled={selected.size === 0 || busy !== null}
            onClick={() => bulk("delete")}
          >
            {armed ? "Confirm delete" : "Delete"}
          </button>
        </div>
      </div>

      <table className="catalogue">
        <thead>
          <tr>
            <th className="tick">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all records"
              />
            </th>
            <th>Year</th>
            <th>Title / Artist</th>
            <th className="type">Type</th>
            <th className="c-venue">Place</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={selected.has(row.id) ? "picked" : undefined}>
              <td className="tick">
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                  aria-label={`Select ${row.title}`}
                />
              </td>
              <td className="year">
                {row.endYear && row.endYear !== row.year ? `${row.year}–${row.endYear}` : row.year}
              </td>
              <td className="title">
                <Link href={`/admin/entries/${row.id}`}>{row.title}</Link>
                <div className="sub">{row.artistName}</div>
              </td>
              <td className="type">
                <span className="tag">{ENTRY_TYPE_LABELS[row.type as EntryType] ?? row.type}</span>
              </td>
              <td className="c-venue">{place(row) || "—"}</td>
              <td className="actions-cell">
                <select
                  className={`status-pick ${statusClass(row.status)}`}
                  value={row.status}
                  disabled={busy === row.id}
                  onChange={(event) => setStatus(row.id, event.target.value)}
                  aria-label={`Status of ${row.title}`}
                >
                  {ENTRY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {ENTRY_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="actions-cell">
                <Link href={`/admin/entries/${row.id}`} className="button ghost small">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
