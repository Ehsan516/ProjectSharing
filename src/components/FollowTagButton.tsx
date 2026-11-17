"use client";

import { useOptimistic, useTransition } from "react";
import { toggleFollowTag } from "@/lib/actions";

export function FollowTagButton({ tag, following }: { tag: string; following: boolean }) {
  const [pending, startTransition] = useTransition();
  const [isFollowing, setOptimistic] = useOptimistic(following);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!isFollowing);
          await toggleFollowTag(tag, isFollowing);
        })
      }
      className={isFollowing ? "btn-ghost" : "btn-primary"}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
