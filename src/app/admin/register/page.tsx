import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";
import { RegisterForm } from "@/components/RegisterForm";
import { registrationOpen } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { getSession, safeNext } from "@/lib/session";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNext(Array.isArray(params.next) ? params.next[0] : params.next);

  if (await getSession()) redirect(next);
  if (!registrationOpen()) redirect("/admin/login");

  return (
    <div className="auth">
      <AuthPanel />
      <section className="auth-form">
        <RegisterForm minPasswordLength={MIN_PASSWORD_LENGTH} next={next} />
      </section>
    </div>
  );
}
