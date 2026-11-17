import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getFeed, getVotedIds, parsePage, type FeedTab } from "@/lib/queries";
import type { Profile } from "@/lib/types";
import { timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { FeedTabs } from "@/components/FeedTabs";
import { ProjectList } from "@/components/ProjectList";

type Params = Promise<{ username: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: `@${(await params).username}` };
}

export default async function ProfilePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const username = (await params).username.toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) notFound();
  const sp = await searchParams;
  const tab: FeedTab = sp.tab === "top" ? "top" : "new";
  const page = parsePage(sp.page);

  const { supabase, user } = await getUser();
  const { data } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
  const profile = data as Profile | null;
  if (!profile) notFound();

  const { projects, hasMore } = await getFeed(supabase, { tab, page, authorId: profile.id });
  const votedIds = await getVotedIds(supabase, user?.id, projects.map((p) => p.id));
  const isMe = user?.id === profile.id;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="card mb-6 flex items-start gap-4 p-5">
        <Avatar author={profile} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">{profile.display_name || `@${profile.username}`}</h1>
          <p className="text-sm text-muted">
            @{profile.username} · joined {timeAgo(profile.created_at)}
          </p>
          {profile.bio && <p className="mt-2 whitespace-pre-wrap text-sm">{profile.bio}</p>}
        </div>
        {isMe && (
          <Link href="/settings" className="btn-ghost">
            Edit profile
          </Link>
        )}
      </div>
      <FeedTabs active={tab} basePath={`/u/${profile.username}`} tabs={["new", "top"]} />
      <ProjectList
        projects={projects}
        votedIds={votedIds}
        hasMore={hasMore}
        nextHref={`/u/${profile.username}?tab=${tab}&page=${page + 1}`}
        empty={isMe ? <Link href="/new" className="text-accent hover:underline">Post your first project</Link> : "No projects yet."}
      />
    </div>
  );
}
