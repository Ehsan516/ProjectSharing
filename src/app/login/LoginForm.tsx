"use client";

import { useActionState, useState } from "react";
import { signInWithEmail, verifyEmailCode } from "@/lib/actions";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";

/**
 * Email sign-in. The email always has a sign-in link; it only has a code if the Supabase
 * template includes {{ .Token }}. So the link is the main path, and the code box is optional.
 */
export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [sendState, sendAction] = useActionState(signInWithEmail, undefined);
  const [codeState, codeAction] = useActionState(verifyEmailCode, undefined);

  if (sendState?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-border bg-surface-2 p-4 text-sm">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1 text-muted">
            We sent a sign-in link to <strong className="text-text">{email}</strong>. Open it in this browser to finish
            signing in. It can take a minute to arrive, so check spam too.
          </p>
        </div>

        {showCode ? (
          <form action={codeAction} className="flex flex-col gap-3">
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="next" value={next} />
            <label htmlFor="code" className="label">
              Sign-in code
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={12}
              placeholder="123456"
              className="input text-center font-mono text-lg tracking-[0.3em]"
            />
            <FormMessage state={codeState} />
            <SubmitButton pendingText="Checking…" className="btn-primary w-full">
              Sign in with code
            </SubmitButton>
          </form>
        ) : (
          <button type="button" onClick={() => setShowCode(true)} className="link-action self-start">
            Email has a code instead? Enter it here
          </button>
        )}

        <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
          <form action={sendAction}>
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="hover:text-text">
              Send it again
            </button>
          </form>
          <button type="button" onClick={() => window.location.reload()} className="hover:text-text">
            Use a different email
          </button>
        </div>
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
