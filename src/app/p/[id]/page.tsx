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
import { MoreMenu } from "@/components/MoreMenu";
import { TagChip } from "@/components/TagChip";
import { VoteButton, type Reaction } from "@/components/VoteButton";
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
      ? supabase.from("votes").select("value").eq("project_id", id).eq("user_id", user.id).maybeSingle()
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
    <article className="mx-auto flex max-w-3xl flex-col gap-8">
      {/* Header: one idea, big and plain */}
      <header className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{project.title}</h1>
          <p className="mt-2 text-lg text-muted">{project.summary}</p>
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
        </div>
        <VoteButton
          projectId={project.id}
          reaction={((vote as { value: 1 | -1 } | null)?.value ?? 0) as Reaction}
          likes={project.like_count}
          dislikes={project.dislike_count}
          size="lg"
        />
      </header>

      {project.youtube_id ? (
        <YouTubeEmbed videoId={project.youtube_id} title={project.title} />
      ) : (
        project.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.cover_url} alt="" className="max-h-[440px] w-full rounded-2xl object-cover" />
        )
      )}

      {/* One primary action; everything else is a quiet link */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {latest && latestDownload ? (
            <a href={latestDownload} className="btn-primary px-6 py-2.5 text-base" rel="nofollow">
              Download v{latest.version}
              {latest.file_size ? <span className="font-normal opacity-80">· {formatBytes(latest.file_size)}</span> : null}
            </a>
          ) : (
            project.link_url && (
              <a
                href={project.link_url}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className="btn-primary px-6 py-2.5 text-base"
              >
                Open project ↗
              </a>
            )
          )}
          {latestDownload && project.link_url && (
            <a href={project.link_url} target="_blank" rel="noopener noreferrer nofollow ugc" className="link-action">
              Open project ↗
            </a>
          )}
          {project.source_url && (
            <a href={project.source_url} target="_blank" rel="noopener noreferrer nofollow ugc" className="link-action">
              View source ↗
            </a>
          )}
          {isOwner ? (
            <>
              <Link href={`/p/${project.id}/release`} className="link-action">
                Publish an update ›
              </Link>
              <Link href={`/p/${project.id}/edit`} className="link-action">
                Edit post ›
              </Link>
            </>
          ) : user ? (
            <FollowProjectButton
              action={toggleFollowProject.bind(null, project.id)}
              following={!!follow}
              variant="link"
            />
          ) : (
            <Link href={`/login?next=/p/${project.id}`} className="link-action">
              Follow for updates ›
            </Link>
          )}
          <div className="ml-auto">
            <MoreMenu>
              {isOwner ? (
                <ConfirmButton
                  action={deleteProject.bind(null, project.id)}
                  confirmText="Delete this project and all its releases?"
                  className="text-sm text-bad hover:underline"
                >
                  Delete project
                </ConfirmButton>
              ) : user ? (
                <ReportForm action={reportProject.bind(null, project.id)} />
              ) : (
                <Link href={`/login?next=/p/${project.id}`} className="text-sm text-muted hover:text-text">
                  Sign in to report this project
                </Link>
              )}
            </MoreMenu>
          </div>
        </div>
        {(latestDownload || project.link_url) && (
          <p className="text-xs text-muted">
            Shared by users and not scanned. Check the source before running anything.
          </p>
        )}
      </div>

      {/* At a glance */}
      <dl className="panel grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-4">
        <Stat label="Version" value={latest ? `v${latest.version}` : "—"} mono />
        <Stat label="Downloads" value={latest?.file_name ? project.download_count.toLocaleString() : "—"} />
        <div className="col-span-2">
          <dt className="text-xs text-muted">{latest ? `Works on v${latest.version}?` : "Works for people?"}</dt>
          <dd className="mt-1 text-sm font-medium">
            <WorksTally
              yes={latest ? latest.works_yes : project.works_yes}
              no={latest ? latest.works_no : project.works_no}
            />
          </dd>
        </div>
        {(latest?.works_on || project.works_on) && (
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-xs text-muted">Tested on</dt>
            <dd className="mt-1 text-sm">{latest?.works_on || project.works_on}</dd>
          </div>
        )}
      </dl>

      {project.tags.length > 0 && (
        <div className="-mt-4 flex flex-wrap gap-1.5">
          {project.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      )}

      {project.body && (
        <section>
          <h2 className="mb-2 text-xl font-semibold tracking-tight">About</h2>
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{project.body}</div>
        </section>
      )}

      {/* Releases */}
      {releases.length > 0 && (
        <section id="releases" className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Releases</h2>
          <ol className="panel flex flex-col divide-y divide-[var(--hairline)]">
            {releases.map((r, i) => {
              const url = downloadUrl(r);
              return (
                <li key={r.id} className="p-4">
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
      <section className="panel flex flex-col gap-4 p-5">
        <h2 className="text-xl font-semibold tracking-tight">Works for me?</h2>
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
        <h2 className="text-xl font-semibold tracking-tight">
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

    </article>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 text-xl font-semibold tracking-tight ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
