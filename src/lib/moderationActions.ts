"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getModerator } from "@/lib/moderation";
import { pollPendingScans } from "@/lib/scanner";
import type { ActionState } from "@/lib/types";

function text(formData: FormData, key: string, max: number): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

async function requireModAdmin() {
  const mod = await getModerator();
  if (!mod) return { error: "Unauthorized." } as const;
  if (!mod.admin) {
    return { error: "SUPABASE_SECRET_KEY must be configured on the server for moderation actions." } as const;
  }
  return { mod, admin: mod.admin } as const;
}

async function applyStrike(
  admin: SupabaseClient,
  moderatorId: string,
  targetUserId: string,
  reportId: string | null,
  reason: string,
) {
  const { data: target } = await admin
    .from("profiles")
    .select("strikes,banned_at")
    .eq("id", targetUserId)
    .maybeSingle();
  if (!target) return;

  const nextStrikes = ((target.strikes as number) ?? 0) + 1;
  const now = new Date().toISOString();
  const autoBan = nextStrikes >= 3 && !target.banned_at;

  await admin
    .from("profiles")
    .update({
      strikes: nextStrikes,
      ...(autoBan
        ? { banned_at: now, ban_reason: "Automatic ban after reaching 3 strikes." }
        : {}),
    })
    .eq("id", targetUserId);

  await admin.from("moderation_actions").insert({
    moderator_id: moderatorId,
    target_user_id: targetUserId,
    report_id: reportId,
    action: "issue_strike",
    reason,
  });

  if (autoBan) {
    await admin.from("moderation_actions").insert({
      moderator_id: moderatorId,
      target_user_id: targetUserId,
      report_id: reportId,
      action: "ban_user",
      reason: "Automatic ban after reaching 3 strikes.",
    });
  }
}

export async function dismissReport(reportId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireModAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { mod, admin } = ctx;

  const notes = text(formData, "reason", 1000) || "Reviewed and dismissed.";
  const now = new Date().toISOString();

  const { error } = await admin
    .from("reports")
    .update({
      status: "dismissed",
      resolved_at: now,
      resolved_by: mod.user.id,
      moderator_notes: notes,
    })
    .eq("id", reportId);
  if (error) return { error: error.message };

  await admin.from("moderation_actions").insert({
    moderator_id: mod.user.id,
    report_id: reportId,
    action: "dismiss_report",
    reason: notes,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moderateHideProject(
  projectId: string,
  reportId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireModAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { mod, admin } = ctx;

  const reason = text(formData, "reason", 500);
  if (reason.length < 3) return { error: "Provide a reason for hiding this project." };
  const issueStrike = formData.get("issue_strike") === "on";

  const { data: project } = await admin
    .from("projects")
    .select("author_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("projects")
    .update({ hidden_at: now, hidden_reason: reason, hidden_by: mod.user.id })
    .eq("id", projectId);
  if (error) return { error: error.message };

  await admin.from("moderation_actions").insert({
    moderator_id: mod.user.id,
    target_user_id: project.author_id,
    project_id: projectId,
    report_id: reportId,
    action: "hide_project",
    reason,
  });

  if (reportId) {
    await admin
      .from("reports")
      .update({ status: "actioned", resolved_at: now, resolved_by: mod.user.id, moderator_notes: reason })
      .eq("id", reportId);
  }

  if (issueStrike && project.author_id) {
    await applyStrike(admin, mod.user.id, project.author_id, reportId, reason);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moderateRestoreProject(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireModAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { mod, admin } = ctx;

  const reason = text(formData, "reason", 500) || "Restored by moderator.";
  const { data: project } = await admin
    .from("projects")
    .select("author_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const { error } = await admin
    .from("projects")
    .update({ hidden_at: null, hidden_reason: null, hidden_by: null })
    .eq("id", projectId);
  if (error) return { error: error.message };

  await admin.from("moderation_actions").insert({
    moderator_id: mod.user.id,
    target_user_id: project.author_id,
    project_id: projectId,
    action: "restore_project",
    reason,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moderateDeleteProject(projectId: string) {
  const ctx = await requireModAdmin();
  if ("error" in ctx) return;
  const { mod, admin } = ctx;

  const [{ data: project }, { data: releases }] = await Promise.all([
    admin.from("projects").select("title,author_id,cover_path").eq("id", projectId).maybeSingle(),
    admin.from("project_releases").select("file_path").eq("project_id", projectId),
  ]);
  if (!project) return;

  await admin.from("projects").delete().eq("id", projectId);

  if (project.cover_path) await admin.storage.from("covers").remove([project.cover_path]);
  const files = (releases ?? []).map((r) => r.file_path as string | null).filter((f): f is string => !!f);
  if (files.length) await admin.storage.from("files").remove(files);

  await admin.from("moderation_actions").insert({
    moderator_id: mod.user.id,
    target_user_id: project.author_id,
    action: "delete_project",
    reason: `Permanently deleted project "${project.title}".`,
  });

  revalidatePath("/", "layout");
}

export async function moderateHideComment(
  commentId: string,
  reportId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireModAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { mod, admin } = ctx;

  const reason = text(formData, "reason", 500);
  if (reason.length < 3) return { error: "Provide a reason for hiding this comment." };
  const issueStrike = formData.get("issue_strike") === "on";

  const { data: comment } = await admin
    .from("comments")
    .select("author_id,project_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return { error: "Comment not found." };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("comments")
    .update({ hidden_at: now, hidden_reason: reason })
    .eq("id", commentId);
  if (error) return { error: error.message };

  await admin.from("moderation_actions").insert({
    moderator_id: mod.user.id,
    target_user_id: comment.author_id,
    project_id: comment.project_id,
    comment_id: commentId,
    report_id: reportId,
    action: "hide_comment",
    reason,
  });

  if (reportId) {
    await admin
      .from("reports")
      .update({ status: "actioned", resolved_at: now, resolved_by: mod.user.id, moderator_notes: reason })
      .eq("id", reportId);
  }

  if (issueStrike && comment.author_id) {
    await applyStrike(admin, mod.user.id, comment.author_id, reportId, reason);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moderateRestoreComment(commentId: string) {
  const ctx = await requireModAdmin();
  if ("error" in ctx) return;
  const { mod, admin } = ctx;

  const { data: comment } = await admin
    .from("comments")
    .select("author_id,project_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return;

  await admin.from("comments").update({ hidden_at: null, hidden_reason: null }).eq("id", commentId);
  await admin.from("moderation_actions").insert({
    moderator_id: mod.user.id,
    target_user_id: comment.author_id,
    project_id: comment.project_id,
    comment_id: commentId,
    action: "restore_comment",
    reason: "Restored by moderator.",
  });

  revalidatePath("/", "layout");
}

export async function moderateReleaseScan(
  releaseId: string,
  nextStatus: "malicious" | "clean",
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireModAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { mod, admin } = ctx;

  const reason =
    text(formData, "reason", 500) ||
    (nextStatus === "malicious" ? "Quarantined by moderator." : "Marked clean after manual review.");

  const { data: rel } = await admin
    .from("project_releases")
    .select("project_id,version")
    .eq("id", releaseId)
    .maybeSingle();
  if (!rel) return { error: "Release not found." };

  const { error } = await admin
    .from("project_releases")
    .update({ scan_status: nextStatus, scanned_at: new Date().toISOString() })
    .eq("id", releaseId);
  if (error) return { error: error.message };

  await admin.from("moderation_actions").insert({
    moderator_id: mod.user.id,
    project_id: rel.project_id,
    action: nextStatus === "malicious" ? "quarantine_release" : "clear_release",
    reason: `v${rel.version}: ${reason}`,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moderateUser(
  targetUserId: string,
  reportId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireModAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { mod, admin } = ctx;

  if (targetUserId === mod.user.id) return { error: "You can't moderate your own account." };

  const operation = text(formData, "operation", 40);
  const reason = text(formData, "reason", 500);
  if (reason.length < 3) return { error: "Provide a reason for the audit log." };

  const { data: target } = await admin
    .from("profiles")
    .select("role,strikes,banned_at")
    .eq("id", targetUserId)
    .maybeSingle();
  if (!target) return { error: "User not found." };

  if (target.role === "admin" && mod.profile.role !== "admin") {
    return { error: "Only admins can moderate admin accounts." };
  }

  const now = new Date();
  let actionName:
    | "issue_strike"
    | "revoke_strike"
    | "suspend_user"
    | "ban_user"
    | "unban_user" = "issue_strike";

  if (operation === "issue_strike") {
    await applyStrike(admin, mod.user.id, targetUserId, reportId, reason);
  } else {
    let update: Record<string, unknown> = {};
    if (operation === "revoke_strike") {
      actionName = "revoke_strike";
      update = { strikes: Math.max(0, ((target.strikes as number) ?? 0) - 1) };
    } else if (operation === "suspend_7d") {
      actionName = "suspend_user";
      update = { suspended_until: new Date(now.getTime() + 7 * 86_400_000).toISOString(), ban_reason: reason };
    } else if (operation === "suspend_30d") {
      actionName = "suspend_user";
      update = { suspended_until: new Date(now.getTime() + 30 * 86_400_000).toISOString(), ban_reason: reason };
    } else if (operation === "ban") {
      actionName = "ban_user";
      update = { banned_at: now.toISOString(), ban_reason: reason };
    } else if (operation === "unban") {
      actionName = "unban_user";
      update = { banned_at: null, suspended_until: null, ban_reason: null };
    } else {
      return { error: "Unknown moderation action." };
    }

    const { error } = await admin.from("profiles").update(update).eq("id", targetUserId);
    if (error) return { error: error.message };

    await admin.from("moderation_actions").insert({
      moderator_id: mod.user.id,
      target_user_id: targetUserId,
      report_id: reportId,
      action: actionName,
      reason,
    });
  }

  if (reportId) {
    await admin
      .from("reports")
      .update({
        status: "actioned",
        resolved_at: now.toISOString(),
        resolved_by: mod.user.id,
        moderator_notes: reason,
      })
      .eq("id", reportId);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function refreshPendingScans() {
  const ctx = await requireModAdmin();
  if ("error" in ctx) return;
  await pollPendingScans(ctx.admin, 15);
  revalidatePath("/admin");
}
