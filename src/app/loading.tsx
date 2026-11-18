import { Bone, FeedSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading">
      <Bone className="mb-5 h-8 w-56" />
      <FeedSkeleton />
    </div>
  );
}
