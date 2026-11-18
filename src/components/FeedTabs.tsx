import Link from "next/link";
import type { FeedTab } from "@/lib/queries";

const LABELS: Record<FeedTab, string> = { foryou: "For you", new: "Latest", top: "Top" };

/** Text tabs with a signal-orange underline on the active one. */
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
    <nav aria-label="Feed" className="mb-5 flex gap-6 border-b border-border text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab}
          href={`${basePath}?tab=${tab}`}
          aria-current={tab === active ? "page" : undefined}
          className={`-mb-px border-b-2 pb-2.5 pt-1 font-medium transition ${
            tab === active ? "border-signal text-text" : "border-transparent text-muted hover:text-text"
          }`}
        >
          {LABELS[tab]}
        </Link>
      ))}
    </nav>
  );
}
