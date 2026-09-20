"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type NavSession = {
  email: string;
  role: string;
  name?: string;
  avatarUrl?: string | null;
} | null;

const LINKS = [
  { href: "/", label: "Catalogue" },
  { href: "/artists", label: "Artists" },
  { href: "/about", label: "About" },
];

function Avatar({ session }: { session: NonNullable<NavSession> }) {
  const label = session.name ?? session.email;
  return (
    <span className="avatar" aria-hidden="true">
      {session.avatarUrl ? (
        // Remote URL: next/image would need every host allow-listed up front.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={session.avatarUrl} alt="" />
      ) : (
        <span className="avatar-initial">{label[0]?.toUpperCase()}</span>
      )}
    </span>
  );
}

/**
 * Masthead navigation.
 *
 * Client-side so the current section can be marked and so the menu can
 * collapse on a phone; the session is resolved on the server and passed in,
 * because the cookie is httpOnly and a role must not be inferred in the
 * browser.
 */
export function MainNav({ session, canRegister }: { session: NavSession; canRegister: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  // A menu left open across a navigation would cover the page you asked for.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
    <>
      <button
        type="button"
        className="nav-toggle ghost small"
        aria-expanded={open}
        aria-controls="main-nav"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close" : "Menu"}
      </button>

      <nav id="main-nav" className={`main-nav${open ? " open" : ""}`} aria-label="Main">
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
            <Link href="/admin/profile" className="nav-who" title={session.email}>
              <Avatar session={session} />
              <span className="nav-name">{session.name ?? session.email}</span>
              <span className="nav-role">{session.role}</span>
            </Link>
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
    </>
  );
}
