"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type NavSession = { email: string; role: string; name?: string } | null;

const LINKS = [
  { href: "/", label: "Catalogue" },
  { href: "/artists", label: "Artists" },
  { href: "/about", label: "About" },
];

/**
 * Masthead navigation.
 *
 * Client-side only so the current section can be marked; the session is
 * resolved on the server and passed in, because the cookie is httpOnly and
 * the role must not be inferred in the browser.
 */
export function MainNav({
  session,
  canRegister,
}: {
  session: NavSession;
  canRegister: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <nav className="main-nav" aria-label="Main">
      <ul className="nav-links">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} aria-current={isCurrent(link.href) ? "page" : undefined}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <span className="nav-divide" aria-hidden="true" />

      {session ? (
        <div className="nav-auth">
          <span className="nav-who" title={session.email}>
            {session.name ?? session.email}
            <span className="nav-role">{session.role}</span>
          </span>
          <Link href="/admin" className="button small">
            Admin
          </Link>
          <button type="button" className="ghost small" onClick={signOut} disabled={busy}>
            {busy ? "…" : "Sign out"}
          </button>
        </div>
      ) : (
        <div className="nav-auth">
          <Link href="/admin/login" className="button ghost small">
            Sign in
          </Link>
          {canRegister && (
            <Link href="/admin/register" className="button small">
              Create account
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
