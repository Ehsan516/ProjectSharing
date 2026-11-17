import type { SupabaseClient } from "@supabase/supabase-js";

/** New users get an auto-generated username; send them to pick a real one first. */
export async function postLoginPath(
  supabase: SupabaseClient,
  userId: string,
  next: string,
): Promise<string> {
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", userId).single();
  if (profile?.username?.startsWith("user_")) return `/settings?welcome=1&next=${encodeURIComponent(next)}`;
  return next;
}
