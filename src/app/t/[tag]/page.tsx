import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getFeed, getFollowedTags, getVotedIds, parsePage, type FeedTab } from "@/lib/queries";
import { slugifyTag } from "@/lib/utils";
import { FeedTabs } from "@/components/FeedTabs";
import { FollowTagButton } from "@/components/FollowTagButton";
import { ProjectList } from "@/components/ProjectList";

type Params = Promise<{ tag: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: `#${slugifyTag(decodeURIComponent((await params).tag))}` };
}

export default async function TagPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const tag = slugifyTag(decodeURIComponent((await params).tag));
  if (tag.length < 2) notFound();
  const sp = await searchParams;
  const tab: FeedTab = sp.tab === "top" ? "top" : "new";
  const page = parsePage(sp.page);

  const { supabase, user } = await getUser();
  const [{ projects, hasMore }, followedTags] = await Promise.all([
    getFeed(supabase, { tab, page, followedTags: [], tag }),
    getFollowedTags(supabase, user?.id),
  ]);
  const votedIds = await getVotedIds(supabase, user?.id, projects.map((p) => p.id));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">#{tag}</h1>
        {user ? (
          <FollowTagButton tag={tag} following={followedTags.includes(tag)} />
        ) : (
          <Link href={`/login?next=/t/${tag}`} className="btn-primary">
            Follow
          </Link>
        )}
      </div>
      <FeedTabs active={tab} basePath={`/t/${tag}`} tabs={["new", "top"]} />
      <ProjectList
        projects={projects}
        votedIds={votedIds}
        hasMore={hasMore}
        nextHref={`/t/${tag}?tab=${tab}&page=${page + 1}`}
        empty={
          <>
            No projects tagged #{tag} yet.{" "}
            <Link href="/new" className="text-accent hover:underline">
              Post one
            </Link>
            .
          </>
        }
      />
    </div>
  );
}
