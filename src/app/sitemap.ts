import { createClient } from "@supabase/supabase-js";
import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl ?? "http://localhost:3000";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/search`, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/terms`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.3 },
  ];

  if (!url || !key) return staticEntries;

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [{ data: projects }, { data: tags }, { data: profiles }] = await Promise.all([
      supabase
        .from("projects")
        .select("id,updated_at,activity_at")
        .is("hidden_at", null)
        .order("activity_at", { ascending: false })
        .limit(5000),
      supabase.rpc("popular_tags", { lim: 200 }),
      supabase
        .from("profiles")
        .select("username,created_at")
        .is("banned_at", null)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    const projectEntries: MetadataRoute.Sitemap = (projects ?? []).map((p) => ({
      url: `${base}/p/${p.id}`,
      lastModified: new Date(p.activity_at ?? p.updated_at),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const tagEntries: MetadataRoute.Sitemap = ((tags ?? []) as { tag: string }[]).map((t) => ({
      url: `${base}/t/${encodeURIComponent(t.tag)}`,
      changeFrequency: "daily",
      priority: 0.6,
    }));

    const profileEntries: MetadataRoute.Sitemap = (profiles ?? []).map((u) => ({
      url: `${base}/u/${encodeURIComponent(u.username)}`,
      lastModified: new Date(u.created_at),
      changeFrequency: "weekly",
      priority: 0.5,
    }));

    return [...staticEntries, ...projectEntries, ...tagEntries, ...profileEntries];
  } catch {
    return staticEntries;
  }
}
