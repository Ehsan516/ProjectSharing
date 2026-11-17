import Link from "next/link";
import type { ProjectSummary } from "@/lib/types";
import { displayName, timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { TagChip } from "@/components/TagChip";
import { VoteButton } from "@/components/VoteButton";

export function ProjectCard({ project, voted }: { project: ProjectSummary; voted: boolean }) {
  return (
    <article className="card flex gap-4 p-4 transition hover:border-accent/50">
      {project.cover_url && (
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
          <h2 className="truncate text-base font-semibold hover:text-accent">{project.title}</h2>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">{project.summary}</p>
        </Link>

        {project.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {project.author && (
            <Link href={`/u/${project.author.username}`} className="flex items-center gap-1.5 hover:text-text">
              <Avatar author={project.author} size={18} />
              {displayName(project.author)}
            </Link>
          )}
          <span>{timeAgo(project.created_at)}</span>
          <Link href={`/p/${project.id}#comments`} className="hover:text-text">
            {project.comment_count} {project.comment_count === 1 ? "comment" : "comments"}
          </Link>
          {project.works_yes + project.works_no > 0 && (
            <span className="text-good">
              ✓ worked for {project.works_yes}/{project.works_yes + project.works_no}
            </span>
          )}
        </div>
      </div>

      <VoteButton projectId={project.id} voted={voted} count={project.vote_count} />
    </article>
  );
}
