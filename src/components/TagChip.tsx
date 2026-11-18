import Link from "next/link";

/** Topic label, set in mono like a workshop tag. */
export function TagChip({ tag, count }: { tag: string; count?: number }) {
  return (
    <Link
      href={`/t/${tag}`}
      className="inline-flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-px font-mono text-[11px] text-muted transition hover:border-text hover:text-text"
    >
      {tag}
      {count !== undefined && <span className="opacity-60">{count}</span>}
    </Link>
  );
}
