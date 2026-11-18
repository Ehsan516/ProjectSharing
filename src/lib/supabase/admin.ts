import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses row-level security, so only use it on the server for
 * jobs the user can't do themselves (deleting their auth account, cleanup).
 * Returns null when SUPABASE_SECRET_KEY isn't set.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(env.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
