"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminArtistSchema, fieldErrors } from "@/lib/schema";

export type ArtistFormValues = {
  id?: string;
  name: string;
  slug: string;
  birthYear: string;
  deathYear: string;
  nationality: string;
  basedIn: string;
  website: string;
  bio: string;
};

export const EMPTY_ARTIST_FORM: ArtistFormValues = {
  name: "",
  slug: "",
  birthYear: "",
  deathYear: "",
  nationality: "",
  basedIn: "",
  website: "",
  bio: "",
};

export function ArtistForm({ values: initial }: { values: ArtistFormValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  const isEdit = Boolean(values.id);

  function set<K extends keyof ArtistFormValues>(key: K, value: ArtistFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setIssues([]);

    const payload = {
      name: values.name,
      slug: values.slug,
      birthYear: values.birthYear,
      deathYear: values.deathYear,
      nationality: values.nationality,
      basedIn: values.basedIn,
      website: values.website,
      bio: values.bio,
    };

    const check = AdminArtistSchema.safeParse(payload);
    if (!check.success) {
      setIssues(fieldErrors(check.error).map((issue) => `${issue.path}: ${issue.message}`));
      setError("Fix the highlighted fields.");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch(
        isEdit ? `/api/admin/artists/${values.id}` : "/api/admin/artists",
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
      router.push("/admin/artists");
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
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" value={values.name} onChange={(e) => set("name", e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="slug">Address (leave blank to derive)</label>
            <input id="slug" value={values.slug} onChange={(e) => set("slug", e.target.value)} placeholder="nino-abashidze" />
          </div>

          <div className="field">
            <label htmlFor="birthYear">Born</label>
            <input id="birthYear" value={values.birthYear} onChange={(e) => set("birthYear", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="deathYear">Died</label>
            <input id="deathYear" value={values.deathYear} onChange={(e) => set("deathYear", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="nationality">Nationality</label>
            <input id="nationality" value={values.nationality} onChange={(e) => set("nationality", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="basedIn">Based in</label>
            <input id="basedIn" value={values.basedIn} onChange={(e) => set("basedIn", e.target.value)} />
          </div>

          <div className="field span-all">
            <label htmlFor="website">Website</label>
            <input id="website" value={values.website} onChange={(e) => set("website", e.target.value)} />
          </div>

          <div className="field span-all">
            <label htmlFor="bio">Biography</label>
            <textarea id="bio" rows={5} value={values.bio} onChange={(e) => set("bio", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="actions">
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : isEdit ? "Save changes" : "Create artist"}
        </button>
        <button type="button" className="ghost" onClick={() => router.push("/admin/artists")} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
