import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = safeRedirectPath(typeof sp.next === "string" ? sp.next : null);
  const { user } = await getUser();
  if (user) redirect(next);

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card p-6">
        <h1 className="text-xl font-bold">Sign in</h1>
        <p className="mb-5 mt-1 text-sm text-muted">We&apos;ll email you a sign-in link and code. No password needed.</p>
        {sp.error && (
          <p className="mb-4 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
            That sign-in link was invalid or expired. Request a new one below.
          </p>
        )}
        <LoginForm next={next} />
      </div>
    </div>
  );
}
