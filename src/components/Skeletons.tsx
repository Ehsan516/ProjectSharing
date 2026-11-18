/** Grey placeholder shapes shown while a page loads. */
export function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="card flex flex-col overflow-hidden" aria-hidden>
      <div className="aspect-video animate-pulse bg-surface-2" />
      <div className="flex flex-col gap-2 p-4">
        <Bone className="h-5 w-2/3" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-4/5" />
        <div className="mt-3 flex items-center gap-2">
          <Bone className="h-5 w-5 rounded-full" />
          <Bone className="h-3 w-24" />
          <Bone className="ml-auto h-7 w-20" />
        </div>
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 6, wide = false }: { count?: number; wide?: boolean }) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${wide ? "lg:grid-cols-3 xl:grid-cols-4" : "xl:grid-cols-3"}`}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** For form pages (sign in, settings, posting), so they don't flash the feed skeleton. */
export function FormSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto flex max-w-2xl flex-col gap-5">
      <Bone className="h-8 w-48" />
      <Bone className="h-4 w-2/3" />
      <Bone className="mt-2 h-10 w-full" />
      <Bone className="h-10 w-full" />
      <Bone className="h-24 w-full" />
      <Bone className="ml-auto h-10 w-32" />
    </div>
  );
}
