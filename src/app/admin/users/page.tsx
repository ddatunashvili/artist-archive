import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { UserRoleSelect } from "@/components/UserRoleSelect";
import { getSession } from "@/lib/session";
import { listUsers } from "@/lib/users";

export const metadata: Metadata = { title: "Accounts" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getSession();
  // Editors have no business here; the API enforces this too.
  if (session?.role !== "admin") redirect("/admin");

  const users = await listUsers();

  return (
    <>
      <div className="toolbar">
        <div>
          <h1>Accounts</h1>
          <p className="lede" style={{ margin: 0 }}>
            {users.length} registered {users.length === 1 ? "account" : "accounts"}. Sign-up is open,
            and every new account is an editor.
          </p>
        </div>
      </div>

      {users.length === 0 ? (
        <p className="empty">
          Nobody has registered yet. The owner and demo accounts come from the environment and do
          not appear here.
        </p>
      ) : (
        <table className="catalogue">
          <thead>
            <tr>
              <th>Email</th>
              <th className="c-artist">Name</th>
              <th className="type">Role</th>
              <th className="c-venue">Registered</th>
              <th className="c-city">Last sign-in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="title">
                  <span className="t">{user.email}</span>
                </td>
                <td className="c-artist">{user.name ?? "—"}</td>
                <td className="actions-cell">
                  {/* Demoting yourself mid-session would lock you out of this
                      page, so your own row is fixed. */}
                  <UserRoleSelect
                    id={user.id}
                    role={user.role}
                    disabled={user.email === session.email}
                  />
                </td>
                <td className="c-venue">{user.createdAt.toISOString().slice(0, 10)}</td>
                <td className="c-city">
                  {user.lastLoginAt ? user.lastLoginAt.toISOString().slice(0, 10) : "never"}
                </td>
                <td className="actions-cell">
                  <DeleteButton endpoint={`/api/admin/users/${user.id}`} label="Remove" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
