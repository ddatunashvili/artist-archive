"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type DemoOption = {
  email: string;
  password: string;
  label: string;
  blurb: string;
};

/**
 * Sign-in.
 *
 * The published demo accounts are offered as buttons rather than a single
 * pre-filled pair, because the two roles behave differently and which one you
 * pick decides what you are allowed to do. The first is filled in on load so
 * the one-click path still exists.
 */
export function LoginForm({
  demos,
  canRegister,
  next,
}: {
  demos: DemoOption[];
  canRegister: boolean;
  next: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(demos[0]?.email ?? "");
  const [password, setPassword] = useState(demos[0]?.password ?? "");
  const [picked, setPicked] = useState(demos[0]?.label ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function use(demo: DemoOption) {
    setEmail(demo.email);
    setPassword(demo.password);
    setPicked(demo.label);
    setError(null);
  }

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

      {demos.length > 0 && (
        <div className="demo-picker">
          <span className="demo-picker-head">Try it — pick a role</span>
          <div className="demo-options">
            {demos.map((demo) => (
              <button
                key={demo.email}
                type="button"
                className={`demo-option${picked === demo.label ? " on" : ""}`}
                onClick={() => use(demo)}
                disabled={busy}
              >
                <strong>{demo.label}</strong>
                <span>{demo.blurb}</span>
                <code>{demo.email}</code>
              </button>
            ))}
          </div>
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
            onChange={(event) => {
              setEmail(event.target.value);
              setPicked("");
            }}
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
            onChange={(event) => {
              setPassword(event.target.value);
              setPicked("");
            }}
            required
          />
        </div>

        <button type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Signing in…" : picked ? `Sign in as ${picked.toLowerCase()}` : "Sign in"}
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
