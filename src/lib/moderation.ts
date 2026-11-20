import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";

export type AccountRestriction = {
  banned: boolean;
  suspendedUntil: string | null;
  reason: string | null;
  strikes: number;
  role: "user" | "moderator" | "admin";
};

export async function getAccountRestriction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<AccountRestriction | null> {
  const { data } = await supabase
    .from("profiles")
    .select("role,strikes,suspended_until,banned_at,ban_reason")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;

  const suspendedActive =
    !!data.suspended_until && new Date(data.suspended_until).getTime() > Date.now();

  return {
    banned: !!data.banned_at,
    suspendedUntil: suspendedActive ? (data.suspended_until as string) : null,
    reason: (data.ban_reason as string | null) ?? null,
    strikes: (data.strikes as number) ?? 0,
    role: ((data.role as string) ?? "user") as AccountRestriction["role"],
  };
}

export async function getModerator() {
  const { supabase, user } = await getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,username,display_name,role,banned_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.banned_at || (profile.role !== "moderator" && profile.role !== "admin")) {
    return null;
  }

  return {
    supabase,
    user,
    profile: profile as {
      id: string;
      username: string;
      display_name: string | null;
      role: "moderator" | "admin";
      banned_at: string | null;
    },
    admin: createAdminClient(),
  };
}
