"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProfileValues = {
  email: string;
  role: string;
  name: string;
  title: string;
  bio: string;
  avatarUrl: string;
};

/**
 * Edits the signed-in account.
 *
 * Profile and password are one form but two decisions: the password fields
 * stay empty and are only sent when filled, so saving a bio never touches
 * credentials.
 */
export function ProfileForm({ values: initial }: { values: ProfileValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          title: values.title,
          bio: values.bio,
          avatarUrl: values.avatarUrl,
          ...(newPassword ? { currentPassword, newPassword } : {}),
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? "Could not save.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not reach the archive.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      {error && <div className="notice error">{error}</div>}
      {saved && <div className="notice ok">Profile saved.</div>}

      <div className="profile-head">
        <span className="avatar lg">
          {values.avatarUrl ? (
            // A remote URL, so next/image would need every host allow-listed.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={values.avatarUrl} alt="" />
          ) : (
            <span className="avatar-initial">{(values.name || values.email)[0]?.toUpperCase()}</span>
          )}
        </span>
        <div>
          <h2 style={{ margin: 0, border: "none", padding: 0 }}>{values.email}</h2>
          <p className="lede" style={{ margin: "6px 0 0" }}>
            Signed in as <strong>{values.role}</strong>. Your name is what appears against records
            you publish.
          </p>
        </div>
      </div>

      <div className="review-card">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="name">Display name</label>
            <input id="name" value={values.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="title">Title or role</label>
            <input
              id="title"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Archivist"
            />
          </div>

          <div className="field span-all">
            <label htmlFor="avatarUrl">Profile image URL</label>
            <input
              id="avatarUrl"
              value={values.avatarUrl}
              onChange={(e) => set("avatarUrl", e.target.value)}
              placeholder="https://example.org/portrait.jpg"
            />
          </div>

          <div className="field span-all">
            <label htmlFor="bio">About you</label>
            <textarea id="bio" rows={5} value={values.bio} onChange={(e) => set("bio", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="review-card">
        <div className="card-head">
          <h3>Change password</h3>
          <span className="tag">optional</span>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="currentPassword">Current password</label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="actions">
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
