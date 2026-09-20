import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";
import { LoginForm } from "@/components/LoginForm";
import { demoAccounts, registrationOpen } from "@/lib/auth";
import { getSession, safeNext } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNext(Array.isArray(params.next) ? params.next[0] : params.next);

  // Already signed in: no reason to show the form again.
  if (await getSession()) redirect(next);

  // Only the demo pairs are ever offered; owner credentials never are.
  const demos = demoAccounts().map((account) => ({
    email: account.email,
    password: account.password,
    label: account.label,
    blurb: account.blurb,
  }));

  return (
    <div className="auth">
      <AuthPanel />
      <section className="auth-form">
        <LoginForm demos={demos} canRegister={registrationOpen()} next={next} />
      </section>
    </div>
  );
}
