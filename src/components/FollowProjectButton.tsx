"use client";

import { useOptimistic, useTransition } from "react";

export function FollowProjectButton({
  action,
  following,
  variant = "button",
}: {
  action: (currentlyFollowing: boolean) => Promise<void>;
  following: boolean;
  variant?: "button" | "link";
}) {
  const [pending, startTransition] = useTransition();
  const [isFollowing, setOptimistic] = useOptimistic(following);

  return (
    <button
      type="button"
      disabled={pending}
      title="Get new releases of this project in your For you feed"
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!isFollowing);
          await action(isFollowing);
        })
      }
      className={variant === "link" ? "link-action" : isFollowing ? "btn-ghost" : "btn-primary"}
    >
      {isFollowing ? "✓ Following updates" : variant === "link" ? "Follow for updates ›" : "Follow for updates"}
    </button>
  );
}
