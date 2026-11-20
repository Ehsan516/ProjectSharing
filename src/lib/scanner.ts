import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScanStatus } from "@/lib/types";

export type ScanResult = {
  scan_status: ScanStatus;
  scan_engine: string | null;
  scan_positives: number;
  scan_total: number;
  scan_report_url: string | null;
  scanned_at: string | null;
};

type VtStats = {
  malicious?: number;
  suspicious?: number;
  undetected?: number;
  harmless?: number;
};

function evaluateVtStats(sha256: string, stats: VtStats | undefined): ScanResult {
  const malicious = stats?.malicious ?? 0;
  const suspicious = stats?.suspicious ?? 0;
  const undetected = stats?.undetected ?? 0;
  const harmless = stats?.harmless ?? 0;
  const total = malicious + suspicious + undetected + harmless;

  let scan_status: ScanStatus = "clean";
  if (malicious >= 2) scan_status = "malicious";
  else if (malicious === 1 || suspicious >= 2) scan_status = "flagged";
  else if (total === 0) scan_status = "pending";

  return {
    scan_status,
    scan_engine: "virustotal",
    scan_positives: malicious + suspicious,
    scan_total: total,
    scan_report_url: `https://www.virustotal.com/gui/file/${sha256}`,
    scanned_at: scan_status === "pending" ? null : new Date().toISOString(),
  };
}

async function fetchVtFileReport(apiKey: string, sha256: string): Promise<{ status: number; stats?: VtStats }> {
  const res = await fetch(`https://www.virustotal.com/api/v3/files/${sha256}`, {
    headers: { "x-apikey": apiKey },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return { status: res.status };
  const json = (await res.json()) as { data?: { attributes?: { last_analysis_stats?: VtStats } } };
  return { status: res.status, stats: json.data?.attributes?.last_analysis_stats };
}

/**
 * Checks VirusTotal by SHA-256 and submits unknown files if `VIRUSTOTAL_API_KEY` is configured.
 * When no API key is set, returns `unscanned` so local/MVP setups continue working transparently.
 */
export async function scanFileWithVirusTotal(sha256: string, buf: Buffer, fileName: string): Promise<ScanResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    return {
      scan_status: "unscanned",
      scan_engine: "zip-inspector",
      scan_positives: 0,
      scan_total: 0,
      scan_report_url: null,
      scanned_at: new Date().toISOString(),
    };
  }

  try {
    const existing = await fetchVtFileReport(apiKey, sha256);
    if (existing.status === 200) {
      return evaluateVtStats(sha256, existing.stats);
    }
    if (existing.status !== 404) {
      console.error("VirusTotal lookup returned unexpected status:", existing.status);
      return {
        scan_status: "error",
        scan_engine: "virustotal",
        scan_positives: 0,
        scan_total: 0,
        scan_report_url: null,
        scanned_at: null,
      };
    }

    let uploadUrl = "https://www.virustotal.com/api/v3/files";
    if (buf.length > 32 * 1024 * 1024) {
      const urlRes = await fetch("https://www.virustotal.com/api/v3/files/upload_url", {
        headers: { "x-apikey": apiKey },
        signal: AbortSignal.timeout(8000),
      });
      if (!urlRes.ok) throw new Error(`VT upload_url failed (${urlRes.status})`);
      const urlJson = (await urlRes.json()) as { data?: string };
      if (!urlJson.data) throw new Error("VT upload_url returned no URL");
      uploadUrl = urlJson.data;
    }

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buf)], { type: "application/zip" }), fileName);

    const submitRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "x-apikey": apiKey },
      body: form,
      signal: AbortSignal.timeout(20000),
    });
    if (!submitRes.ok) {
      throw new Error(`VT file upload failed (${submitRes.status})`);
    }

    return {
      scan_status: "pending",
      scan_engine: "virustotal",
      scan_positives: 0,
      scan_total: 0,
      scan_report_url: `https://www.virustotal.com/gui/file/${sha256}`,
      scanned_at: null,
    };
  } catch (err) {
    console.error("VirusTotal scan failed:", err instanceof Error ? err.message : err);
    return {
      scan_status: "error",
      scan_engine: "virustotal",
      scan_positives: 0,
      scan_total: 0,
      scan_report_url: null,
      scanned_at: null,
    };
  }
}

/** Polls pending VirusTotal file scans and updates release statuses (quarantines malicious hits). */
export async function pollPendingScans(
  admin: SupabaseClient,
  limit = 10,
): Promise<{ checked: number; updated: number; malicious: number }> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) return { checked: 0, updated: 0, malicious: 0 };

  const { data: rows } = await admin
    .from("project_releases")
    .select("id,project_id,file_sha256")
    .eq("scan_status", "pending")
    .not("file_sha256", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  let checked = 0;
  let updated = 0;
  let malicious = 0;

  for (const row of (rows ?? []) as { id: string; project_id: string; file_sha256: string }[]) {
    checked += 1;
    try {
      const lookup = await fetchVtFileReport(apiKey, row.file_sha256);
      if (lookup.status !== 200) continue;
      const result = evaluateVtStats(row.file_sha256, lookup.stats);
      if (result.scan_status === "pending") continue;

      const { error } = await admin.from("project_releases").update(result).eq("id", row.id);
      if (error) continue;
      updated += 1;

      if (result.scan_status === "malicious") {
        malicious += 1;
        await admin.from("moderation_actions").insert({
          project_id: row.project_id,
          action: "quarantine_release",
          reason: `Automatic quarantine: VirusTotal flagged release (${result.scan_positives}/${result.scan_total}).`,
        });
      }
    } catch (err) {
      console.error("pollPendingScans failed for release", row.id, err instanceof Error ? err.message : err);
    }
  }

  return { checked, updated, malicious };
}
