import { createAdminClient } from "@/lib/supabase/admin";

type MemoryEntry = { hits: number; resetAt: number };
const memoryStore = new Map<string, MemoryEntry>();

export const RATE_LIMITS = {
  signInIp: { limit: 10, windowSeconds: 15 * 60 },
  signInEmail: { limit: 4, windowSeconds: 15 * 60 },
  createProject: { limit: 5, windowSeconds: 60 * 60 },
  createRelease: { limit: 10, windowSeconds: 60 * 60 },
  comment: { limit: 15, windowSeconds: 10 * 60 },
  vote: { limit: 60, windowSeconds: 60 },
  worksReport: { limit: 20, windowSeconds: 60 * 60 },
  report: { limit: 10, windowSeconds: 60 * 60 },
  apiView: { limit: 60, windowSeconds: 60 },
  download: { limit: 30, windowSeconds: 60 },
} as const;

export function getClientIp(headers: Headers): string {
  const forwarded = (headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

function checkMemoryRateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    if (memoryStore.size > 5000) {
      for (const [k, v] of memoryStore) {
        if (v.resetAt <= now) memoryStore.delete(k);
      }
    }
    memoryStore.set(key, { hits: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  existing.hits += 1;
  return existing.hits <= limit;
}

/**
 * Enforces an atomic fixed-window rate limit in Postgres via `check_rate_limit`.
 * Falls back to an in-memory map if `SUPABASE_SECRET_KEY` is unset (e.g. local dev).
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return checkMemoryRateLimit(key, limit, windowSeconds);

  const { data, error } = await admin.rpc("check_rate_limit", {
    k: key,
    lim: limit,
    win_secs: windowSeconds,
  });

  if (error || typeof data !== "boolean") {
    console.error("check_rate_limit failed:", error?.message);
    return checkMemoryRateLimit(key, limit, windowSeconds);
  }
  return data;
}
