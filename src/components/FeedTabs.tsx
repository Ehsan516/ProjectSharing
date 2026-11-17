import Link from "next/link";
import type { FeedTab } from "@/lib/queries";

const LABELS: Record<FeedTab, string> = { foryou: "For you", new: "Latest", top: "Top" };

/** Segmented control */
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
    <div className="mb-5 inline-flex rounded-full bg-surface-2 p-1 text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab}
          href={`${basePath}?tab=${tab}`}
          className={`rounded-full px-4 py-1.5 font-medium transition ${
            tab === active ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
          }`}
        >
          {LABELS[tab]}
        </Link>
      ))}
    </div>
  );
}
