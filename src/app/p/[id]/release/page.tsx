import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { createRelease } from "@/lib/actions";
import { ReleaseForm } from "./ReleaseForm";

export const metadata: Metadata = { title: "Publish an update" };

type Params = Promise<{ id: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewReleasePage({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=/p/${id}/release`);

  const { data: project } = await supabase
    .from("projects")
    .select("id,title,author_id,works_on,latest:project_releases!projects_latest_release_id_fkey(version,works_on)")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();
  if (project.author_id !== user.id) redirect(`/p/${id}`);

  const latest = project.latest as unknown as { version: string; works_on: string | null } | null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/p/${id}`} className="text-sm text-muted hover:text-text">
        ← {project.title}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Publish an update</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        {latest ? `Current version: v${latest.version}. ` : ""}People following this project will see the update in
        their feed, and it moves back to the top of Latest.
      </p>
      <ReleaseForm
        action={createRelease.bind(null, id)}
        suggestedVersion={latest ? bumpVersion(latest.version) : "1.0"}
        defaultWorksOn={latest?.works_on ?? project.works_on ?? ""}
      />
    </div>
  );
}

/** 1.2 -> 1.3, 2.0.9 -> 2.0.10; anything else is left for the author to type. */
function bumpVersion(version: string): string {
  const m = version.match(/^(.*?)(\d+)$/);
  return m ? `${m[1]}${Number(m[2]) + 1}` : "";
}
