"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Two-step delete. The first click arms the button and the second commits,
 * so a mis-click in a dense table cannot remove a record.
 */
export function DeleteButton({
  endpoint,
  label = "Delete",
  confirmLabel = "Confirm",
  warning,
}: {
  endpoint: string;
  label?: string;
  confirmLabel?: string;
  warning?: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 5000);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Delete failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the archive.");
    } finally {
      setBusy(false);
      setArmed(false);
    }
  }

  return (
    <>
      <button type="button" className="ghost danger" onClick={remove} disabled={busy}>
        {busy ? "Deleting…" : armed ? confirmLabel : label}
      </button>
      {armed && warning && (
        <span className="tag warn" style={{ marginLeft: 8 }}>
          {warning}
        </span>
      )}
      {error && (
        <span className="tag warn" style={{ marginLeft: 8 }}>
          {error}
        </span>
      )}
    </>
  );
}
