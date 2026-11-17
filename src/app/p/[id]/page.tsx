import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import {
  COMMENT_AUTHOR_SELECT,
  PROJECT_AUTHOR_SELECT,
  RELEASE_SELECT,
  REPORT_AUTHOR_SELECT,
} from "@/lib/queries";
import type { Comment, Project, Release, WorksReport } from "@/lib/types";
import { displayName, formatBytes, formatCount, timeAgo } from "@/lib/utils";
import {
  addComment,
  deleteComment,
  deleteProject,
  deleteRelease,
  reportProject,
  submitWorksReport,
  toggleFollowProject,
} from "@/lib/actions";
import { Avatar } from "@/components/Avatar";
import { FollowProjectButton } from "@/components/FollowProjectButton";
import { TagChip } from "@/components/TagChip";
import { VoteButton } from "@/components/VoteButton";
import { WorksTally } from "@/components/WorksTally";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { CommentForm, ConfirmButton, ReportForm, WorksReportForm } from "@/components/ProjectForms";

type Params = Promise<{ id: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadProject(id: string) {
  if (!UUID.test(id)) return null;
  const { supabase, user } = await getUser();
  const { data } = await supabase.from("projects").select(`*,${PROJECT_AUTHOR_SELECT}`).eq("id", id).maybeSingle();
  return { supabase, user, project: data as Omit<Project, "latest"> | null };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const loaded = await loadProject((await params).id);
  if (!loaded?.project) return { title: "Not found" };
  const { project } = loaded;
  return {
    title: project.title,
    description: project.summary,
    openGraph: { title: project.title, description: project.summary, images: project.cover_url ? [project.cover_url] : [] },
  };
}

export default async function ProjectPage({ params }: { params: Params }) {
  const { id } = await params;
  const loaded = await loadProject(id);
  if (!loaded?.project) notFound();
  const { supabase, user, project } = loaded;
  const isOwner = user?.id === project.author_id;

  const [
    { data: releaseRows },
    { data: commentRows },
    { data: reportRows },
    { data: myReportRows },
    { data: vote },
    { data: follow },
  ] = await Promise.all([
    supabase.from("project_releases").select(RELEASE_SELECT).eq("project_id", id).order("created_at", { ascending: false }),
    supabase
      .from("comments")
      .select(`id,body,created_at,author_id,${COMMENT_AUTHOR_SELECT}`)
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("works_reports")
      .select(`user_id,release_id,worked,setup,created_at,${REPORT_AUTHOR_SELECT}`)
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    user
      ? supabase.from("works_reports").select("release_id,worked,setup").eq("project_id", id).eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
    user
      ? supabase.from("votes").select("project_id").eq("project_id", id).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("project_follows").select("project_id").eq("project_id", id).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const releases = (releaseRows ?? []) as Release[];
  const latest = releases[0] ?? null;
  const versionOf = new Map(releases.map((r) => [r.id, r.version]));
  const comments = (commentRows ?? []) as unknown as Comment[];
  const reports = (reportRows ?? []) as unknown as WorksReport[];
  const myReports = (myReportRows ?? []) as { release_id: string | null; worked: boolean; setup: string | null }[];

  // Downloads go through /d/<id> so they're counted.
  const downloadUrl = (r: Release) => (r.file_path ? `/d/${r.id}` : null);
  const latestDownload = latest ? downloadUrl(latest) : null;
  const wasUpdated = releases.length > 1;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Header */}
      <header className="flex gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight">
            {project.title}
            {latest && (
              <span className="ml-2 align-middle rounded-md bg-surface-2 px-2 py-0.5 font-mono text-sm font-medium text-muted">
                v{latest.version}
              </span>
            )}
          </h1>
          <p className="mt-1 text-muted">{project.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {project.author && (
              <Link href={`/u/${project.author.username}`} className="flex items-center gap-1.5 hover:text-text">
                <Avatar author={project.author} size={22} />
                {displayName(project.author)}
              </Link>
            )}
            <span>posted {timeAgo(project.created_at)}</span>
            {wasUpdated && latest && <span className="text-accent">updated {timeAgo(latest.created_at)}</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {isOwner ? (
              <Link href={`/p/${project.id}/release`} className="btn-primary">
                Publish an update
              </Link>
            ) : user ? (
              <FollowProjectButton action={toggleFollowProject.bind(null, project.id)} following={!!follow} />
            ) : (
              <Link href={`/login?next=/p/${project.id}`} className="btn-ghost">
                Follow for updates
              </Link>
            )}
          </div>
        </div>
        <VoteButton projectId={project.id} voted={!!vote} count={project.vote_count} large />
      </header>

      {project.youtube_id ? (
        <YouTubeEmbed videoId={project.youtube_id} title={project.title} />
      ) : (
        project.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.cover_url} alt="" className="max-h-[420px] w-full rounded-xl border border-border object-cover" />
        )
      )}

      {/* Links + facts */}
      <div className="card flex flex-col gap-3 p-4">
        {(project.link_url || project.source_url || latestDownload) && (
          <div className="flex flex-wrap gap-2">
            {latest && latestDownload && (
              <a href={latestDownload} className="btn-primary" rel="nofollow">
                ⬇ Download v{latest.version}
                {latest.file_size ? ` (${formatBytes(latest.file_size)})` : ""}
              </a>
            )}
            {project.link_url && (
              <a
                href={project.link_url}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className={latestDownload ? "btn-ghost" : "btn-primary"}
              >
                Open project ↗
              </a>
            )}
            {project.source_url && (
              <a href={project.source_url} target="_blank" rel="noopener noreferrer nofollow ugc" className="btn-ghost">
                Source ↗
              </a>
            )}
          </div>
        )}
        <dl className="grid gap-2 text-sm sm:grid-cols-[140px_1fr]">
          {(latest?.works_on || project.works_on) && (
            <>
              <dt className="text-muted">Works on</dt>
              <dd>{latest?.works_on || project.works_on}</dd>
            </>
          )}
          {project.download_count > 0 && (
            <>
              <dt className="text-muted">Downloads</dt>
              <dd>{project.download_count.toLocaleString()}</dd>
            </>
          )}
          <dt className="text-muted">{latest ? `Reports for v${latest.version}` : "Reports"}</dt>
          <dd>
            <WorksTally yes={latest ? latest.works_yes : project.works_yes} no={latest ? latest.works_no : project.works_no} />
            {wasUpdated && project.works_yes + project.works_no > 0 && (
              <span className="text-muted">
                {" "}
                · all versions: {project.works_yes}✓ {project.works_no}✗
              </span>
            )}
          </dd>
        </dl>
        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        )}
        <p className="text-xs text-muted">
          Files and links are shared by users and aren&apos;t scanned. Only run things you trust, and check the
          source first.
        </p>
      </div>

      {project.body && (
        <section>
          <h2 className="mb-2 font-semibold">About</h2>
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{project.body}</div>
        </section>
      )}

      {/* Releases */}
      {releases.length > 0 && (
        <section id="releases" className="flex flex-col gap-3">
          <h2 className="font-semibold">Releases</h2>
          <ol className="flex flex-col gap-3">
            {releases.map((r, i) => {
              const url = downloadUrl(r);
              return (
                <li key={r.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono font-semibold">v{r.version}</span>
                    {i === 0 && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Latest</span>
                    )}
                    <span className="text-xs text-muted">{timeAgo(r.created_at)}</span>
                    <WorksTally yes={r.works_yes} no={r.works_no} compact />
                    {r.file_path && (
                      <span className="text-xs text-muted">
                        {formatCount(r.download_count)} {r.download_count === 1 ? "download" : "downloads"}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-3">
                      {url && (
                        <a href={url} rel="nofollow" className="text-sm font-medium text-accent hover:underline">
                          ⬇ .zip{r.file_size ? ` · ${formatBytes(r.file_size)}` : ""}
                        </a>
                      )}
                      {isOwner && (
                        <ConfirmButton
                          action={deleteRelease.bind(null, project.id, r.id)}
                          confirmText={`Delete release v${r.version} and its file?`}
                        >
                          Delete
                        </ConfirmButton>
                      )}
                    </span>
                  </div>
                  {r.works_on && <p className="mt-1 text-xs text-muted">Tested on: {r.works_on}</p>}
                  {r.changelog && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{r.changelog}</p>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Works-for-me reports */}
      <section className="card flex flex-col gap-4 p-4">
        <h2 className="font-semibold">Works for me?</h2>
        {user ? (
          isOwner ? (
            <p className="text-sm text-muted">Others will report here whether each version worked on their setup.</p>
          ) : (
            <WorksReportForm
              action={submitWorksReport.bind(null, project.id)}
              releases={releases.map((r) => ({ id: r.id, version: r.version }))}
              myReports={myReports}
            />
          )
        ) : (
          <p className="text-sm text-muted">
            <Link href={`/login?next=/p/${project.id}`} className="text-accent hover:underline">
              Sign in
            </Link>{" "}
            to say whether it worked for you.
          </p>
        )}
        {reports.length > 0 && (
          <ul className="flex flex-col gap-2 text-sm">
            {reports.map((r) => (
              <li key={`${r.user_id}-${r.release_id}`} className="flex min-w-0 items-center gap-2">
                <span className={r.worked ? "text-good" : "text-bad"}>{r.worked ? "✓" : "✗"}</span>
                <span className="shrink-0 font-medium">{displayName(r.author)}</span>
                {r.release_id && versionOf.has(r.release_id) && (
                  <span className="shrink-0 rounded bg-surface-2 px-1.5 font-mono text-xs text-muted">
                    v{versionOf.get(r.release_id)}
                  </span>
                )}
                {r.setup && <span className="truncate text-muted">— {r.setup}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Comments */}
      <section id="comments" className="flex flex-col gap-4">
        <h2 className="font-semibold">
          {project.comment_count} {project.comment_count === 1 ? "comment" : "comments"}
        </h2>
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar author={c.author} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-muted">
                {c.author ? (
                  <Link href={`/u/${c.author.username}`} className="font-medium text-text hover:text-accent">
                    {displayName(c.author)}
                  </Link>
                ) : (
                  <span>deleted user</span>
                )}
                <span>{timeAgo(c.created_at)}</span>
                {user?.id === c.author_id && (
                  <ConfirmButton action={deleteComment.bind(null, project.id, c.id)} confirmText="Delete this comment?">
                    Delete
                  </ConfirmButton>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.body}</p>
            </div>
          </div>
        ))}
        {user ? (
          <CommentForm action={addComment.bind(null, project.id)} />
        ) : (
          <p className="text-sm text-muted">
            <Link href={`/login?next=/p/${project.id}`} className="text-accent hover:underline">
              Sign in
            </Link>{" "}
            to comment.
          </p>
        )}
      </section>

      <footer className="flex items-center gap-4 border-t border-border pt-4">
        {isOwner ? (
          <ConfirmButton action={deleteProject.bind(null, project.id)} confirmText="Delete this project and all its releases?">
            Delete project
          </ConfirmButton>
        ) : user ? (
          <ReportForm action={reportProject.bind(null, project.id)} />
        ) : null}
      </footer>
    </article>
  );
}
