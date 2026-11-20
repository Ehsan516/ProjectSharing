import type { SupabaseClient } from "@supabase/supabase-js";

/** New users haven't completed onboarding yet; send them to pick a username first. */
export async function postLoginPath(
  supabase: SupabaseClient,
  userId: string,
  next: string,
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("username,onboarded_at")
    .eq("id", userId)
    .single();
  if (profile && !profile.onboarded_at) return `/settings?welcome=1&next=${encodeURIComponent(next)}`;
  return next;
}
