import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { NewProjectForm } from "./NewProjectForm";

export const metadata: Metadata = { title: "Post a project" };

export default async function NewProjectPage() {
  const { user } = await getUser();
  if (!user) redirect("/login?next=/new");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Post a project</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Share something you built: a mod, tool, script, tweak or hack. Don&apos;t upload
        ROMs, paid software or anything you don&apos;t have the rights to.
      </p>
      <NewProjectForm />
    </div>
  );
}
