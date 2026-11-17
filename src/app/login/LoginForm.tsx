"use client";

import { useActionState, useState } from "react";
import { signInWithEmail, verifyEmailCode } from "@/lib/actions";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [sendState, sendAction] = useActionState(signInWithEmail, undefined);
  const [codeState, codeAction] = useActionState(verifyEmailCode, undefined);

  if (sendState?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-lg bg-accent-soft p-3 text-sm">
          We sent an email to <strong>{email}</strong>. Click the link in it, or enter the code below.
        </p>
        <form action={codeAction} className="flex flex-col gap-3">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <label htmlFor="code" className="label">
            Code from the email
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={12}
            placeholder="123456"
            className="input text-center font-mono text-lg tracking-[0.3em]"
          />
          <FormMessage state={codeState} />
          <SubmitButton pendingText="Checking…" className="btn-primary w-full">
            Sign in
          </SubmitButton>
        </form>
        <button type="button" onClick={() => window.location.reload()} className="text-xs text-muted hover:text-text">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form action={sendAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="sr-only">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="input"
      />
      <FormMessage state={sendState} />
      <SubmitButton pendingText="Sending…" className="btn-primary w-full">
        Email me a sign-in link
      </SubmitButton>
    </form>
  );
}
