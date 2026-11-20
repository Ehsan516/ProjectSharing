import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|discordbot|telegrambot|headless/i;

/** Counts a deduplicated download, enforces moderation/malware blocks, then redirects to the file. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ releaseId: string }> }) {
  const { releaseId } = await params;
  const { origin } = new URL(request.url);
  if (!UUID.test(releaseId)) return NextResponse.redirect(origin, 302);

  const ip = getClientIp(request.headers);
  const allowed = await checkRateLimit(`download:${ip}`, RATE_LIMITS.download.limit, RATE_LIMITS.download.windowSeconds);
  if (!allowed) {
    return new NextResponse("Too many downloads. Please wait a minute and try again.", { status: 429 });
  }

  const ua = request.headers.get("user-agent") ?? "";
  const isBot = !ua || BOTS.test(ua);

  const { supabase, user } = await getUser();
  let isAuthor = false;
  if (user) {
    const { data: rel } = await supabase
      .from("project_releases")
      .select("project:projects!project_releases_project_id_fkey(author_id)")
      .eq("id", releaseId)
      .maybeSingle();
    const authorId = (rel?.project as { author_id?: string } | null)?.author_id;
    isAuthor = authorId === user.id;
  }

  const salt = process.env.ANALYTICS_SALT || process.env.SUPABASE_SECRET_KEY || "";
  const day = new Date().toISOString().slice(0, 10);
  const visitorHash = createHash("sha256").update(`${salt}|${day}|${ip}|${ua}|${releaseId}`).digest("hex");

  let filePath: string | null = null;
  let fileName: string | null = null;

  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin.rpc("record_download", {
      rid: releaseId,
      visitor_hash: visitorHash,
      skip_count: isBot || isAuthor,
    });
    const row = (data as { path: string | null; name: string | null; blocked: string | null }[] | null)?.[0];
    if (!row) return new NextResponse("File not found", { status: 404 });
    if (row.blocked === "malicious") {
      return new NextResponse("This file was blocked by malware scanning.", { status: 403 });
    }
    if (row.blocked === "hidden" || !row.path) {
      return new NextResponse("File not found", { status: 404 });
    }
    filePath = row.path;
    fileName = row.name;
  } else {
    const { data: rel } = await supabase
      .from("project_releases")
      .select("file_path,file_name,scan_status,project:projects!project_releases_project_id_fkey(hidden_at)")
      .eq("id", releaseId)
      .maybeSingle();
    const hiddenAt = (rel?.project as { hidden_at?: string | null } | null)?.hidden_at;
    if (!rel?.file_path || hiddenAt) return new NextResponse("File not found", { status: 404 });
    if (rel.scan_status === "malicious") {
      return new NextResponse("This file was blocked by malware scanning.", { status: 403 });
    }
    filePath = rel.file_path as string;
    fileName = (rel.file_name as string | null) ?? null;
  }

  const url = supabase.storage.from("files").getPublicUrl(filePath, { download: fileName ?? true }).data.publicUrl;
  return NextResponse.redirect(url, 302);
}
