import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { formatCount } from "@/lib/utils";
import { CopyLink } from "./CopyLink";

export const metadata: Metadata = { title: "Traffic" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANGES = [7, 30, 90] as const;

type DayRow = { day: string; views: number; visitors: number; downloads: number };

export default async function TrafficPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const days = RANGES.find((r) => String(r) === sp.days) ?? 30;

  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=/p/${id}/traffic`);

  const { data: project } = await supabase
    .from("projects")
    .select("id,title,author_id,download_count")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();
  if (project.author_id !== user.id) redirect(`/p/${id}`);

  const since = isoDay(Date.now() - (days - 1) * 86_400_000);
  const [{ data: dayRows }, { data: refRows }, { data: releaseRows }] = await Promise.all([
    supabase.from("project_daily_stats").select("day,views,visitors,downloads").eq("project_id", id).gte("day", since),
    supabase.from("project_referrers").select("source,visitors").eq("project_id", id).gte("day", since),
    supabase
      .from("project_releases")
      .select("version,download_count,created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);

  // Fill in days with no traffic so the chart has no gaps.
  const byDay = new Map(((dayRows ?? []) as DayRow[]).map((r) => [r.day, r]));
  const series: DayRow[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = isoDay(Date.now() - i * 86_400_000);
    series.push(byDay.get(day) ?? { day, views: 0, visitors: 0, downloads: 0 });
  }
  const totals = series.reduce(
    (t, r) => ({ views: t.views + r.views, visitors: t.visitors + r.visitors, downloads: t.downloads + r.downloads }),
    { views: 0, visitors: 0, downloads: 0 },
  );
  const rate = totals.visitors > 0 ? Math.round((totals.downloads / totals.visitors) * 100) : null;

  const sourceTotals = new Map<string, number>();
  for (const r of (refRows ?? []) as { source: string; visitors: number }[]) {
    sourceTotals.set(r.source, (sourceTotals.get(r.source) ?? 0) + r.visitors);
  }
  const sources = [...sourceTotals.entries()].sort((a, b) => b[1] - a[1]);
  const sourceMax = sources[0]?.[1] ?? 0;
  const releases = (releaseRows ?? []) as { version: string; download_count: number }[];
  const releaseMax = Math.max(0, ...releases.map((r) => r.download_count));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <Link href={`/p/${id}`} className="text-sm text-muted hover:text-text">
          ← {project.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-bold">Traffic</h1>
          <nav aria-label="Time range" className="flex rounded-md border border-border bg-surface p-0.5 text-sm">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/p/${id}/traffic?days=${r}`}
                aria-current={r === days ? "page" : undefined}
                className={`rounded px-3 py-1 ${r === days ? "bg-surface-2 font-medium text-text" : "text-muted hover:text-text"}`}
              >
                {r} days
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-1 text-sm text-muted">Only you can see this. Your own visits aren&apos;t counted.</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Views" value={formatCount(totals.views)} />
        <Kpi label="Unique visitors" value={formatCount(totals.visitors)} />
        <Kpi label="Downloads" value={formatCount(totals.downloads)} />
        <Kpi
          label="Download rate"
          value={rate === null ? "None yet" : `${rate}%`}
          hint="Downloads per visitor"
        />
      </dl>

      <Chart title="Visitors" series={series} pick={(r) => r.visitors} detail={(r) => `${r.visitors} visitors, ${r.views} views`} />
      <Chart title="Downloads" series={series} pick={(r) => r.downloads} detail={(r) => `${r.downloads} downloads`} />

      <section>
        <h2 className="mb-3 text-xl font-bold">Where visitors came from</h2>
        {sources.length > 0 ? (
          <ul className="card divide-y divide-border">
            {sources.map(([source, n]) => (
              <li key={source} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-36 shrink-0 truncate font-medium">{source}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(n / sourceMax) * 100}%` }} />
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-xs">{formatCount(n)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel p-5 text-sm text-muted">No visitors in this period yet.</p>
        )}
        <div className="panel mt-3 flex flex-col gap-2 p-4 text-sm">
          <p>
            <span className="font-medium">Tip:</span>{" "}
            <span className="text-muted">
              Apps like TikTok often hide where a visitor came from, so they show up as &quot;Direct or app&quot;. Add{" "}
              <code className="font-mono text-xs">?ref=tiktok</code> to the link you post and it&apos;ll be counted as
              TikTok.
            </span>
          </p>
          <CopyLink path={`/p/${id}?ref=tiktok`} label="Copy your TikTok link" />
        </div>
      </section>

      {releases.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Downloads by version</h2>
          <ul className="card divide-y divide-border">
            {releases.map((r) => (
              <li key={r.version} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-24 shrink-0 font-mono">v{r.version}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: releaseMax ? `${(r.download_count / releaseMax) * 100}%` : "0%" }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-xs">{formatCount(r.download_count)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">All time. {formatCount(project.download_count)} downloads in total.</p>
        </section>
      )}

      <p className="text-xs text-muted">
        Counted without cookies. Unique visitors use a fingerprint that changes every day and can&apos;t be traced back
        to anyone. Days are in UTC.
      </p>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4" title={hint}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1.5 font-mono text-2xl font-medium">{value}</dd>
    </div>
  );
}

function Chart({
  title,
  series,
  pick,
  detail,
}: {
  title: string;
  series: DayRow[];
  pick: (r: DayRow) => number;
  detail: (r: DayRow) => string;
}) {
  const peak = Math.max(0, ...series.map(pick));
  const max = Math.max(1, peak);
  const label = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        <span className="font-mono text-xs text-muted">peak {formatCount(peak)}/day</span>
      </div>
      <div className="card p-4">
        <div className="flex h-36 items-end gap-[2px]" role="img" aria-label={`${title} per day`}>
          {series.map((r) => {
            const v = pick(r);
            return (
              <div key={r.day} className="group relative flex h-full flex-1 items-end" title={`${label(r.day)}: ${detail(r)}`}>
                <div
                  className={`w-full rounded-t-[2px] transition ${v > 0 ? "bg-signal group-hover:bg-accent" : "bg-surface-2"}`}
                  style={{ height: v > 0 ? `${Math.max(4, (v / max) * 100)}%` : "2px" }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[11px] text-muted">
          <span>{label(series[0].day)}</span>
          <span>{label(series[series.length - 1].day)}</span>
        </div>
      </div>
    </section>
  );
}

function isoDay(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}
