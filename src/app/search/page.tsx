import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getFollowedTags, getPopularTags, getReactions, parsePage, searchProjects } from "@/lib/queries";
import { SITE_NAME } from "@/lib/env";
import { slugifyTag } from "@/lib/utils";
import { ProjectList } from "@/components/ProjectList";
import { FollowTagButton } from "@/components/FollowTagButton";
import { TagChip } from "@/components/TagChip";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const q = String((await searchParams).q ?? "").trim();
  return { title: q ? `“${q}”` : "Search" };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 200);
  const page = parsePage(params.page);

  const { supabase, user } = await getUser();

  if (!q) {
    const popular = await getPopularTags(supabase, 24);
    return (
      <div className="mx-auto mt-6 max-w-xl text-center">
        <h1 className="text-xl font-semibold tracking-tight">Search {SITE_NAME}</h1>
        <p className="mt-1 text-sm text-muted">Type a game, a device, a car or an app in the search bar.</p>
        {popular.length > 0 && (
          <>
            <p className="eyebrow mt-6">Popular tags</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {popular.map((t) => (
                <TagChip key={t.tag} tag={t.tag} count={Number(t.project_count)} />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  const [{ projects, hasMore }, followedTags] = await Promise.all([
    searchProjects(supabase, q, page),
    getFollowedTags(supabase, user?.id),
  ]);
  const reactions = await getReactions(supabase, user?.id, projects.map((p) => p.id));
  const tag = slugifyTag(q);

  return (
    <div>
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
        wide
        projects={projects}
        reactions={reactions}
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
