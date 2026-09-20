import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

const text = (value: string | null | undefined) => value ?? "";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/admin/login?next=/admin/profile");

  const user = await findUserByEmail(session.email);

  // The owner and demo accounts come from the environment, not the user
  // table, so there is nothing to edit for them.
  if (!user) {
    return (
      <>
        <div className="page-head">
          <h1>Profile</h1>
          <p className="lede">Signed in as {session.email}.</p>
        </div>
        <div className="notice">
          This account is configured in the environment rather than stored as a record, so it has no
          editable profile. <Link href="/admin/register">Create an account</Link> to have one.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Profile</h1>
        <p className="lede">How you appear against the records you review and publish.</p>
      </div>

      <ProfileForm
        values={{
          email: user.email,
          role: user.role,
          name: text(user.name),
          title: text(user.title),
          bio: text(user.bio),
          avatarUrl: text(user.avatarUrl),
        }}
      />
    </>
  );
}
