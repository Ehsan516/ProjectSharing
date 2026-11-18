import { timeAgo } from "@/lib/utils";

/** Relative time ("3d ago") with the exact date on hover. */
export function TimeAgo({ iso, prefix = "", className }: { iso: string; prefix?: string; className?: string }) {
  const exact = new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  return (
    <time dateTime={iso} title={`${exact} UTC`} className={className}>
      {prefix}
      {timeAgo(iso)}
    </time>
  );
}
