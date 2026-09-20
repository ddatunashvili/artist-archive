import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Archivist shortcuts on the public catalogue.
 *
 * The workflow pages stay behind the same session gate as the rest of
 * /admin — this only shortens the path to them, so an archivist can import a
 * CV or clear the review queue without going via the dashboard first. When
 * nobody is signed in it degrades to a single sign-in line, and the public
 * page keeps doing its one job.
 */
export async function QuickActions({ pending }: { pending: number }) {
  const email = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);

  if (!email) {
    return (
      <p className="signin-hint">
        Archivist? <Link href="/admin/login">Sign in</Link> to import a CV, review records or manage
        the archive.
      </p>
    );
  }

  return (
    <div className="quick-actions">
      <span className="who">Signed in — {email}</span>
      <Link href="/admin/import" className="button">
        Import a CV
      </Link>
      <Link href="/admin/review" className="button ghost">
        Review queue{pending > 0 ? ` (${pending})` : ""}
      </Link>
      <Link href="/admin/entries/new" className="button ghost">
        New record
      </Link>
      <Link href="/admin" className="button ghost">
        Dashboard
      </Link>
    </div>
  );
}
