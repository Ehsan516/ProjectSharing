"use client";

import { useActionState, useTransition } from "react";
import type { ActionState } from "@/lib/types";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";

type BoundAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function InlineReasonForm({
  action,
  buttonLabel,
  placeholder,
  buttonClassName = "btn-ghost",
  withStrikeToggle = false,
  defaultReason = "",
}: {
  action: BoundAction;
  buttonLabel: string;
  placeholder: string;
  buttonClassName?: string;
  withStrikeToggle?: boolean;
  defaultReason?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="reason"
          maxLength={500}
          defaultValue={defaultReason}
          placeholder={placeholder}
          className="input min-w-[200px] flex-1"
        />
        <SubmitButton pendingText="Working…" className={buttonClassName}>
          {buttonLabel}
        </SubmitButton>
      </div>
      {withStrikeToggle && (
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="issue_strike" className="accent-[var(--accent)]" />
          Also issue 1 strike to the author (3 strikes auto-bans)
        </label>
      )}
      <FormMessage state={state} />
      {state?.ok && <p className="text-xs text-good">Updated.</p>}
    </form>
  );
}

export function UserModerationForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select name="operation" className="input w-auto shrink-0" aria-label="User action">
          <option value="issue_strike">Issue 1 strike</option>
          <option value="revoke_strike">Revoke 1 strike</option>
          <option value="suspend_7d">Suspend 7 days</option>
          <option value="suspend_30d">Suspend 30 days</option>
          <option value="ban">Ban permanently</option>
          <option value="unban">Unban / clear suspension</option>
        </select>
        <input
          name="reason"
          required
          minLength={3}
          maxLength={500}
          placeholder="Audit log reason…"
          className="input min-w-[200px] flex-1"
        />
        <SubmitButton pendingText="Applying…" className="btn-ghost text-bad">
          Apply
        </SubmitButton>
      </div>
      <FormMessage state={state} />
      {state?.ok && <p className="text-xs text-good">Account updated.</p>}
    </form>
  );
}

export function RefreshScansButton({ action }: { action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => startTransition(() => action())} className="btn-ghost">
      {pending ? "Checking VirusTotal…" : "Refresh pending scans"}
    </button>
  );
}
