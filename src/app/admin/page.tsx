import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getModerator } from "@/lib/moderation";
import {
  dismissReport,
  moderateDeleteProject,
  moderateHideComment,
  moderateHideProject,
  moderateReleaseScan,
  moderateRestoreComment,
  moderateRestoreProject,
  moderateUser,
  refreshPendingScans,
} from "@/lib/moderationActions";
import { getUser } from "@/lib/supabase/server";
import type { ZipManifest } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import { ConfirmButton } from "@/components/ProjectForms";
import { TimeAgo } from "@/components/TimeAgo";
import { InlineReasonForm, RefreshScansButton, UserModerationForm } from "./ModerationControls";

export const metadata: Metadata = { title: "Moderation" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Tab = "reports" | "scans" | "hidden" | "users" | "log";

const KIND_PRIORITY: Record<string, number> = {
  malware: 0,
  illegal: 1,
  my_work: 2,
  rom_or_piracy: 3,
  harassment: 4,
  impersonation: 5,
  spam: 6,
  other: 7,
};

type ReportRow = {
  id: string;
  created_at: string;
  target_type: "project" | "comment" | "profile";
  kind: string;
  reason: string;
  project_id: string | null;
  comment_id: string | null;
  profile_id: string | null;
  reporter: { username: string } | null;
  project: {
    id: string;
    title: string;
    hidden_at: string | null;
    author: { id: string; username: string; strikes: number; banned_at: string | null } | null;
  } | null;
  comment: {
    id: string;
    body: string;
    hidden_at: string | null;
    project_id: string;
    author: { id: string; username: string; strikes: number; banned_at: string | null } | null;
  } | null;
  targetProfile: {
    id: string;
    username: string;
    strikes: number;
    suspended_until: string | null;
    banned_at: string | null;
  } | null;
};

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await getUser();
  if (!user) redirect("/login?next=/admin");
  const mod = await getModerator();
  if (!mod) notFound();

  const sp = await searchParams;
  const rawTab = typeof sp.tab === "string" ? sp.tab : "reports";
  const tab: Tab = (["reports", "scans", "hidden", "users", "log"] as const).includes(rawTab as Tab)
    ? (rawTab as Tab)
    : "reports";
  const userQuery = typeof sp.q === "string" ? sp.q.trim().slice(0, 40) : "";

  const db = mod.admin ?? mod.supabase;

  const [
    { count: openReportsCount },
    { count: flaggedScansCount },
    { count: hiddenProjectsCount },
    { count: hiddenCommentsCount },
  ] = await Promise.all([
    db.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    db
      .from("project_releases")
      .select("id", { count: "exact", head: true })
      .in("scan_status", ["malicious", "flagged", "pending", "error"]),
    db.from("projects").select("id", { count: "exact", head: true }).not("hidden_at", "is", null),
    db.from("comments").select("id", { count: "exact", head: true }).not("hidden_at", "is", null),
  ]);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "reports", label: "Reports", count: openReportsCount ?? 0 },
    { id: "scans", label: "File scans", count: flaggedScansCount ?? 0 },
    { id: "hidden", label: "Hidden", count: (hiddenProjectsCount ?? 0) + (hiddenCommentsCount ?? 0) },
    { id: "users", label: "Users" },
    { id: "log", label: "Audit log" },
  ];

  let reports: ReportRow[] = [];
  if (tab === "reports") {
    const { data } = await db
      .from("reports")
      .select(
        "id,created_at,target_type,kind,reason,project_id,comment_id,profile_id," +
          "reporter:profiles!reports_reporter_id_fkey(username)," +
          "project:projects!reports_project_id_fkey(id,title,hidden_at,author:profiles!projects_author_id_fkey(id,username,strikes,banned_at))," +
          "comment:comments!reports_comment_id_fkey(id,body,hidden_at,project_id,author:profiles!comments_author_id_fkey(id,username,strikes,banned_at))," +
          "targetProfile:profiles!reports_profile_id_fkey(id,username,strikes,suspended_until,banned_at)",
      )
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(100);
    reports = ((data ?? []) as unknown as ReportRow[]).sort(
      (a, b) => (KIND_PRIORITY[a.kind] ?? 99) - (KIND_PRIORITY[b.kind] ?? 99),
    );
  }

  const scans =
    tab === "scans"
      ? (
          await db
            .from("project_releases")
            .select(
              "id,project_id,version,file_name,file_size,file_sha256,file_manifest,scan_status,scan_positives,scan_total,scan_report_url,created_at,project:projects!project_releases_project_id_fkey(id,title,author:profiles!projects_author_id_fkey(username))",
            )
            .in("scan_status", ["malicious", "flagged", "pending", "error"])
            .order("created_at", { ascending: false })
            .limit(50)
        ).data ?? []
      : [];

  const [hiddenProjects, hiddenComments] =
    tab === "hidden"
      ? await Promise.all([
          db
            .from("projects")
            .select("id,title,hidden_at,hidden_reason,author:profiles!projects_author_id_fkey(username)")
            .not("hidden_at", "is", null)
            .order("hidden_at", { ascending: false })
            .limit(50),
          db
            .from("comments")
            .select("id,body,project_id,hidden_at,hidden_reason,author:profiles!comments_author_id_fkey(username)")
            .not("hidden_at", "is", null)
            .order("hidden_at", { ascending: false })
            .limit(50),
        ])
      : [{ data: [] }, { data: [] }];

  let userRows: {
    id: string;
    username: string;
    display_name: string | null;
    role: string;
    strikes: number;
    suspended_until: string | null;
    banned_at: string | null;
    ban_reason: string | null;
    created_at: string;
  }[] = [];
  if (tab === "users") {
    let q = db
      .from("profiles")
      .select("id,username,display_name,role,strikes,suspended_until,banned_at,ban_reason,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (userQuery) {
      const safe = userQuery.replace(/[%_\\]/g, "\\$&");
      q = q.or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`);
    } else {
      q = q.or("strikes.gt.0,banned_at.not.is.null,suspended_until.not.is.null");
    }
    userRows = (await q).data ?? [];
  }

  const logRows =
    tab === "log"
      ? (
          await db
            .from("moderation_actions")
            .select(
              "id,action,reason,created_at,project_id,moderator:profiles!moderation_actions_moderator_id_fkey(username),targetUser:profiles!moderation_actions_target_user_id_fkey(username),project:projects!moderation_actions_project_id_fkey(id,title)",
            )
            .order("created_at", { ascending: false })
            .limit(60)
        ).data ?? []
      : [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Moderation</h1>
        <p className="mt-1 text-sm text-muted">
          Signed in as @{mod.profile.username} ({mod.profile.role}). Every action is recorded in the audit log.
        </p>
      </div>

      {!mod.admin && (
        <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 p-4 text-sm text-bad">
          <code>SUPABASE_SECRET_KEY</code> is not set on the server, so moderation actions cannot be executed yet.
        </p>
      )}

      <nav aria-label="Moderation sections" className="flex flex-wrap gap-6 border-b border-border text-sm">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 pb-2.5 pt-1 font-medium transition ${
              t.id === tab ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="rounded bg-surface-2 px-1.5 font-mono text-xs text-muted">{t.count}</span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "reports" && (
        <section className="flex flex-col gap-4">
          {reports.length === 0 ? (
            <p className="panel p-8 text-center text-sm text-muted">No open reports. The queue is clear.</p>
          ) : (
            reports.map((r) => {
              const targetUser =
                r.target_type === "project"
                  ? r.project?.author
                  : r.target_type === "comment"
                    ? r.comment?.author
                    : r.targetProfile;

              return (
                <div key={r.id} className="card flex flex-col gap-4 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-bad/15 px-2 py-0.5 font-mono font-medium text-bad">{r.kind}</span>
                    <span className="rounded bg-surface-2 px-2 py-0.5 font-mono uppercase">{r.target_type}</span>
                    <span className="text-muted">
                      reported by {r.reporter ? `@${r.reporter.username}` : "unknown"} ·{" "}
                      <TimeAgo iso={r.created_at} />
                    </span>
                    {targetUser && (
                      <Link href={`/u/${targetUser.username}`} className="ml-auto font-mono text-accent hover:underline">
                        @{targetUser.username} ({targetUser.strikes} strikes{targetUser.banned_at ? ", banned" : ""})
                      </Link>
                    )}
                  </div>

                  <p className="whitespace-pre-wrap text-sm">{r.reason}</p>

                  {r.project && (
                    <div className="panel p-3 text-sm">
                      <span className="eyebrow block">Project</span>
                      <Link href={`/p/${r.project.id}`} className="font-medium text-accent hover:underline">
                        {r.project.title}
                      </Link>
                      {r.project.hidden_at && <span className="ml-2 text-xs text-bad">(already hidden)</span>}
                    </div>
                  )}

                  {r.comment && (
                    <div className="panel p-3 text-sm">
                      <span className="eyebrow block">Comment</span>
                      <p className="mt-1 whitespace-pre-wrap">{r.comment.body}</p>
                      <Link href={`/p/${r.comment.project_id}#comments`} className="mt-1 inline-block text-xs text-accent hover:underline">
                        View on project ›
                      </Link>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t border-border pt-3">
                    {r.target_type === "project" && r.project && !r.project.hidden_at && (
                      <InlineReasonForm
                        action={moderateHideProject.bind(null, r.project.id, r.id)}
                        buttonLabel="Hide project"
                        placeholder="Reason shown to author…"
                        buttonClassName="btn-ghost text-bad"
                        withStrikeToggle
                      />
                    )}
                    {r.target_type === "comment" && r.comment && !r.comment.hidden_at && (
                      <InlineReasonForm
                        action={moderateHideComment.bind(null, r.comment.id, r.id)}
                        buttonLabel="Hide comment"
                        placeholder="Reason for hiding comment…"
                        buttonClassName="btn-ghost text-bad"
                        withStrikeToggle
                      />
                    )}
                    {targetUser && (
                      <UserModerationForm action={moderateUser.bind(null, targetUser.id, r.id)} />
                    )}
                    <InlineReasonForm
                      action={dismissReport.bind(null, r.id)}
                      buttonLabel="Dismiss report"
                      placeholder="Optional resolution note…"
                    />
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {tab === "scans" && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Releases flagged, pending, malicious, or errored during scanning.</p>
            <RefreshScansButton action={refreshPendingScans} />
          </div>
          {scans.length === 0 ? (
            <p className="panel p-8 text-center text-sm text-muted">No flagged or pending release scans.</p>
          ) : (
            scans.map((s) => {
              const rel = s as unknown as {
                id: string;
                project_id: string;
                version: string;
                file_name: string | null;
                file_size: number | null;
                file_sha256: string | null;
                file_manifest: ZipManifest | null;
                scan_status: string;
                scan_positives: number;
                scan_total: number;
                scan_report_url: string | null;
                created_at: string;
                project: { id: string; title: string; author: { username: string } | null } | null;
              };
              return (
                <div key={rel.id} className="card flex flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-bad/15 px-2 py-0.5 font-mono font-medium text-bad">
                      {rel.scan_status} ({rel.scan_positives}/{rel.scan_total})
                    </span>
                    <span className="font-mono">v{rel.version}</span>
                    {rel.file_name && (
                      <span className="text-muted">
                        {rel.file_name} {rel.file_size ? `(${formatBytes(rel.file_size)})` : ""}
                      </span>
                    )}
                    <TimeAgo iso={rel.created_at} className="ml-auto text-muted" />
                  </div>
                  {rel.project && (
                    <p className="text-sm">
                      <Link href={`/p/${rel.project.id}`} className="font-medium text-accent hover:underline">
                        {rel.project.title}
                      </Link>{" "}
                      {rel.project.author && <span className="text-muted">by @{rel.project.author.username}</span>}
                    </p>
                  )}
                  {rel.file_sha256 && <code className="break-all font-mono text-xs text-muted">{rel.file_sha256}</code>}
                  {rel.file_manifest?.warnings.length ? (
                    <p className="text-xs text-bad">{rel.file_manifest.warnings.join(" · ")}</p>
                  ) : null}
                  {rel.scan_report_url && (
                    <a
                      href={rel.scan_report_url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-xs text-accent hover:underline"
                    >
                      Open VirusTotal report ↗
                    </a>
                  )}
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    {rel.scan_status !== "malicious" && (
                      <InlineReasonForm
                        action={moderateReleaseScan.bind(null, rel.id, "malicious")}
                        buttonLabel="Quarantine (block download)"
                        placeholder="Reason for quarantining…"
                        buttonClassName="btn-ghost text-bad"
                      />
                    )}
                    <InlineReasonForm
                      action={moderateReleaseScan.bind(null, rel.id, "clean")}
                      buttonLabel="Mark clean"
                      placeholder="Review note…"
                    />
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {tab === "hidden" && (
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="mb-3 text-xl font-bold">Hidden projects</h2>
            {(hiddenProjects.data ?? []).length === 0 ? (
              <p className="panel p-6 text-sm text-muted">No hidden projects.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {(hiddenProjects.data ?? []).map((item) => {
                  const p = item as unknown as {
                    id: string;
                    title: string;
                    hidden_at: string;
                    hidden_reason: string | null;
                    author: { username: string } | null;
                  };
                  return (
                    <div key={p.id} className="card flex flex-col gap-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <Link href={`/p/${p.id}`} className="font-medium text-accent hover:underline">
                          {p.title}
                        </Link>
                        <span className="text-xs text-muted">
                          {p.author ? `@${p.author.username}` : "unknown"} · hidden <TimeAgo iso={p.hidden_at} />
                        </span>
                      </div>
                      {p.hidden_reason && <p className="text-xs text-muted">Reason: {p.hidden_reason}</p>}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex-1">
                          <InlineReasonForm
                            action={moderateRestoreProject.bind(null, p.id)}
                            buttonLabel="Restore project"
                            placeholder="Optional restore note…"
                          />
                        </div>
                        <ConfirmButton
                          action={moderateDeleteProject.bind(null, p.id)}
                          confirmText={`Permanently delete "${p.title}" and all its files?`}
                          className="btn-ghost text-bad"
                        >
                          Delete permanently
                        </ConfirmButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-xl font-bold">Hidden comments</h2>
            {(hiddenComments.data ?? []).length === 0 ? (
              <p className="panel p-6 text-sm text-muted">No hidden comments.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {(hiddenComments.data ?? []).map((item) => {
                  const c = item as unknown as {
                    id: string;
                    body: string;
                    project_id: string;
                    hidden_at: string;
                    hidden_reason: string | null;
                    author: { username: string } | null;
                  };
                  return (
                    <div key={c.id} className="card flex flex-col gap-2 p-4 text-sm">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>{c.author ? `@${c.author.username}` : "unknown"}</span>
                        <TimeAgo iso={c.hidden_at} />
                      </div>
                      <p className="whitespace-pre-wrap">{c.body}</p>
                      {c.hidden_reason && <p className="text-xs text-muted">Reason: {c.hidden_reason}</p>}
                      <div className="flex items-center gap-3 pt-1">
                        <ConfirmButton
                          action={moderateRestoreComment.bind(null, c.id)}
                          confirmText="Restore this comment?"
                          className="btn-ghost text-xs"
                        >
                          Restore comment
                        </ConfirmButton>
                        <Link href={`/p/${c.project_id}#comments`} className="text-xs text-accent hover:underline">
                          View project ›
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "users" && (
        <section className="flex flex-col gap-4">
          <form action="/admin" className="flex gap-2">
            <input type="hidden" name="tab" value="users" />
            <input
              name="q"
              defaultValue={userQuery}
              placeholder="Search by username or display name…"
              className="input flex-1"
            />
            <button type="submit" className="btn-ghost">
              Search
            </button>
          </form>
          {userRows.length === 0 ? (
            <p className="panel p-8 text-center text-sm text-muted">
              {userQuery ? `No users matching "${userQuery}".` : "No users with strikes, suspensions, or bans."}
            </p>
          ) : (
            userRows.map((u) => (
              <div key={u.id} className="card flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link href={`/u/${u.username}`} className="font-mono font-medium text-accent hover:underline">
                    @{u.username}
                  </Link>
                  {u.display_name && <span className="text-muted">({u.display_name})</span>}
                  <span className="rounded bg-surface-2 px-1.5 font-mono text-xs">{u.role}</span>
                  <span className="rounded bg-surface-2 px-1.5 font-mono text-xs">{u.strikes} strikes</span>
                  {u.banned_at && <span className="rounded bg-bad px-1.5 font-mono text-xs text-white">Banned</span>}
                  {u.suspended_until && new Date(u.suspended_until).getTime() > Date.now() && (
                    <span className="rounded bg-bad/15 px-1.5 font-mono text-xs text-bad">
                      Suspended until {u.suspended_until.slice(0, 10)}
                    </span>
                  )}
                </div>
                {u.ban_reason && <p className="text-xs text-muted">Note: {u.ban_reason}</p>}
                <UserModerationForm action={moderateUser.bind(null, u.id, null)} />
              </div>
            ))
          )}
        </section>
      )}

      {tab === "log" && (
        <section>
          {logRows.length === 0 ? (
            <p className="panel p-8 text-center text-sm text-muted">No moderation actions recorded yet.</p>
          ) : (
            <ol className="card divide-y divide-border text-sm">
              {logRows.map((entry) => {
                const a = entry as unknown as {
                  id: string;
                  action: string;
                  reason: string;
                  created_at: string;
                  project_id: string | null;
                  moderator: { username: string } | null;
                  targetUser: { username: string } | null;
                  project: { id: string; title: string } | null;
                };
                return (
                  <li key={a.id} className="flex flex-col gap-1 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono font-medium">{a.action}</span>
                      <span>by {a.moderator ? `@${a.moderator.username}` : "system"}</span>
                      {a.targetUser && (
                        <Link href={`/u/${a.targetUser.username}`} className="text-accent hover:underline">
                          → @{a.targetUser.username}
                        </Link>
                      )}
                      {a.project && (
                        <Link href={`/p/${a.project.id}`} className="text-accent hover:underline">
                          ({a.project.title})
                        </Link>
                      )}
                      <TimeAgo iso={a.created_at} className="ml-auto text-muted" />
                    </div>
                    <p className="text-xs text-muted">{a.reason}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
