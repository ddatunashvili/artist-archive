"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Open registration.
 *
 * Anyone can create an account and try the archive. New accounts are always
 * "editor": they can import, review, publish and edit, but not delete an
 * artist or manage other accounts — so an open sign-up cannot empty a shared
 * demo. The rule lives on the server; this form only explains it.
 */
export function RegisterForm({
  minPasswordLength,
  next,
}: {
  minPasswordLength: number;
  next: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  const tooShort = password.length > 0 && password.length < minPasswordLength;
  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIssues([]);

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, email, password }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.error ?? "Registration failed.");
        if (Array.isArray(body.details)) {
          setIssues(
            body.details.map((d: { path: string; message: string }) => `${d.path}: ${d.message}`),
          );
        }
        return;
      }

      // The API signs the new account in, so go straight to the tools.
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
      <h1>Create an account</h1>
      <p className="lede">Open to anyone who wants to try the prototype.</p>

      {error && (
        <div className="notice error" style={{ marginBottom: 16 }}>
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

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="name">Name — shown as the reviewer on records you publish</label>
          <input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
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
            autoComplete="new-password"
            minLength={minPasswordLength}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <span className="hint">
            {tooShort
              ? `${minPasswordLength - password.length} more characters needed`
              : `At least ${minPasswordLength} characters`}
          </span>
        </div>

        <div className="field">
          <label htmlFor="confirm">Repeat password</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
          {mismatch && <span className="hint">The two passwords do not match</span>}
        </div>

        <button type="submit" disabled={busy || tooShort || mismatch} style={{ width: "100%" }}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="auth-alt">
        New accounts can import, review, publish and edit. Deleting an artist and managing accounts
        stay with an admin.
        <br />
        <br />
        Already registered? <Link href="/admin/login">Sign in</Link>
      </p>
    </div>
  );
}
