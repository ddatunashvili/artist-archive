"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Sign-in.
 *
 * When the published demo account is enabled the fields arrive pre-filled, so
 * a reviewer reaches the archive in one click. The prefill is driven by the
 * server: configure real credentials and it disappears on its own.
 */
export function LoginForm({
  demo,
  demoEmail,
  demoPassword,
  canRegister,
  next,
}: {
  demo: boolean;
  demoEmail: string;
  demoPassword: string;
  canRegister: boolean;
  next: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(demo ? demoEmail : "");
  const [password, setPassword] = useState(demo ? demoPassword : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Sign-in failed.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-form-inner">
      <h1>Sign in</h1>
      <p className="lede">Continue to the archivist tools.</p>

      {demo && (
        <div className="demo-creds">
          Demo account, pre-filled — press sign in
          <br />
          {demoEmail}
          <br />
          {demoPassword}
        </div>
      )}

      {error && (
        <div className="notice error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {canRegister && (
        <p className="auth-alt">
          No account? <Link href="/admin/register">Create one</Link> — it takes a moment and you can
          use the archive straight away.
        </p>
      )}
    </div>
  );
}
