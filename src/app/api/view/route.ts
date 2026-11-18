import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { env } from "@/lib/env";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|discordbot|telegrambot|headless/i;

/**
 * Counts one project page view. Called by the page itself after it loads (so link prefetches and
 * most bots never count). No cookies; the visitor fingerprint is a daily-rotating one-way hash.
 */
export async function POST(request: NextRequest) {
  const admin = createAdminClient();
  if (!admin) return new NextResponse(null, { status: 204 });

  let body: { projectId?: unknown; referrer?: unknown; ref?: unknown };
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  if (!UUID.test(projectId)) return new NextResponse(null, { status: 204 });

  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOTS.test(ua)) return new NextResponse(null, { status: 204 });

  // Creators looking at their own project don't count.
  const { supabase, user } = await getUser();
  if (user) {
    const { data } = await supabase.from("projects").select("author_id").eq("id", projectId).maybeSingle();
    if (data?.author_id === user.id) return new NextResponse(null, { status: 204 });
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "";
  const salt = process.env.ANALYTICS_SALT || process.env.SUPABASE_SECRET_KEY || "";
  const day = new Date().toISOString().slice(0, 10);
  const visitor = createHash("sha256").update(`${salt}|${day}|${ip}|${ua}|${projectId}`).digest("hex");

  const source = sourceName(
    typeof body.ref === "string" ? body.ref : "",
    typeof body.referrer === "string" ? body.referrer : "",
    request.nextUrl.host,
  );

  await admin.rpc("record_view", { pid: projectId, visitor_hash: visitor, ref_source: source });
  return new NextResponse(null, { status: 204 });
}

/** Turns ?ref= or the referring page into a readable source name. */
function sourceName(ref: string, referrer: string, ownHost: string): string {
  const tag = ref.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
  if (tag) return NAMED[tag] ?? tag;

  let host = "";
  try {
    host = new URL(referrer).hostname.replace(/^www\./, "").replace(/^m\./, "");
  } catch {
    return "Direct or app";
  }
  const siteHost = env.siteUrl ? new URL(env.siteUrl).hostname.replace(/^www\./, "") : ownHost;
  if (host === siteHost || host === ownHost || host === "localhost") return "Forkyard";
  for (const [pattern, name] of HOSTS) if (pattern.test(host)) return name;
  return host.slice(0, 60);
}

const NAMED: Record<string, string> = {
  tiktok: "TikTok",
  tt: "TikTok",
  youtube: "YouTube",
  yt: "YouTube",
  x: "X",
  twitter: "X",
  discord: "Discord",
  reddit: "Reddit",
  instagram: "Instagram",
  ig: "Instagram",
};

const HOSTS: [RegExp, string][] = [
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, "X"],
  [/(^|\.)reddit\.com$/, "Reddit"],
  [/(^|\.)(discord\.com|discordapp\.com)$/, "Discord"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)github\.com$/, "GitHub"],
  [/^(.+\.)?google\.[a-z.]+$/, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
];
