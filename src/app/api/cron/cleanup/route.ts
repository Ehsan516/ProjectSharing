import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Deletes uploads that were never attached to a project or release (older than 24h).
 * Run daily: vercel.json schedules it on Vercel, or call it yourself with
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://yoursite/api/cron/cleanup
 * Needs SUPABASE_SECRET_KEY and CRON_SECRET (server-only env vars, never NEXT_PUBLIC_).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!secret || !serviceKey) {
    return NextResponse.json({ error: "CRON_SECRET and SUPABASE_SECRET_KEY must be set" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("orphaned_uploads");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byBucket = new Map<string, string[]>();
  for (const row of (data ?? []) as { bucket_id: string; name: string }[]) {
    byBucket.set(row.bucket_id, [...(byBucket.get(row.bucket_id) ?? []), row.name]);
  }

  const deleted: Record<string, number> = {};
  for (const [bucket, names] of byBucket) {
    deleted[bucket] = 0;
    for (let i = 0; i < names.length; i += 100) {
      const { data: removed, error: removeError } = await admin.storage.from(bucket).remove(names.slice(i, i + 100));
      if (removeError) return NextResponse.json({ error: removeError.message, deleted }, { status: 500 });
      deleted[bucket] += removed?.length ?? 0;
    }
  }
  // Visitor fingerprints are only needed for the current day; keep two days, then delete them.
  const cutoff = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  await admin.from("project_visitors").delete().lt("day", cutoff);

  return NextResponse.json({ deleted });
}
