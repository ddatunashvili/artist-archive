import Link from "next/link";
import { getSession } from "@/lib/session";

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
  const session = await getSession();

  if (!session) {
    return (
      <p className="signin-hint">
        Archivist? <Link href="/admin/login">Sign in</Link> or{" "}
        <Link href="/admin/register">create an account</Link> to import a CV and review records.
      </p>
    );
  }

  return (
    <div className="quick-actions">
      <span className="who">
        Signed in — {session.name ?? session.email} ({session.role})
      </span>
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
