"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  className = "btn-primary",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: { error?: string; ok?: boolean } | undefined }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
      {state.error}
    </p>
  );
}
