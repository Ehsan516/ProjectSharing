"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { postLoginPath } from "@/lib/auth";
import type { ActionState } from "@/lib/types";
import { cleanUrl, parseTags, parseYouTubeId, safeRedirectPath, slugifyTag } from "@/lib/utils";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const FILE_PATH = new RegExp(`^(${UUID})/(${UUID}[.]zip)$`);
const COVER_PATH = new RegExp(`^(${UUID})/(${UUID}[.](?:png|jpg|webp|gif))$`);

/** Confirms an uploaded object exists in the user's folder and returns its real size. */
async function findUpload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: "files" | "covers",
  path: string,
): Promise<number | null> {
  const [folder, name] = path.split("/");
  const { data } = await supabase.storage.from(bucket).list(folder, { search: name, limit: 1 });
  const hit = data?.find((o) => o.name === name);
  return hit ? Number(hit.metadata?.size ?? 0) : null;
}

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

type ZipUpload = { file_path: string | null; file_name: string | null; file_size: number | null };

/** Validates a zip that the browser uploaded directly to storage. */
async function verifyZip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  formData: FormData,
): Promise<ZipUpload | { error: string }> {
  const file_path = text(formData, "file_path", 200) || null;
  if (!file_path) return { file_path: null, file_name: null, file_size: null };
  const m = file_path.match(FILE_PATH);
  if (!m || m[1] !== userId) return { error: "Invalid file upload. Try attaching it again." };
  const file_size = await findUpload(supabase, "files", file_path);
  if (file_size === null) return { error: "The zip upload didn't finish. Try attaching it again." };
  let file_name =
    text(formData, "file_name", 200)
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
      .replace(/^\.+/, "") || "download.zip";
  if (!file_name.toLowerCase().endsWith(".zip")) file_name += ".zip";
  return { file_path, file_name, file_size };
}

const VERSION = /^[A-Za-z0-9][A-Za-z0-9._+\- ]{0,39}$/;

function readVersion(formData: FormData): string {
  return text(formData, "version", 40).replace(/^v(?=\d)/i, "");
}

export async function createProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser("/new");

  const title = text(formData, "title", 120);
  const summary = text(formData, "summary", 280);
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const linkRaw = text(formData, "link_url", 2000);
  const sourceRaw = text(formData, "source_url", 2000);
  const youtubeRaw = text(formData, "youtube_url", 2000);
  const link_url = cleanUrl(linkRaw);
  const source_url = cleanUrl(sourceRaw);
  const youtube_id = parseYouTubeId(youtubeRaw);
  const works_on = text(formData, "works_on", 200) || null;
  const versionRaw = readVersion(formData);

  if (title.length < 3) return { error: "Give your project a title (at least 3 characters)." };
  if (!summary) return { error: "Add a one-line summary so people know what it does." };
  if (tags.length === 0) return { error: "Add at least one tag so people can find it." };
  if (linkRaw && !link_url) return { error: "Project link must be a valid http(s) URL." };
  if (sourceRaw && !source_url) return { error: "Source link must be a valid http(s) URL." };
  if (youtubeRaw && !youtube_id) return { error: "That doesn't look like a YouTube video link." };
  if (versionRaw && !VERSION.test(versionRaw)) return { error: "Version can use letters, numbers, dots and dashes, e.g. 1.0" };

  const zip = await verifyZip(supabase, user.id, formData);
  if ("error" in zip) return zip;

  const cover_path = text(formData, "cover_path", 200) || null;
  let cover_url: string | null = null;
  if (cover_path) {
    const m = cover_path.match(COVER_PATH);
    if (!m || m[1] !== user.id) return { error: "Invalid cover image. Try attaching it again." };
    if ((await findUpload(supabase, "covers", cover_path)) === null) {
      return { error: "The cover image upload didn't finish. Try again." };
    }
    cover_url = supabase.storage.from("covers").getPublicUrl(cover_path).data.publicUrl;
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
      youtube_id,
      cover_path,
      cover_url,
      works_on,
      body: text(formData, "body", 20000) || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // A zip or a version number makes the first release.
  if (zip.file_path || versionRaw) {
    const { error: releaseError } = await supabase.from("project_releases").insert({
      project_id: data.id,
      version: versionRaw || "1.0",
      changelog: "Initial release",
      works_on,
      ...zip,
    });
    if (releaseError) {
      await supabase.from("projects").delete().eq("id", data.id);
      return { error: releaseError.message };
    }
  }

  revalidatePath("/", "layout");
  redirect(`/p/${data.id}`);
}

export async function deleteProject(projectId: string) {
  const { supabase, user } = await requireUser(`/p/${projectId}`);
  const [{ data: project }, { data: releases }] = await Promise.all([
    supabase.from("projects").select("cover_path").eq("id", projectId).eq("author_id", user.id).single(),
    supabase.from("project_releases").select("file_path").eq("project_id", projectId),
  ]);
  if (!project) redirect(`/p/${projectId}`);

  await supabase.from("projects").delete().eq("id", projectId).eq("author_id", user.id);

  if (project.cover_path) await supabase.storage.from("covers").remove([project.cover_path]);
  const files = (releases ?? []).map((r) => r.file_path as string | null).filter((f): f is string => !!f);
  if (files.length) await supabase.storage.from("files").remove(files);

  revalidatePath("/", "layout");
  redirect("/");
}

// ---------------------------------------------------------------- releases

export async function createRelease(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser(`/p/${projectId}/release`);

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("author_id", user.id)
    .maybeSingle();
  if (!project) return { error: "Only the project's author can publish releases." };

  const version = readVersion(formData);
  if (!version) return { error: "Give this release a version, e.g. 1.1" };
  if (!VERSION.test(version)) return { error: "Version can use letters, numbers, dots and dashes, e.g. 1.1" };

  const zip = await verifyZip(supabase, user.id, formData);
  if ("error" in zip) return zip;

  const { error } = await supabase.from("project_releases").insert({
    project_id: projectId,
    version,
    changelog: text(formData, "changelog", 10000) || null,
    works_on: text(formData, "works_on", 200) || null,
    ...zip,
  });
  if (error) {
    if (zip.file_path) await supabase.storage.from("files").remove([zip.file_path]);
    if (error.code === "23505") return { error: `There's already a release called v${version}.` };
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(`/p/${projectId}#releases`);
}

export async function deleteRelease(projectId: string, releaseId: string) {
  const { supabase } = await requireUser(`/p/${projectId}`);
  const { data: release } = await supabase
    .from("project_releases")
    .select("file_path")
    .eq("id", releaseId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!release) return;

  // RLS only lets the project's author delete.
  const { count } = await supabase
    .from("project_releases")
    .delete({ count: "exact" })
    .eq("id", releaseId)
    .eq("project_id", projectId);
  if (count && release.file_path) await supabase.storage.from("files").remove([release.file_path]);

  revalidatePath("/", "layout");
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

export async function toggleFollowProject(projectId: string, currentlyFollowing: boolean) {
  const { supabase, user } = await requireUser(`/p/${projectId}`);
  if (currentlyFollowing) {
    await supabase.from("project_follows").delete().eq("user_id", user.id).eq("project_id", projectId);
  } else {
    await supabase
      .from("project_follows")
      .upsert({ user_id: user.id, project_id: projectId }, { ignoreDuplicates: true });
  }
  revalidatePath("/", "layout");
}

export async function submitWorksReport(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser(`/p/${projectId}`);
  const worked = formData.get("worked");
  if (worked !== "yes" && worked !== "no") return { error: "Pick whether it worked for you." };
  const releaseRaw = text(formData, "release_id", 36);
  const release_id = releaseRaw || null;
  if (release_id && !new RegExp(`^${UUID}$`).test(release_id)) return { error: "Pick a version." };

  const fields = { worked: worked === "yes", setup: text(formData, "setup", 200) || null };

  let existing = supabase.from("works_reports").select("id").eq("user_id", user.id).eq("project_id", projectId);
  existing = release_id ? existing.eq("release_id", release_id) : existing.is("release_id", null);
  const { data: found } = await existing.maybeSingle();

  const { error } = found
    ? await supabase.from("works_reports").update(fields).eq("id", found.id)
    : await supabase.from("works_reports").insert({ user_id: user.id, project_id: projectId, release_id, ...fields });
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
