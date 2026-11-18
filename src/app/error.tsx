"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        This page couldn&apos;t load. It&apos;s probably temporary, so try again in a moment.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-ghost">
          Back to the feed
        </Link>
      </div>
      {error.digest && <p className="mt-6 font-mono text-xs text-muted">Error ID: {error.digest}</p>}
    </div>
  );
}
