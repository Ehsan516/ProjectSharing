import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="mt-2 text-sm text-muted">That page doesn&apos;t exist or was removed.</p>
      <Link href="/" className="btn-primary mt-6">
        Back to the feed
      </Link>
    </div>
  );
}
