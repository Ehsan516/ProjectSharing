import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { updateProject } from "@/lib/actions";
import { ProjectForm, type ProjectFormValues } from "@/components/ProjectForm";

export const metadata: Metadata = { title: "Edit post" };

type Params = Promise<{ id: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProjectPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=/p/${id}/edit`);

  const { data } = await supabase
    .from("projects")
    .select("author_id,title,summary,tags,link_url,source_url,youtube_id,works_on,body,cover_url")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  if (data.author_id !== user.id) redirect(`/p/${id}`);
  const initial = data as unknown as ProjectFormValues;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/p/${id}`} className="text-sm text-muted hover:text-text">
        ← {data.title}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Edit post</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        To change the files or version,{" "}
        <Link href={`/p/${id}/release`} className="text-accent hover:underline">
          publish an update
        </Link>{" "}
        instead.
      </p>
      <ProjectForm
        mode="edit"
        action={updateProject.bind(null, id)}
        initial={initial}
        cancelHref={`/p/${id}`}
      />
    </div>
  );
}
