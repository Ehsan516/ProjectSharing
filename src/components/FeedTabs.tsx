import Link from "next/link";
import type { FeedTab } from "@/lib/queries";

const LABELS: Record<FeedTab, string> = { foryou: "For you", new: "New", top: "Top" };

export function FeedTabs({
  active,
  basePath,
  tabs = ["foryou", "new", "top"],
}: {
  active: FeedTab;
  basePath: string;
  tabs?: FeedTab[];
}) {
  return (
    <div className="mb-4 flex gap-1 rounded-lg border border-border bg-surface p-1 text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab}
          href={`${basePath}?tab=${tab}`}
          className={`flex-1 rounded-md px-3 py-1.5 text-center font-medium transition ${
            tab === active ? "bg-accent-soft text-accent" : "text-muted hover:text-text"
          }`}
        >
          {LABELS[tab]}
        </Link>
      ))}
    </div>
  );
}
