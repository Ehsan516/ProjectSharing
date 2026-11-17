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
  existing,
}: {
  action: BoundAction;
  existing: { worked: boolean; setup: string | null } | null;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">Did it work for you?</span>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="worked" value="yes" defaultChecked={existing?.worked === true} required /> Yes
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="worked" value="no" defaultChecked={existing?.worked === false} /> No
        </label>
      </div>
      <div className="flex gap-2">
        <input
          name="setup"
          maxLength={200}
          defaultValue={existing?.setup ?? ""}
          placeholder="Your setup (device, version, OS…)"
          className="input"
        />
        <SubmitButton className="btn-ghost shrink-0">{existing ? "Update" : "Submit"}</SubmitButton>
      </div>
      <FormMessage state={state} />
      {state?.ok && <p className="text-sm text-good">Thanks, your report is in.</p>}
    </form>
  );
}

export function ReportForm({ action }: { action: BoundAction }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, undefined);

  if (state?.ok) return <p className="text-xs text-muted">Thanks, we&apos;ll take a look.</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-muted hover:text-bad">
        Report
      </button>
    );
  }
  return (
    <form action={formAction} className="flex w-full flex-col gap-2">
      <textarea
        name="reason"
        rows={2}
        required
        maxLength={1000}
        placeholder="What's wrong? (malware, stolen work, copyrighted files, spam…)"
        className="input"
      />
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
