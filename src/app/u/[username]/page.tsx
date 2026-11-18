import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getFeed, getReactions, parsePage, type FeedTab } from "@/lib/queries";
import type { Profile } from "@/lib/types";
import { formatCount } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { FeedTabs } from "@/components/FeedTabs";
import { ProjectList } from "@/components/ProjectList";
import { TagChip } from "@/components/TagChip";
import { TimeAgo } from "@/components/TimeAgo";

type Params = Promise<{ username: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: `@${(await params).username}` };
}

type ActivityRow = {
  id: string;
  version: string;
  created_at: string;
  project: { id: string; title: string; created_at: string } | null;
};

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

  const [{ projects, hasMore }, { data: statRows }, { data: activityRows }] = await Promise.all([
    getFeed(supabase, { tab, page, authorId: profile.id }),
    supabase.from("projects").select("download_count,like_count,tags").eq("author_id", profile.id).limit(1000),
    supabase
      .from("project_releases")
      .select("id,version,created_at,project:projects!project_releases_project_id_fkey!inner(id,title,created_at,author_id)")
      .eq("project.author_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const reactions = await getReactions(supabase, user?.id, projects.map((p) => p.id));
  const isMe = user?.id === profile.id;

  const rows = (statRows ?? []) as { download_count: number; like_count: number; tags: string[] }[];
  const stats = {
    projects: rows.length,
    downloads: rows.reduce((n, r) => n + r.download_count, 0),
    likes: rows.reduce((n, r) => n + r.like_count, 0),
  };
  // The topics this person builds for, most used first.
  const tagCounts = new Map<string, number>();
  for (const r of rows) for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const topics = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const activity = ((activityRows ?? []) as unknown as ActivityRow[]).filter((a) => a.project);
  const name = profile.display_name || profile.username;

  return (
    <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Who they are */}
      <aside className="flex flex-col gap-5">
        <div className="flex items-center gap-4 lg:flex-col lg:items-start">
          <div className="lg:hidden">
            <Avatar author={profile} size={72} />
          </div>
          <div className="hidden lg:block">
            <Avatar author={profile} size={220} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold leading-tight">{name}</h1>
            <p className="font-mono text-sm text-muted">@{profile.username}</p>
          </div>
        </div>

        {profile.bio && <p className="whitespace-pre-wrap text-sm leading-relaxed">{profile.bio}</p>}

        {isMe && (
          <Link href="/settings" className="btn-ghost w-full">
            Edit profile
          </Link>
        )}

        <dl className="grid grid-cols-3 gap-2 border-y border-border py-4 text-center lg:text-left">
          <Stat label="Projects" value={stats.projects} />
          <Stat label="Downloads" value={stats.downloads} />
          <Stat label="Likes" value={stats.likes} />
        </dl>

        {topics.length > 0 && (
          <section>
            <h2 className="eyebrow mb-2">Builds for</h2>
            <div className="flex flex-wrap gap-1.5">
              {topics.map(([tag]) => (
                <TagChip key={tag} tag={tag} />
              ))}
            </div>
          </section>
        )}

        <p className="text-xs text-muted">
          <TimeAgo iso={profile.created_at} prefix="Joined " />
        </p>
      </aside>

      {/* Their work */}
      <section className="flex min-w-0 flex-col gap-10">
        <div>
          <div className="mb-1 flex items-baseline gap-2">
            <h2 className="text-xl font-bold">Projects</h2>
            <span className="rounded bg-surface-2 px-1.5 font-mono text-xs text-muted">{stats.projects}</span>
          </div>
          <FeedTabs active={tab} basePath={`/u/${profile.username}`} tabs={["new", "top"]} />
          <ProjectList
            projects={projects}
            reactions={reactions}
            hasMore={hasMore}
            nextHref={`/u/${profile.username}?tab=${tab}&page=${page + 1}`}
            empty={
              isMe ? (
                <>
                  You haven&apos;t posted anything yet.{" "}
                  <Link href="/new" className="text-accent hover:underline">
                    Post your first project
                  </Link>
                  .
                </>
              ) : (
                `${name} hasn't posted any projects yet.`
              )
            }
          />
        </div>

        {activity.length > 0 && (
          <div>
            <h2 className="mb-3 text-xl font-bold">Recent activity</h2>
            <ol className="card divide-y divide-border">
              {activity.map((a) => {
                const isFirst = new Date(a.created_at).getTime() - new Date(a.project!.created_at).getTime() < 60_000;
                return (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span
                      aria-hidden
                      className={`h-2 w-2 shrink-0 rounded-full ${isFirst ? "bg-signal" : "bg-border-strong"}`}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {isFirst ? "Posted " : "Published "}
                      <span className="font-mono text-xs">v{a.version}</span> of{" "}
                      <Link href={`/p/${a.project!.id}`} className="font-medium hover:underline">
                        {a.project!.title}
                      </Link>
                    </span>
                    <TimeAgo iso={a.created_at} className="shrink-0 text-xs text-muted" />
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-lg font-medium">{formatCount(value)}</dd>
    </div>
  );
}
