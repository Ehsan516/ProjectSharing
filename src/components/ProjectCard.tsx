import Link from "next/link";
import type { ProjectSummary } from "@/lib/types";
import { displayName, formatCount } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { GeneratedCover } from "@/components/GeneratedCover";
import { CheckIcon, CommentIcon, DownloadIcon } from "@/components/Icons";
import { TagChip } from "@/components/TagChip";
import { TimeAgo } from "@/components/TimeAgo";
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
    <article className="card group flex flex-col overflow-hidden transition hover:border-border-strong">
      {/* Media leads */}
      <div className="relative aspect-video border-b border-border bg-surface-2">
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
          <span className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-[#191917]/85 px-1.5 py-px font-mono text-[11px] font-medium text-[#f8f7f4]">
            v{latest.version}
          </span>
        )}
        {(project.hidden_at || latest?.scan_status === "malicious") && (
          <span className="pointer-events-none absolute right-3 top-3 z-10 rounded bg-bad px-1.5 py-px font-mono text-[11px] font-medium text-white">
            {project.hidden_at ? "Hidden" : "Blocked"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <Link href={href} className="rounded-md">
          <h2 className="line-clamp-1 text-[17px] font-bold tracking-tight group-hover:underline group-hover:decoration-signal group-hover:decoration-2 group-hover:underline-offset-4">{project.title}</h2>
          <p className="line-clamp-2 text-sm text-muted">{project.summary}</p>
        </Link>

        {project.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {project.tags.slice(0, 3).map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2.5 pt-3 text-xs text-muted">
          <div className="flex min-w-0 items-center gap-1.5">
            {project.authorship === "shared" && project.original_creator ? (
              <span className="flex min-w-0 items-center gap-1" title={`Made by ${project.original_creator}, shared by ${displayName(project.author)}`}>
                <span className="truncate">
                  by <span className="font-medium text-text">{project.original_creator}</span>
                </span>
                {project.author && (
                  <Link href={`/u/${project.author.username}`} className="shrink-0 hover:text-text">
                    · shared by <Avatar author={project.author} size={14} />
                  </Link>
                )}
              </span>
            ) : (
              project.author && (
                <Link href={`/u/${project.author.username}`} className="flex min-w-0 items-center gap-1.5 hover:text-text">
                  <Avatar author={project.author} size={18} />
                  <span className="truncate">{displayName(project.author)}</span>
                </Link>
              )
            )}
            <span aria-hidden>·</span>
            {updated ? (
              <TimeAgo iso={latest.created_at} prefix="updated " className="shrink-0 font-medium text-accent" />
            ) : (
              <TimeAgo iso={project.created_at} className="shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-[var(--hairline)] pt-2.5 font-mono text-[11px]">
            {yes + no > 0 && (
              <span
                className="flex shrink-0 items-center gap-1 text-good"
                title={`Worked for ${yes} of ${yes + no} people${latest ? ` on v${latest.version}` : ""}`}
              >
                <CheckIcon />
                {yes}/{yes + no}
              </span>
            )}
            {(latest?.file_name || project.download_count > 0) && (
              <span
                className="flex shrink-0 items-center gap-1"
                title={`${project.download_count.toLocaleString()} ${project.download_count === 1 ? "download" : "downloads"}`}
              >
                <DownloadIcon />
                {formatCount(project.download_count)}
              </span>
            )}
            <Link
              href={`${href}#comments`}
              className="flex shrink-0 items-center gap-1 hover:text-text"
              title={`${project.comment_count} ${project.comment_count === 1 ? "comment" : "comments"}`}
            >
              <CommentIcon />
              {formatCount(project.comment_count)}
            </Link>
            <div className="ml-auto">
              <VoteButton
                projectId={project.id}
                reaction={reaction}
                likes={project.like_count}
                dislikes={project.dislike_count}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
