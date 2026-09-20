import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { isDemoAccount } from "@/lib/auth";
import { getSession } from "@/lib/session";

// The admin panel must never be indexed, whatever robots.txt says.
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s — Admin — aeitos archive" },
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/entries", label: "Records" },
  { href: "/admin/artists", label: "Artists" },
  { href: "/admin/review", label: "Review" },
  { href: "/admin/import", label: "Import" },
  { href: "/admin/profile", label: "Profile" },
];

// Admin-only destinations, appended when the session allows them.
const ADMIN_LINKS = [{ href: "/admin/users", label: "Accounts" }];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Access is enforced in middleware; this only decides whether to draw the
  // toolbar, so the login page does not render a signed-in chrome.
  const session = await getSession();

  return (
    <>
      {session && (
        <div className="admin-bar">
          <div className="shell row">
            <nav>
              {[...LINKS, ...(session.role === "admin" ? ADMIN_LINKS : [])].map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="actions">
              <span style={{ opacity: 0.68 }}>{session.name ?? session.email}</span>
              <span className="tag solid">{session.role}</span>
              {isDemoAccount(session.email) && <span className="tag solid">demo</span>}
              <SignOutButton />
            </div>
          </div>
        </div>
      )}
      <div style={{ paddingTop: session ? 36 : 0 }}>{children}</div>
    </>
  );
}
