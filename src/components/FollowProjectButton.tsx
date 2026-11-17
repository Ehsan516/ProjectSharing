"use client";

import { useOptimistic, useTransition } from "react";

export function FollowProjectButton({
  action,
  following,
}: {
  action: (currentlyFollowing: boolean) => Promise<void>;
  following: boolean;
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
      className={isFollowing ? "btn-ghost" : "btn-primary"}
    >
      {isFollowing ? "✓ Following updates" : "Follow for updates"}
    </button>
  );
}
