import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import {
  getFeed,
  getFollowedProjectIds,
  getFollowedTags,
  getPopularTags,
  getReactions,
  parsePage,
  type FeedTab,
} from "@/lib/queries";
import { FeedTabs } from "@/components/FeedTabs";
import { ProjectList } from "@/components/ProjectList";
import { Sidebar } from "@/components/Sidebar";
import { TagChip } from "@/components/TagChip";
import { SITE_NAME } from "@/lib/env";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, user } = await getUser();
  const [followedTags, followedProjectIds] = await Promise.all([
    getFollowedTags(supabase, user?.id),
    getFollowedProjectIds(supabase, user?.id),
  ]);
  const followsAnything = followedTags.length > 0 || followedProjectIds.length > 0;

  const requested = params.tab as FeedTab | undefined;
  const defaultTab: FeedTab = followsAnything ? "foryou" : "new";
  const tab: FeedTab = requested && ["foryou", "new", "top"].includes(requested) ? requested : defaultTab;
  const page = parsePage(params.page);

  const needsFollows = tab === "foryou" && !followsAnything;
  const [{ projects, hasMore }, popularTags] = await Promise.all([
    needsFollows ? Promise.resolve({ projects: [], hasMore: false }) : getFeed(supabase, { tab, page, followedTags, followedProjectIds }),
    getPopularTags(supabase, 24),
  ]);
  const reactions = await getReactions(supabase, user?.id, projects.map((p) => p.id));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <section className="min-w-0">
        {params.account === "deleted" && (
          <p role="status" className="panel mb-6 p-4 text-sm">
            Your account and everything you posted have been deleted.
          </p>
        )}
        {!user && page === 0 && (
          <div className="panel mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">Fan-made software, all in one feed.</h1>
              <p className="mt-1 text-sm text-muted">
                Mods, romhacks, tools and tweaks for the games and devices you love. Watch a preview, see if it
                worked for other people, download it.
              </p>
              {popularTags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {popularTags.slice(0, 6).map((t) => (
                    <TagChip key={t.tag} tag={t.tag} />
                  ))}
                </div>
              )}
            </div>
            <Link href="/login?next=/" className="btn-primary shrink-0">
              Join {SITE_NAME}
            </Link>
          </div>
        )}
        <FeedTabs active={tab} basePath="/" />
        <ProjectList
          projects={projects}
          reactions={reactions}
          hasMore={hasMore}
          nextHref={`/?tab=${tab}&page=${page + 1}`}
          empty={
            needsFollows ? (
              user ? (
                <>
                  Your feed shows new projects in tags you follow, plus updates to projects you follow. Pick a few
                  from Popular tags to get started, or browse{" "}
                  <Link href="/?tab=new" className="text-accent hover:underline">
                    Latest
                  </Link>
                  .
                </>
              ) : (
                <>
                  <Link href="/login?next=/" className="text-accent hover:underline">
                    Sign in
                  </Link>{" "}
                  and follow tags to get a personal feed.
                </>
              )
            ) : (
              <>
                Nothing here yet.{" "}
                <Link href="/new" className="text-accent hover:underline">
                  Post the first project
                </Link>
                .
              </>
            )
          }
        />
      </section>
      <Sidebar popularTags={popularTags} followedTags={followedTags} signedIn={!!user} />
    </div>
  );
}
