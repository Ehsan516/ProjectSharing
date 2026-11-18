import type { Metadata } from "next";
import Link from "next/link";
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
        <p className="mb-5 mt-1 text-sm text-muted">We&apos;ll email you a sign-in link. No password needed.</p>
        {sp.error && (
          <p className="mb-4 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
            That sign-in link didn&apos;t work. Links expire after a while, can only be used once, and must be opened
            in the same browser you requested them from. Request a new one below.
          </p>
        )}
        <LoginForm next={next} />
        <p className="mt-5 text-center text-xs text-muted">
          By continuing you agree to the{" "}
          <Link href="/terms" className="underline hover:text-text">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-text">
            Privacy policy
          </Link>
          . You must be 13 or over.
        </p>
      </div>
    </div>
  );
}
