import Link from "next/link";
import { Suspense } from "react";
import { getUser } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions";
import { SITE_NAME } from "@/lib/env";
import { Avatar } from "@/components/Avatar";
import { Dropdown } from "@/components/Dropdown";
import { Wordmark } from "@/components/Logo";
import { HeartIcon, SettingsIcon, ShieldIcon, SignOutIcon, UserIcon } from "@/components/Icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VideoConsentToggle } from "@/components/VideoConsent";
import { SearchBox } from "@/components/SearchBox";

export async function Header() {
  const { supabase, user } = await getUser();
  const profile = user
    ? (
        await supabase
          .from("profiles")
          .select("username,display_name,avatar_url,role,suspended_until,banned_at,ban_reason")
          .eq("id", user.id)
          .single()
      ).data
    : null;

  const isMod = !!profile && !profile.banned_at && (profile.role === "moderator" || profile.role === "admin");
  const isSuspended =
    !!profile?.suspended_until && new Date(profile.suspended_until).getTime() > Date.now();
  const isBanned = !!profile?.banned_at;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="shrink-0 rounded-md" aria-label={`${SITE_NAME} home`}>
          <Wordmark />
        </Link>

        <Suspense fallback={<div className="min-w-0 flex-1" />}>
          <SearchBox />
        </Suspense>

        <nav className="flex shrink-0 items-center gap-2">
          <Link href="/new" className="btn-primary" aria-label="Post a project">
            <span aria-hidden>+</span>
            <span className="hidden sm:inline">Post</span>
          </Link>
          {profile ? (
            <Dropdown
              label="Account menu"
              summaryClassName="block rounded-full ring-1 ring-border hover:ring-border-strong"
              panelClassName="w-60 overflow-hidden p-1 text-sm"
              summary={<Avatar author={profile} size={32} />}
            >
              <Link
                href={`/u/${profile.username}`}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-surface-2"
              >
                <Avatar author={profile} size={36} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{profile.display_name || profile.username}</span>
                  <span className="block truncate font-mono text-xs text-muted">@{profile.username}</span>
                </span>
              </Link>

              <div className="my-1 border-t border-border" />
              <MenuLink href={`/u/${profile.username}`} icon={<UserIcon />}>
                Your profile
              </MenuLink>
              <MenuLink href="/following" icon={<HeartIcon />}>
                Following
              </MenuLink>
              <MenuLink href="/settings" icon={<SettingsIcon />}>
                Settings
              </MenuLink>
              {isMod && (
                <MenuLink href="/admin" icon={<ShieldIcon />}>
                  Moderation
                </MenuLink>
              )}

              <div className="my-1 border-t border-border" />
              <ThemeToggle variant="menu" />
              <VideoConsentToggle variant="menu" />

              <div className="my-1 border-t border-border" />
              <form action={signOut}>
                <button className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-muted hover:bg-surface-2 hover:text-text">
                  <SignOutIcon />
                  Sign out
                </button>
              </form>
            </Dropdown>
          ) : (
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
          )}
        </nav>
      </div>
      {(isBanned || isSuspended) && (
        <div role="status" className="border-t border-bad/30 bg-bad/10 px-4 py-2 text-xs text-bad">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <span>
              {isBanned
                ? `Your account is banned from posting or interacting${profile?.ban_reason ? `: ${profile.ban_reason}` : "."}`
                : `Your account is suspended until ${new Date(profile!.suspended_until!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${profile?.ban_reason ? `: ${profile.ban_reason}` : "."}`}
            </span>
            <Link href="/contact" className="font-medium underline">
              Appeal or contact us
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-surface-2">
      <span className="text-muted">{icon}</span>
      {children}
    </Link>
  );
}
