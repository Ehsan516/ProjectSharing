import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { COMMENT_AUTHOR_SELECT, PROJECT_AUTHOR_SELECT, REPORT_AUTHOR_SELECT } from "@/lib/queries";
import type { Comment, Project, WorksReport } from "@/lib/types";
import { displayName, timeAgo } from "@/lib/utils";
import {
  addComment,
  deleteComment,
  deleteProject,
  reportProject,
  submitWorksReport,
} from "@/lib/actions";
import { Avatar } from "@/components/Avatar";
import { CopyButton } from "@/components/CopyButton";
import { TagChip } from "@/components/TagChip";
import { VoteButton } from "@/components/VoteButton";
import { CommentForm, ConfirmButton, ReportForm, WorksReportForm } from "@/components/ProjectForms";

type Params = Promise<{ id: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadProject(id: string) {
  if (!UUID.test(id)) return null;
  const { supabase, user } = await getUser();
  const { data } = await supabase.from("projects").select(`*,${PROJECT_AUTHOR_SELECT}`).eq("id", id).maybeSingle();
  return { supabase, user, project: data as Project | null };
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

  const [{ data: commentRows }, { data: reportRows }, { data: vote }] = await Promise.all([
    supabase
      .from("comments")
      .select(`id,body,created_at,author_id,${COMMENT_AUTHOR_SELECT}`)
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("works_reports")
      .select(`user_id,worked,setup,created_at,${REPORT_AUTHOR_SELECT}`)
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    user
      ? supabase.from("votes").select("project_id").eq("project_id", id).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const comments = (commentRows ?? []) as unknown as Comment[];
  const reports = (reportRows ?? []) as unknown as WorksReport[];
  const myReport = user ? (reports.find((r) => r.user_id === user.id) ?? null) : null;
  const totalReports = project.works_yes + project.works_no;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Header */}
      <header className="flex gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight">{project.title}</h1>
          <p className="mt-1 text-muted">{project.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {project.author && (
              <Link href={`/u/${project.author.username}`} className="flex items-center gap-1.5 hover:text-text">
                <Avatar author={project.author} size={22} />
                {displayName(project.author)}
              </Link>
            )}
            <span>{timeAgo(project.created_at)}</span>
          </div>
        </div>
        <VoteButton projectId={project.id} voted={!!vote} count={project.vote_count} large />
      </header>

      {project.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={project.cover_url} alt="" className="max-h-[420px] w-full rounded-xl border border-border object-cover" />
      )}

      {/* Links + facts */}
      <div className="card flex flex-col gap-3 p-4">
        {(project.link_url || project.source_url) && (
          <div className="flex flex-wrap gap-2">
            {project.link_url && (
              <a href={project.link_url} target="_blank" rel="noopener noreferrer nofollow ugc" className="btn-primary">
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
        <dl className="grid gap-2 text-sm sm:grid-cols-[120px_1fr]">
          {project.works_on && (
            <>
              <dt className="text-muted">Works on</dt>
              <dd>{project.works_on}</dd>
            </>
          )}
          {project.made_with && (
            <>
              <dt className="text-muted">Made with</dt>
              <dd>{project.made_with}</dd>
            </>
          )}
          <dt className="text-muted">Reports</dt>
          <dd>
            {totalReports === 0 ? (
              <span className="text-muted">No one has reported yet</span>
            ) : (
              <>
                <span className="text-good">✓ {project.works_yes} worked</span>
                {project.works_no > 0 && <span className="text-bad"> · ✗ {project.works_no} didn&apos;t</span>}
              </>
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
          Links go to third-party sites. Review code before running it on your devices.
        </p>
      </div>

      {project.body && (
        <section>
          <h2 className="mb-2 font-semibold">About</h2>
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{project.body}</div>
        </section>
      )}

      {project.prompt && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-4 py-2">
            <div>
              <h2 className="text-sm font-semibold">Recipe</h2>
              <p className="text-xs text-muted">The prompt/spec behind this. Give it to your AI to rebuild it for your setup.</p>
            </div>
            <CopyButton text={project.prompt} />
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed">
            {project.prompt}
          </pre>
        </section>
      )}

      {/* Works-for-me reports */}
      <section className="card flex flex-col gap-4 p-4">
        <h2 className="font-semibold">Works for me?</h2>
        {user ? (
          isOwner ? (
            <p className="text-sm text-muted">Others will report here whether it worked on their setup.</p>
          ) : (
            <WorksReportForm action={submitWorksReport.bind(null, project.id)} existing={myReport} />
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
              <li key={r.user_id} className="flex items-center gap-2">
                <span className={r.worked ? "text-good" : "text-bad"}>{r.worked ? "✓" : "✗"}</span>
                <span className="font-medium">{displayName(r.author)}</span>
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
          <ConfirmButton
            action={deleteProject.bind(null, project.id)}
            confirmText="Delete this project permanently?"
          >
            Delete project
          </ConfirmButton>
        ) : user ? (
          <ReportForm action={reportProject.bind(null, project.id)} />
        ) : null}
      </footer>
    </article>
  );
}
