import { Bone } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Bone className="h-10 w-3/4" />
        <Bone className="h-6 w-1/2" />
        <Bone className="h-4 w-40" />
      </div>
      <Bone className="aspect-video w-full rounded-lg" />
      <Bone className="h-11 w-48 rounded-md" />
      <Bone className="h-28 w-full rounded-lg" />
    </div>
  );
}
