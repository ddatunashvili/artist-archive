import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";
import { demoAccount } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  // Only same-site paths, so ?next= cannot be used as an open redirect.
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/admin";

  // Only the demo pair is ever pre-filled; owner credentials never are.
  const demo = demoAccount();

  return (
    <div className="login-wrap">
      <h1>Admin</h1>
      <p className="lede">Sign in to manage the archive.</p>
      <LoginForm
        demo={demo.enabled}
        demoEmail={demo.enabled ? demo.email : ""}
        demoPassword={demo.enabled ? demo.password : ""}
        next={next}
      />
    </div>
  );
}
