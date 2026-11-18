"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/lib/actions";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";

export function DeleteAccountForm({ username }: { username: string }) {
  const [state, formAction] = useActionState(deleteAccount, undefined);
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase().replace(/^@/, "") === username;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        This permanently deletes your account, profile, projects, releases, uploaded files, comments, reports, likes and
        follows. It can&apos;t be undone. Download your data first if you want a copy.
      </p>
      <label htmlFor="confirm" className="label">
        Type <span className="font-mono">{username}</span> to confirm
      </label>
      <input
        id="confirm"
        name="confirm"
        autoComplete="off"
        spellCheck={false}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        className="input"
      />
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton
          pendingText="Deleting…"
          className={`btn bg-bad text-white hover:brightness-110 ${matches ? "" : "pointer-events-none opacity-50"}`}
        >
          Delete my account
        </SubmitButton>
      </div>
    </form>
  );
}
