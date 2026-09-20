import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SignOutButton } from "@/components/SignOutButton";
import { SESSION_COOKIE, isDemoAccount, verifySessionToken } from "@/lib/auth";

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
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Access is enforced in middleware; this only decides whether to draw the
  // toolbar, so the login page does not render a signed-in chrome.
  const email = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);

  return (
    <>
      {email && (
        <div className="admin-bar">
          <div className="shell row">
            <nav>
              {LINKS.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="actions">
              <span style={{ opacity: 0.68 }}>{email}</span>
              {isDemoAccount(email) && <span className="tag solid">demo account</span>}
              <SignOutButton />
            </div>
          </div>
        </div>
      )}
      <div style={{ paddingTop: email ? 36 : 0 }}>{children}</div>
    </>
  );
}
