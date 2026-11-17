import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getFollowedTags, getVotedIds, parsePage, searchProjects } from "@/lib/queries";
import { slugifyTag } from "@/lib/utils";
import { ProjectList } from "@/components/ProjectList";
import { FollowTagButton } from "@/components/FollowTagButton";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const q = String((await searchParams).q ?? "").trim();
  return { title: q ? `“${q}”` : "Search" };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 200);
  const page = parsePage(params.page);

  if (!q) {
    return <p className="text-sm text-muted">Type something in the search bar — a game, a device, a car, anything.</p>;
  }

  const { supabase, user } = await getUser();
  const [{ projects, hasMore }, followedTags] = await Promise.all([
    searchProjects(supabase, q, page),
    getFollowedTags(supabase, user?.id),
  ]);
  const votedIds = await getVotedIds(supabase, user?.id, projects.map((p) => p.id));
  const tag = slugifyTag(q);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">
          Results for <span className="text-accent">“{q}”</span>
        </h1>
        {tag.length >= 2 && user && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Link href={`/t/${tag}`} className="hover:text-text">
              #{tag}
            </Link>
            <FollowTagButton tag={tag} following={followedTags.includes(tag)} />
          </div>
        )}
      </div>
      <ProjectList
        projects={projects}
        votedIds={votedIds}
        hasMore={hasMore}
        nextHref={`/search?q=${encodeURIComponent(q)}&page=${page + 1}`}
        empty={
          <>
            No projects match “{q}” yet. Built something for it?{" "}
            <Link href="/new" className="text-accent hover:underline">
              Post it
            </Link>
            .
          </>
        }
      />
    </div>
  );
}
