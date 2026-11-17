"use client";

import { useOptimistic, useTransition } from "react";
import { toggleVote } from "@/lib/actions";

export function VoteButton({
  projectId,
  voted,
  count,
  large = false,
}: {
  projectId: string;
  voted: boolean;
  count: number;
  large?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setOptimistic] = useOptimistic({ voted, count });

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      setOptimistic({ voted: !state.voted, count: state.count + (state.voted ? -1 : 1) });
      await toggleVote(projectId, state.voted);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={state.voted}
      aria-label={state.voted ? "Remove upvote" : "Upvote"}
      className={`flex shrink-0 flex-col items-center justify-center rounded-lg border font-semibold transition ${
        large ? "h-16 w-16 text-base" : "h-14 w-12 text-sm"
      } ${
        state.voted
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-surface text-text hover:border-accent hover:text-accent"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 4 3 15h6v5h6v-5h6z" />
      </svg>
      {state.count}
    </button>
  );
}
