import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectSummary } from "@/lib/types";

export const PAGE_SIZE = 20;
const MAX_SEARCH_RESULTS = 99; // search_projects caps lim at 100 and we fetch one extra

export function parsePage(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 20) : 0;
}

// projects <-> profiles are linked several ways (author, votes, works reports, abuse reports),
// so embedding the author must name the exact foreign key.
export const PROJECT_AUTHOR_SELECT = "author:profiles!projects_author_id_fkey(username,display_name,avatar_url)";
export const COMMENT_AUTHOR_SELECT = "author:profiles!comments_author_id_fkey(username,display_name,avatar_url)";
export const REPORT_AUTHOR_SELECT = "author:profiles!works_reports_user_id_fkey(username,display_name,avatar_url)";

// projects <-> project_releases are also linked twice (release.project_id and projects.latest_release_id).
export const LATEST_RELEASE_SELECT =
  "latest:project_releases!projects_latest_release_id_fkey(id,version,file_name,works_yes,works_no,created_at)";

export const SUMMARY_SELECT = `id,title,summary,tags,cover_url,works_on,youtube_id,vote_count,comment_count,download_count,works_yes,works_no,created_at,activity_at,${PROJECT_AUTHOR_SELECT},${LATEST_RELEASE_SELECT}`;

export type FeedTab = "foryou" | "new" | "top";

export const RELEASE_SELECT =
  "id,version,changelog,works_on,file_path,file_name,file_size,download_count,works_yes,works_no,created_at";

/** Supabase returns embedded one-to-one relations as an object, but types them loosely. */
export function asSummaries(rows: unknown): ProjectSummary[] {
  return (rows ?? []) as ProjectSummary[];
}

export async function getFollowedTags(supabase: SupabaseClient, userId: string | undefined): Promise<string[]> {
  if (!userId) return [];
  const { data } = await supabase.from("tag_follows").select("tag").eq("user_id", userId).order("tag");
  return (data ?? []).map((r) => r.tag as string);
}

export async function getFollowedProjectIds(supabase: SupabaseClient, userId: string | undefined): Promise<string[]> {
  if (!userId) return [];
  const { data } = await supabase.from("project_follows").select("project_id").eq("user_id", userId).limit(500);
  return (data ?? []).map((r) => r.project_id as string);
}

export async function getVotedIds(
  supabase: SupabaseClient,
  userId: string | undefined,
  projectIds: string[],
): Promise<Set<string>> {
  if (!userId || projectIds.length === 0) return new Set();
  const { data } = await supabase
    .from("votes")
    .select("project_id")
    .eq("user_id", userId)
    .in("project_id", projectIds);
  return new Set((data ?? []).map((r) => r.project_id as string));
}

export async function getFeed(
  supabase: SupabaseClient,
  opts: {
    tab: FeedTab;
    page: number;
    followedTags?: string[];
    followedProjectIds?: string[];
    tag?: string;
    authorId?: string;
  },
): Promise<{ projects: ProjectSummary[]; hasMore: boolean }> {
  // "Load more" grows the list: page N shows items 0..(N+1)*PAGE_SIZE.
  const limit = (opts.page + 1) * PAGE_SIZE;
  let query = supabase.from("projects").select(SUMMARY_SELECT);

  if (opts.tag) query = query.contains("tags", [opts.tag]);
  if (opts.authorId) query = query.eq("author_id", opts.authorId);
  if (opts.tab === "foryou") {
    // Tags and ids are slug/uuid-shaped, so they're safe inside a PostgREST filter string.
    const filters: string[] = [];
    if (opts.followedTags?.length) filters.push(`tags.ov.{${opts.followedTags.join(",")}}`);
    if (opts.followedProjectIds?.length) filters.push(`id.in.(${opts.followedProjectIds.join(",")})`);
    if (filters.length === 0) return { projects: [], hasMore: false };
    query = query.or(filters.join(","));
  }

  // "Latest" and "For you" sort by activity, so a new release bumps a project back up.
  query =
    opts.tab === "top"
      ? query.order("vote_count", { ascending: false }).order("created_at", { ascending: false })
      : query.order("activity_at", { ascending: false });

  // Fetch one extra row to know whether there is another page.
  const { data, error } = await query.range(0, limit);
  if (error) throw new Error(error.message);
  const rows = asSummaries(data);
  return { projects: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function searchProjects(
  supabase: SupabaseClient,
  q: string,
  page: number,
): Promise<{ projects: ProjectSummary[]; hasMore: boolean }> {
  const limit = Math.min((page + 1) * PAGE_SIZE, MAX_SEARCH_RESULTS);
  const { data, error } = await supabase
    .rpc("search_projects", { q, lim: limit + 1, off: 0 })
    .select(SUMMARY_SELECT);
  if (error) throw new Error(error.message);
  const rows = asSummaries(data);
  return { projects: rows.slice(0, limit), hasMore: rows.length > limit && limit < MAX_SEARCH_RESULTS };
}

export async function getPopularTags(supabase: SupabaseClient, limit = 20) {
  const { data } = await supabase.rpc("popular_tags", { lim: limit });
  return (data ?? []) as { tag: string; project_count: number }[];
}
