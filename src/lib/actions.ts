"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { postLoginPath } from "@/lib/auth";
import type { ActionState } from "@/lib/types";
import { cleanUrl, parseTags, safeRedirectPath, slugifyTag } from "@/lib/utils";

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function text(formData: FormData, key: string, max: number): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

async function requireUser(next = "/") {
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, user };
}

async function siteOrigin(): Promise<string> {
  if (env.siteUrl) return env.siteUrl;
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------- auth

export async function signInWithEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData, "email", 320);
  const next = safeRedirectPath(String(formData.get("next") ?? ""));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function verifyEmailCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData, "email", 320);
  const token = text(formData, "code", 12).replace(/\s/g, "");
  const next = safeRedirectPath(String(formData.get("next") ?? ""));
  if (!/^\d{6,10}$/.test(token)) return { error: "Enter the code from the email (digits only)." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) return { error: error?.message ?? "That code didn't work. Request a new one." };

  revalidatePath("/", "layout");
  redirect(await postLoginPath(supabase, data.user.id, next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

// ---------------------------------------------------------------- projects

export async function createProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser("/new");

  const title = text(formData, "title", 120);
  const summary = text(formData, "summary", 280);
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const linkRaw = text(formData, "link_url", 2000);
  const sourceRaw = text(formData, "source_url", 2000);
  const link_url = cleanUrl(linkRaw);
  const source_url = cleanUrl(sourceRaw);

  if (title.length < 3) return { error: "Give your project a title (at least 3 characters)." };
  if (!summary) return { error: "Add a one-line summary so people know what it does." };
  if (tags.length === 0) return { error: "Add at least one tag, e.g. pokemon, fire-tv, tesla." };
  if (linkRaw && !link_url) return { error: "Project link must be a valid http(s) URL." };
  if (sourceRaw && !source_url) return { error: "Source link must be a valid http(s) URL." };

  let cover_url: string | null = null;
  const cover = formData.get("cover");
  if (cover instanceof File && cover.size > 0) {
    const ext = COVER_TYPES[cover.type];
    if (!ext) return { error: "Cover image must be PNG, JPG, WebP or GIF." };
    if (cover.size > MAX_COVER_BYTES) return { error: "Cover image must be 5 MB or smaller." };
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("covers")
      .upload(path, cover, { contentType: cover.type, upsert: false });
    if (uploadError) return { error: `Image upload failed: ${uploadError.message}` };
    cover_url = supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      author_id: user.id,
      title,
      summary,
      tags,
      link_url,
      source_url,
      cover_url,
      body: text(formData, "body", 20000) || null,
      prompt: text(formData, "prompt", 20000) || null,
      made_with: text(formData, "made_with", 80) || null,
      works_on: text(formData, "works_on", 200) || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(`/p/${data.id}`);
}

export async function deleteProject(projectId: string) {
  const { supabase, user } = await requireUser(`/p/${projectId}`);
  const { data: project } = await supabase
    .from("projects")
    .select("cover_url")
    .eq("id", projectId)
    .eq("author_id", user.id)
    .single();

  await supabase.from("projects").delete().eq("id", projectId).eq("author_id", user.id);

  const marker = "/object/public/covers/";
  if (project?.cover_url?.includes(marker)) {
    await supabase.storage.from("covers").remove([project.cover_url.split(marker)[1]]);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

// ---------------------------------------------------------------- engagement

export async function toggleVote(projectId: string, currentlyVoted: boolean) {
  const { supabase, user } = await requireUser(`/p/${projectId}`);
  if (currentlyVoted) {
    await supabase.from("votes").delete().eq("user_id", user.id).eq("project_id", projectId);
  } else {
    await supabase.from("votes").upsert({ user_id: user.id, project_id: projectId }, { ignoreDuplicates: true });
  }
  revalidatePath("/", "layout");
}

export async function toggleFollowTag(rawTag: string, currentlyFollowing: boolean) {
  const tag = slugifyTag(rawTag);
  const { supabase, user } = await requireUser(`/t/${tag}`);
  if (currentlyFollowing) {
    await supabase.from("tag_follows").delete().eq("user_id", user.id).eq("tag", tag);
  } else {
    await supabase.from("tag_follows").upsert({ user_id: user.id, tag }, { ignoreDuplicates: true });
  }
  revalidatePath("/", "layout");
}

export async function addComment(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser(`/p/${projectId}`);
  const body = text(formData, "body", 5000);
  if (!body) return { error: "Comment can't be empty." };
  const { error } = await supabase.from("comments").insert({ project_id: projectId, author_id: user.id, body });
  if (error) return { error: error.message };
  revalidatePath(`/p/${projectId}`);
  return { ok: true };
}

export async function deleteComment(projectId: string, commentId: string) {
  const { supabase, user } = await requireUser(`/p/${projectId}`);
  await supabase.from("comments").delete().eq("id", commentId).eq("author_id", user.id);
  revalidatePath(`/p/${projectId}`);
}

export async function submitWorksReport(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser(`/p/${projectId}`);
  const worked = formData.get("worked");
  if (worked !== "yes" && worked !== "no") return { error: "Pick whether it worked for you." };
  const { error } = await supabase.from("works_reports").upsert(
    {
      user_id: user.id,
      project_id: projectId,
      worked: worked === "yes",
      setup: text(formData, "setup", 200) || null,
    },
    { onConflict: "user_id,project_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/p/${projectId}`);
  return { ok: true };
}

export async function reportProject(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser(`/p/${projectId}`);
  const reason = text(formData, "reason", 1000);
  if (!reason) return { error: "Tell us what's wrong." };
  const { error } = await supabase.from("reports").insert({ project_id: projectId, reporter_id: user.id, reason });
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------- profile

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser("/settings");
  const username = text(formData, "username", 24).toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return { error: "Username must be 3–24 characters: lowercase letters, numbers and underscores." };
  }
  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      display_name: text(formData, "display_name", 60) || null,
      bio: text(formData, "bio", 300) || null,
    })
    .eq("id", user.id);
  if (error) {
    if (error.code === "23505") return { error: "That username is taken." };
    return { error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
