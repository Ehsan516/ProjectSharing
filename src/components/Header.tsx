import Link from "next/link";
import { Suspense } from "react";
import { getUser } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions";
import { SITE_NAME } from "@/lib/env";
import { Avatar } from "@/components/Avatar";
import { SearchBox } from "@/components/SearchBox";

export async function Header() {
  const { supabase, user } = await getUser();
  const profile = user
    ? (await supabase.from("profiles").select("username,display_name,avatar_url").eq("id", user.id).single()).data
    : null;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-fg">
            {SITE_NAME[0]}
          </span>
          <span className="hidden sm:inline">{SITE_NAME}</span>
        </Link>

        <Suspense fallback={<div className="min-w-0 flex-1" />}>
          <SearchBox />
        </Suspense>

        <nav className="flex shrink-0 items-center gap-2">
          <Link href="/new" className="btn-primary">
            <span aria-hidden>+</span>
            <span className="hidden sm:inline">Post</span>
          </Link>
          {profile ? (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-full">
                <Avatar author={profile} size={32} />
              </summary>
              <div className="card absolute right-0 mt-2 w-48 overflow-hidden p-1 text-sm shadow-lg">
                <Link href={`/u/${profile.username}`} className="block rounded-md px-3 py-2 hover:bg-surface-2">
                  Your projects
                </Link>
                <Link href="/settings" className="block rounded-md px-3 py-2 hover:bg-surface-2">
                  Settings
                </Link>
                <form action={signOut}>
                  <button className="w-full rounded-md px-3 py-2 text-left hover:bg-surface-2">Sign out</button>
                </form>
              </div>
            </details>
          ) : (
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
