import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { toggleFollowProject } from "@/lib/actions";
import { PROJECT_AUTHOR_SELECT } from "@/lib/queries";
import type { Author } from "@/lib/types";
import { displayName } from "@/lib/utils";
import { FollowProjectButton } from "@/components/FollowProjectButton";
import { FollowTagButton } from "@/components/FollowTagButton";
import { GeneratedCover } from "@/components/GeneratedCover";
import { TagChip } from "@/components/TagChip";
import { TimeAgo } from "@/components/TimeAgo";

export const metadata: Metadata = { title: "Following" };

type FollowedProject = {
  created_at: string;
  project: {
    id: string;
    title: string;
    summary: string;
    cover_url: string | null;
    youtube_id: string | null;
    activity_at: string;
    author: Author | null;
  } | null;
};

export default async function FollowingPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/following");

  const [{ data: tagRows }, { data: projectRows }] = await Promise.all([
    supabase.from("tag_follows").select("tag,created_at").eq("user_id", user.id).order("tag"),
    supabase
      .from("project_follows")
      .select(
        `created_at,project:projects!project_follows_project_id_fkey(id,title,summary,cover_url,youtube_id,activity_at,${PROJECT_AUTHOR_SELECT})`,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const tags = (tagRows ?? []) as { tag: string }[];
  const projects = ((projectRows ?? []) as unknown as FollowedProject[]).filter((r) => r.project);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <div>
        <h1 className="text-3xl font-bold">Following</h1>
        <p className="mt-1 text-sm text-muted">
          New projects in these tags, and updates to these projects, show up in your{" "}
          <Link href="/?tab=foryou" className="text-accent hover:underline">
            For you
          </Link>{" "}
          feed.
        </p>
      </div>

      <section>
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-xl font-bold">Tags</h2>
          <span className="rounded bg-surface-2 px-1.5 font-mono text-xs text-muted">{tags.length}</span>
        </div>
        {tags.length > 0 ? (
          <ul className="card divide-y divide-border">
            {tags.map(({ tag }) => (
              <li key={tag} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <TagChip tag={tag} />
                <FollowTagButton tag={tag} following />
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel p-5 text-sm text-muted">
            You don&apos;t follow any tags yet. Open a tag, like the ones on any project, and choose Follow.
          </p>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-xl font-bold">Projects</h2>
          <span className="rounded bg-surface-2 px-1.5 font-mono text-xs text-muted">{projects.length}</span>
        </div>
        {projects.length > 0 ? (
          <ul className="card divide-y divide-border">
            {projects.map(({ project: p }) => (
              <li key={p!.id} className="flex items-center gap-4 px-4 py-3">
                <Link
                  href={`/p/${p!.id}`}
                  className="block aspect-video w-24 shrink-0 overflow-hidden rounded border border-border bg-surface-2"
                  tabIndex={-1}
                  aria-hidden
                >
                  {p!.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p!.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : p!.youtube_id ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://i.ytimg.com/vi/${p!.youtube_id}/mqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full [&_span]:text-xs">
                      <GeneratedCover seed={p!.id} title={p!.title} />
                    </div>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/p/${p!.id}`} className="block truncate font-medium hover:underline">
                    {p!.title}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    {displayName(p!.author)} · <TimeAgo iso={p!.activity_at} prefix="active " />
                  </p>
                </div>
                <FollowProjectButton action={toggleFollowProject.bind(null, p!.id)} following />
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel p-5 text-sm text-muted">
            You don&apos;t follow any projects yet. Choose &quot;Follow for updates&quot; on a project to get its new
            releases in your feed.
          </p>
        )}
      </section>
    </div>
  );
}
