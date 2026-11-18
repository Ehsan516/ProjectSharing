import Link from "next/link";
import type { ProjectSummary } from "@/lib/types";
import { ProjectCard } from "@/components/ProjectCard";
import { VideoConsentPrompt } from "@/components/VideoConsent";

export function ProjectList({
  projects,
  reactions,
  hasMore,
  nextHref,
  empty,
  wide = false,
}: {
  projects: ProjectSummary[];
  reactions: Map<string, 1 | -1>;
  hasMore: boolean;
  nextHref: string;
  empty: React.ReactNode;
  /** Three columns on large screens (pages without a sidebar) */
  wide?: boolean;
}) {
  if (projects.length === 0) {
    return <div className="panel p-10 text-center text-sm text-muted">{empty}</div>;
  }
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${wide ? "lg:grid-cols-3 xl:grid-cols-4" : "xl:grid-cols-3"}`}>
      {projects.some((p) => p.youtube_id) && <VideoConsentPrompt />}
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} reaction={reactions.get(p.id) ?? 0} />
      ))}
      {hasMore && (
        <Link href={nextHref} className="btn-ghost col-span-full justify-self-center" scroll={false}>
          Load more
        </Link>
      )}
    </div>
  );
}
