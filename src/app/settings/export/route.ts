import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";

/** "Download my data": everything we hold about the signed-in user, as one JSON file (UK GDPR access/portability). */
export async function GET(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/settings", request.url));

  const [profile, projects, comments, votes, worksReports, abuseReports, tagFollows, projectFollows] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("projects")
        .select("*, releases:project_releases!project_releases_project_id_fkey(*)")
        .eq("author_id", user.id),
      supabase.from("comments").select("*").eq("author_id", user.id),
      supabase.from("votes").select("*").eq("user_id", user.id),
      supabase.from("works_reports").select("*").eq("user_id", user.id),
      supabase
        .from("reports")
        .select("id,target_type,project_id,comment_id,profile_id,kind,reason,status,created_at")
        .eq("reporter_id", user.id),
      supabase.from("tag_follows").select("*").eq("user_id", user.id),
      supabase.from("project_follows").select("*").eq("user_id", user.id),
    ]);

  const body = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at },
    profile: profile.data,
    projects: projects.data ?? [],
    comments: comments.data ?? [],
    likes_and_dislikes: votes.data ?? [],
    works_for_me_reports: worksReports.data ?? [],
    abuse_reports: abuseReports.data ?? [],
    followed_tags: tagFollows.data ?? [],
    followed_projects: projectFollows.data ?? [],
    note: "Uploaded zip files and cover images are listed in your projects and releases. Download them from your project pages.",
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="forkyard-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
