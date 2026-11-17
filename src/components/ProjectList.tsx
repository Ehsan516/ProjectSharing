import Link from "next/link";
import type { ProjectSummary } from "@/lib/types";
import { ProjectCard } from "@/components/ProjectCard";

export function ProjectList({
  projects,
  votedIds,
  hasMore,
  nextHref,
  empty,
}: {
  projects: ProjectSummary[];
  votedIds: Set<string>;
  hasMore: boolean;
  nextHref: string;
  empty: React.ReactNode;
}) {
  if (projects.length === 0) {
    return <div className="card p-8 text-center text-sm text-muted">{empty}</div>;
  }
  return (
    <div className="flex flex-col gap-3">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} voted={votedIds.has(p.id)} />
      ))}
      {hasMore && (
        <Link href={nextHref} className="btn-ghost self-center" scroll={false}>
          Load more
        </Link>
      )}
    </div>
  );
}
