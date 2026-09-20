"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Prototype sign-in. When the deployment is still on the demo account the
 * fields arrive pre-filled, so a reviewer can reach the admin panel in one
 * click. `demo` is false as soon as real credentials are configured, and the
 * hint disappears with it.
 */
export function LoginForm({
  demo,
  demoEmail,
  demoPassword,
  next,
}: {
  demo: boolean;
  demoEmail: string;
  demoPassword: string;
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
    <form onSubmit={submit}>
      {demo && (
        <div className="demo-creds">
          Demo account, pre-filled
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
  );
}
