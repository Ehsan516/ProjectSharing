import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { safeRedirectPath } from "@/lib/utils";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/settings");
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = data as Profile;
  const welcome = sp.welcome === "1";
  const next = safeRedirectPath(typeof sp.next === "string" ? sp.next : null);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">{welcome ? "Welcome! Pick a username" : "Settings"}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        {welcome ? "This is how people will find you and your projects." : "Update your public profile."}
      </p>
      <SettingsForm profile={profile} welcome={welcome} next={next} />
    </div>
  );
}
