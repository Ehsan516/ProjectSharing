import Link from "next/link";

export function TagChip({ tag, count }: { tag: string; count?: number }) {
  return (
    <Link
      href={`/t/${tag}`}
      className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted transition hover:bg-accent-soft hover:text-accent"
    >
      #{tag}
      {count !== undefined && <span className="opacity-60">{count}</span>}
    </Link>
  );
}
