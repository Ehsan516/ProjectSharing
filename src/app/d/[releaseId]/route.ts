import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Counts a download, then sends the browser to the file. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ releaseId: string }> }) {
  const { releaseId } = await params;
  const { origin } = new URL(request.url);
  if (!UUID.test(releaseId)) return NextResponse.redirect(origin, 302);

  const supabase = await createClient();
  const { data } = await supabase.rpc("record_download", { rid: releaseId });
  const file = (data as { path: string; name: string | null }[] | null)?.[0];
  if (!file) return new NextResponse("File not found", { status: 404 });

  const url = supabase.storage.from("files").getPublicUrl(file.path, { download: file.name ?? true }).data.publicUrl;
  return NextResponse.redirect(url, 302);
}
