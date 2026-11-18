"use client";

import { useOptimistic, useTransition } from "react";
import { setReaction } from "@/lib/actions";

export type Reaction = 1 | -1 | 0;

type State = { reaction: Reaction; likes: number; dislikes: number };

function apply(state: State, next: Reaction): State {
  let { likes, dislikes } = state;
  if (state.reaction === 1) likes--;
  if (state.reaction === -1) dislikes--;
  if (next === 1) likes++;
  if (next === -1) dislikes++;
  return { reaction: next, likes, dislikes };
}

/** Like / dislike pill. Clicking your current choice again clears it. */
export function VoteButton({
  projectId,
  reaction,
  likes,
  dislikes,
  size = "sm",
}: {
  projectId: string;
  reaction: Reaction;
  likes: number;
  dislikes: number;
  size?: "sm" | "lg";
}) {
  const [pending, startTransition] = useTransition();
  const [state, setOptimistic] = useOptimistic<State>({ reaction, likes, dislikes });

  function choose(e: React.MouseEvent, value: 1 | -1) {
    e.preventDefault();
    e.stopPropagation();
    const next: Reaction = state.reaction === value ? 0 : value;
    startTransition(async () => {
      setOptimistic(apply(state, next));
      await setReaction(projectId, next);
    });
  }

  const big = size === "lg";
  const half = `flex items-center gap-1.5 font-semibold transition disabled:opacity-60 ${
    big ? "h-10 px-3.5 text-sm" : "h-7 px-2 text-[11px]"
  }`;
  const icon = big ? 16 : 13;

  return (
    <div className="flex shrink-0 items-center overflow-hidden rounded-md border border-border bg-surface font-mono">
      <button
        type="button"
        onClick={(e) => choose(e, 1)}
        disabled={pending}
        aria-pressed={state.reaction === 1}
        aria-label={state.reaction === 1 ? "Remove like" : "Like"}
        className={`${half} ${state.reaction === 1 ? "bg-signal text-signal-fg" : "text-text hover:bg-surface-2"}`}
      >
        <ThumbIcon size={icon} filled={state.reaction === 1} />
        {state.likes}
      </button>
      <span aria-hidden className="w-px self-stretch bg-border" />
      <button
        type="button"
        onClick={(e) => choose(e, -1)}
        disabled={pending}
        aria-pressed={state.reaction === -1}
        aria-label={state.reaction === -1 ? "Remove dislike" : "Dislike"}
        className={`${half} ${state.reaction === -1 ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2 hover:text-text"}`}
      >
        <ThumbIcon size={icon} filled={state.reaction === -1} down />
        {state.dislikes}
      </button>
    </div>
  );
}

function ThumbIcon({ size, filled, down = false }: { size: number; filled: boolean; down?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={down ? { transform: "scaleY(-1)" } : undefined}
    >
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Z" />
      <path d="M7 10l4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8a2 2 0 0 1-2 1.7H7" />
    </svg>
  );
}
