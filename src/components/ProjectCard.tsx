import Link from "next/link";
import type { ProjectSummary } from "@/lib/types";
import { displayName, formatCount, timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { TagChip } from "@/components/TagChip";
import { VoteButton } from "@/components/VoteButton";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";

export function ProjectCard({ project, voted }: { project: ProjectSummary; voted: boolean }) {
  const latest = project.latest;
  // A release published well after the project itself counts as an update.
  const updated = latest && new Date(latest.created_at).getTime() - new Date(project.created_at).getTime() > 60_000;
  const yes = latest ? latest.works_yes : project.works_yes;
  const no = latest ? latest.works_no : project.works_no;

  return (
    <article className="card flex gap-4 p-4 transition hover:border-accent/50">
      {project.cover_url && !project.youtube_id && (
        <Link href={`/p/${project.id}`} className="hidden shrink-0 sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.cover_url}
            alt=""
            className="h-24 w-36 rounded-lg border border-border object-cover"
            loading="lazy"
          />
        </Link>
      )}

      <div className="min-w-0 flex-1">
        <Link href={`/p/${project.id}`} className="block">
          <h2 className="flex min-w-0 items-baseline gap-2 text-base font-semibold hover:text-accent">
            <span className="truncate">{project.title}</span>
            {latest && <span className="shrink-0 font-mono text-xs font-medium text-muted">v{latest.version}</span>}
          </h2>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">{project.summary}</p>
        </Link>

        {project.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        )}

        {project.youtube_id && (
          <div className="mt-3">
            <YouTubeEmbed videoId={project.youtube_id} title={project.title} />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {project.author && (
            <Link href={`/u/${project.author.username}`} className="flex items-center gap-1.5 hover:text-text">
              <Avatar author={project.author} size={18} />
              {displayName(project.author)}
            </Link>
          )}
          {updated ? (
            <span className="font-medium text-accent">updated {timeAgo(latest.created_at)}</span>
          ) : (
            <span>{timeAgo(project.created_at)}</span>
          )}
          <Link href={`/p/${project.id}#comments`} className="hover:text-text">
            {project.comment_count} {project.comment_count === 1 ? "comment" : "comments"}
          </Link>
          {latest?.file_name && (
            <span title={`${project.download_count} downloads`}>⬇ {formatCount(project.download_count)}</span>
          )}
          {yes + no > 0 && (
            <span className="text-good">
              ✓ worked for {yes}/{yes + no}
              {latest ? ` on v${latest.version}` : ""}
            </span>
          )}
        </div>
      </div>

      <VoteButton projectId={project.id} voted={voted} count={project.vote_count} />
    </article>
  );
}
