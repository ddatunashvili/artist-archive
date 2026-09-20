"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminEntrySchema,
  ENTRY_STATUSES,
  ENTRY_STATUS_LABELS,
  ENTRY_TYPES,
  ENTRY_TYPE_LABELS,
  fieldErrors,
  parseImageList,
} from "@/lib/schema";

export type EntryFormValues = {
  id?: string;
  artistId: string;
  type: string;
  title: string;
  role: string;
  year: string;
  endYear: string;
  venue: string;
  city: string;
  country: string;
  url: string;
  description: string;
  status: string;
  reviewedBy: string;
  reviewNote: string;
  sourceText: string;
  /** One image URL per line. */
  images: string;
};

export const EMPTY_ENTRY: EntryFormValues = {
  artistId: "",
  type: "exhibition",
  title: "",
  role: "",
  year: String(new Date().getFullYear()),
  endYear: "",
  venue: "",
  city: "",
  country: "",
  url: "",
  description: "",
  status: "in_review",
  reviewedBy: "",
  reviewNote: "",
  sourceText: "",
  images: "",
};

/** Create and edit share one form; `values.id` decides which verb is used. */
export function EntryForm({
  values: initial,
  artists,
}: {
  values: EntryFormValues;
  artists: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  const isEdit = Boolean(values.id);

  function set<K extends keyof EntryFormValues>(key: K, value: EntryFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setIssues([]);

    const payload = {
      artistId: values.artistId,
      type: values.type,
      title: values.title,
      role: values.role,
      year: values.year,
      endYear: values.endYear,
      venue: values.venue,
      city: values.city,
      country: values.country,
      url: values.url,
      description: values.description,
      status: values.status,
      reviewedBy: values.reviewedBy,
      reviewNote: values.reviewNote,
      sourceText: values.sourceText,
      extractedBy: "manual",
      // Sent as the complete set: whatever is in the box replaces what the
      // record had.
      images: parseImageList(values.images),
    };

    const check = AdminEntrySchema.safeParse(payload);
    if (!check.success) {
      setIssues(fieldErrors(check.error).map((issue) => `${issue.path}: ${issue.message}`));
      setError("Fix the highlighted fields.");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch(
        isEdit ? `/api/admin/entries/${values.id}` : "/api/admin/entries",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "Save failed.");
        if (Array.isArray(body.details)) {
          setIssues(body.details.map((d: { path: string; message: string }) => `${d.path}: ${d.message}`));
        }
        return;
      }
      router.push("/admin/entries");
      router.refresh();
    } catch {
      setError("Could not reach the archive.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      {error && (
        <div className="notice error">
          {error}
          {issues.length > 0 && (
            <ul className="errors">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="review-card">
        <div className="form-grid">
          <div className="field span-all">
            <label htmlFor="title">Title</label>
            <input id="title" value={values.title} onChange={(e) => set("title", e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="artistId">Artist</label>
            <select id="artistId" value={values.artistId} onChange={(e) => set("artistId", e.target.value)} required>
              <option value="">Choose…</option>
              {artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="type">Type</label>
            <select id="type" value={values.type} onChange={(e) => set("type", e.target.value)}>
              {ENTRY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ENTRY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="role">Role</label>
            <input id="role" value={values.role} onChange={(e) => set("role", e.target.value)} placeholder="solo, group…" />
          </div>

          <div className="field">
            <label htmlFor="year">Year</label>
            <input id="year" value={values.year} onChange={(e) => set("year", e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="endYear">End year</label>
            <input id="endYear" value={values.endYear} onChange={(e) => set("endYear", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="venue">Venue</label>
            <input id="venue" value={values.venue} onChange={(e) => set("venue", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="city">City</label>
            <input id="city" value={values.city} onChange={(e) => set("city", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="country">Country</label>
            <input id="country" value={values.country} onChange={(e) => set("country", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="url">Link</label>
            <input id="url" value={values.url} onChange={(e) => set("url", e.target.value)} />
          </div>

          <div className="field span-all">
            <label htmlFor="description">Description</label>
            <textarea id="description" rows={3} value={values.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="review-card">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" value={values.status} onChange={(e) => set("status", e.target.value)}>
              {ENTRY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ENTRY_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="reviewedBy">Reviewer (required to publish)</label>
            <input id="reviewedBy" value={values.reviewedBy} onChange={(e) => set("reviewedBy", e.target.value)} />
          </div>

          <div className="field span-all">
            <label htmlFor="reviewNote">Review note</label>
            <input id="reviewNote" value={values.reviewNote} onChange={(e) => set("reviewNote", e.target.value)} />
          </div>

          <div className="field span-all">
            <label htmlFor="sourceText">Source CV line</label>
            <input id="sourceText" value={values.sourceText} onChange={(e) => set("sourceText", e.target.value)} />
          </div>

          <div className="field span-all">
            <label htmlFor="images">Images — one URL per line</label>
            <textarea
              id="images"
              rows={4}
              value={values.images}
              onChange={(e) => set("images", e.target.value)}
              placeholder={"https://example.org/install-view-01.jpg\nhttps://example.org/install-view-02.jpg"}
            />
          </div>
        </div>
      </div>

      <div className="actions">
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : isEdit ? "Save changes" : "Create record"}
        </button>
        <button type="button" className="ghost" onClick={() => router.push("/admin/entries")} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
