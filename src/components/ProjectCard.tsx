import Link from "next/link";
import type { ProjectSummary } from "@/lib/types";
import { displayName, formatCount, timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { GeneratedCover } from "@/components/GeneratedCover";
import { VoteButton, type Reaction } from "@/components/VoteButton";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";

export function ProjectCard({ project, reaction }: { project: ProjectSummary; reaction: Reaction }) {
  const href = `/p/${project.id}`;
  const latest = project.latest;
  // A release published well after the project itself counts as an update.
  const updated = latest && new Date(latest.created_at).getTime() - new Date(project.created_at).getTime() > 60_000;
  const yes = latest ? latest.works_yes : project.works_yes;
  const no = latest ? latest.works_no : project.works_no;

  return (
    <article className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      {/* Media leads */}
      <div className="relative aspect-video bg-surface-2">
        {project.youtube_id ? (
          <YouTubeEmbed videoId={project.youtube_id} title={project.title} flush />
        ) : (
          <Link href={href} tabIndex={-1} aria-hidden className="block h-full">
            {project.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={project.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <GeneratedCover seed={project.id} title={project.title} />
            )}
          </Link>
        )}
        {latest && (
          <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/60 px-2 py-0.5 font-mono text-xs font-medium text-white backdrop-blur">
            v{latest.version}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <Link href={href}>
          <h2 className="line-clamp-1 text-[17px] font-semibold tracking-tight group-hover:text-accent">{project.title}</h2>
          <p className="line-clamp-2 text-sm text-muted">{project.summary}</p>
        </Link>

        <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-muted">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {project.author && (
              <Link href={`/u/${project.author.username}`} className="flex min-w-0 items-center gap-1.5 hover:text-text">
                <Avatar author={project.author} size={18} />
                <span className="truncate">{displayName(project.author)}</span>
              </Link>
            )}
            <span aria-hidden>·</span>
            {updated ? (
              <span className="shrink-0 font-medium text-accent">updated {timeAgo(latest.created_at)}</span>
            ) : (
              <span className="shrink-0">{timeAgo(project.created_at)}</span>
            )}
          </div>

          {yes + no > 0 && (
            <span
              className="shrink-0 text-good"
              title={`Worked for ${yes} of ${yes + no}${latest ? ` on v${latest.version}` : ""}`}
            >
              ✓ {yes}/{yes + no}
            </span>
          )}
          {latest?.file_name && (
            <span className="shrink-0" title={`${project.download_count} downloads`}>
              ⬇ {formatCount(project.download_count)}
            </span>
          )}
          <Link href={`${href}#comments`} className="shrink-0 hover:text-text" title="Comments">
            💬 {formatCount(project.comment_count)}
          </Link>
          <VoteButton
            projectId={project.id}
            reaction={reaction}
            likes={project.like_count}
            dislikes={project.dislike_count}
          />
        </div>
      </div>
    </article>
  );
}
