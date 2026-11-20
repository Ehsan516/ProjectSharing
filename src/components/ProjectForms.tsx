"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { ActionState } from "@/lib/types";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";

type BoundAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function CommentForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-2">
      <textarea name="body" rows={3} maxLength={5000} required placeholder="Ask a question or share how it went…" className="input" />
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton pendingText="Posting…">Comment</SubmitButton>
      </div>
    </form>
  );
}

export function WorksReportForm({
  action,
  deleteAction,
  releases,
  myReports,
}: {
  action: BoundAction;
  deleteAction?: (releaseId: string | null) => Promise<void>;
  releases: { id: string; version: string }[]; // newest first
  myReports: { release_id: string | null; worked: boolean; setup: string | null }[];
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [deleting, startDelete] = useTransition();
  const [releaseId, setReleaseId] = useState(releases[0]?.id ?? "");
  const existing = myReports.find((r) => (r.release_id ?? "") === releaseId) ?? null;

  return (
    // key: reset the radio/setup defaults when switching versions
    <form key={releaseId} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="release_id" value={releaseId} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">Did it work for you?</span>
        {releases.length > 1 && (
          <select
            aria-label="Version"
            value={releaseId}
            onChange={(e) => setReleaseId(e.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs"
          >
            {releases.map((r, i) => (
              <option key={r.id} value={r.id}>
                v{r.version}
                {i === 0 ? " (latest)" : ""}
              </option>
            ))}
          </select>
        )}
        {releases.length === 1 && <span className="font-mono text-xs text-muted">v{releases[0].version}</span>}
        <label className="flex items-center gap-1.5">
          <input type="radio" name="worked" value="yes" defaultChecked={existing?.worked === true} required /> Yes
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="worked" value="no" defaultChecked={existing?.worked === false} /> No
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          name="setup"
          maxLength={200}
          defaultValue={existing?.setup ?? ""}
          placeholder="Your setup (device, version, OS…)"
          className="input min-w-[200px] flex-1"
        />
        <SubmitButton className="btn-ghost shrink-0">{existing ? "Update" : "Submit"}</SubmitButton>
        {existing && deleteAction && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (confirm("Remove your works-for-me report?")) {
                startDelete(() => deleteAction(releaseId || null));
              }
            }}
            className="btn-ghost shrink-0 text-bad"
          >
            {deleting ? "Removing…" : "Remove"}
          </button>
        )}
      </div>
      <FormMessage state={state} />
      {state?.ok && <p className="text-sm text-good">Thanks, your report is in.</p>}
    </form>
  );
}

type ReportTarget = "project" | "comment" | "profile";

const ALL_REPORT_KINDS = [
  {
    value: "my_work",
    targets: ["project"] as ReportTarget[],
    label: "This is my work, posted without my permission",
    hint: "Link to where you originally posted it, so we can check it's yours.",
  },
  {
    value: "malware",
    targets: ["project"] as ReportTarget[],
    label: "Malware, or it harms devices or data",
    hint: "What did it do, and which file?",
  },
  {
    value: "rom_or_piracy",
    targets: ["project"] as ReportTarget[],
    label: "ROM, pirated or cracked software",
    hint: "What's in it that shouldn't be?",
  },
  {
    value: "impersonation",
    targets: ["profile"] as ReportTarget[],
    label: "Impersonating someone else",
    hint: "Who are they impersonating, and what's their real account?",
  },
  {
    value: "harassment",
    targets: ["comment", "profile"] as ReportTarget[],
    label: "Harassment, hate or personal info",
    hint: "Tell us what happened.",
  },
  {
    value: "spam",
    targets: ["project", "comment", "profile"] as ReportTarget[],
    label: "Spam or scam",
    hint: "Tell us what's spammy or misleading.",
  },
  {
    value: "illegal",
    targets: ["project", "comment", "profile"] as ReportTarget[],
    label: "Illegal or harmful content",
    hint: "What's wrong with it?",
  },
  {
    value: "other",
    targets: ["project", "comment", "profile"] as ReportTarget[],
    label: "Something else",
    hint: "What's wrong?",
  },
] as const;

export function ReportForm({
  action,
  targetType = "project",
  buttonLabel = "Report",
  buttonClassName = "text-xs text-muted hover:text-bad",
}: {
  action: BoundAction;
  targetType?: ReportTarget;
  buttonLabel?: string;
  buttonClassName?: string;
}) {
  const kinds = ALL_REPORT_KINDS.filter((k) => k.targets.includes(targetType));
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>(kinds[0].value);
  const [state, formAction] = useActionState(action, undefined);
  const current = kinds.find((k) => k.value === kind) ?? kinds[0];

  if (state?.ok) {
    return (
      <p className="text-xs text-muted">
        {kind === "my_work"
          ? "Thanks. Ownership claims are reviewed first, and we'll take it down if it's yours."
          : "Thanks, we'll take a look."}
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClassName}>
        {buttonLabel}
      </button>
    );
  }
  return (
    <form action={formAction} className="flex w-full flex-col gap-2">
      <fieldset className="flex flex-col gap-1.5 text-sm">
        <legend className="mb-1 text-xs font-medium text-muted">What&apos;s the problem?</legend>
        {kinds.map((k) => (
          <label key={k.value} className="flex items-start gap-2">
            <input
              type="radio"
              name="kind"
              value={k.value}
              checked={kind === k.value}
              onChange={() => setKind(k.value)}
              className="mt-1 accent-[var(--accent)]"
            />
            <span>{k.label}</span>
          </label>
        ))}
      </fieldset>
      <textarea name="reason" rows={3} required maxLength={1000} placeholder={current.hint} className="input" />
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton className="btn-ghost text-bad">Send report</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ConfirmButton({
  action,
  confirmText,
  children,
  className = "text-xs text-muted hover:text-bad",
}: {
  action: () => Promise<void>;
  confirmText: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        if (confirm(confirmText)) startTransition(() => action());
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
