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
        <FeedTabs active={tab} basePath="/" />
        <ProjectList
          projects={projects}
          reactions={reactions}
          hasMore={hasMore}
          nextHref={`/?tab=${tab}&page=${page + 1}`}
          empty={
            needsFollows ? (
              user ? (
                <>Your feed shows projects and tags you follow, including new updates. Pick some tags from Popular tags to get started.</>
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
