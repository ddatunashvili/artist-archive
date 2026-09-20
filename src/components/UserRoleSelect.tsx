"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLES } from "@/lib/auth";

/**
 * Promotes or demotes an account.
 *
 * The API already refused role changes from anyone but an admin; this is the
 * control that was missing, so promotion no longer means editing the database
 * by hand.
 */
export function UserRoleSelect({
  id,
  role,
  disabled,
}: {
  id: string;
  role: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Could not change the role.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the archive.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <select
        className={`status-pick ${role === "admin" ? "ok" : ""}`}
        value={role}
        disabled={busy || disabled}
        onChange={(event) => change(event.target.value)}
        aria-label="Role"
      >
        {ROLES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      {error && (
        <span className="tag warn" style={{ marginLeft: 8 }}>
          {error}
        </span>
      )}
    </>
  );
}
