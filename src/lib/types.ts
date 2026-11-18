export type Author = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type ProjectSummary = {
  id: string;
  title: string;
  /** "own": the poster made it. "shared": someone else did, credited in original_creator. */
  authorship: "own" | "shared";
  original_creator: string | null;
  summary: string;
  tags: string[];
  cover_url: string | null;
  works_on: string | null;
  youtube_id: string | null;
  vote_count: number;
  like_count: number;
  dislike_count: number;
  comment_count: number;
  download_count: number;
  works_yes: number;
  works_no: number;
  created_at: string;
  activity_at: string;
  author: Author | null;
  latest: LatestRelease | null;
};

export type LatestRelease = {
  id: string;
  version: string;
  file_name: string | null;
  works_yes: number;
  works_no: number;
  created_at: string;
};

export type Release = LatestRelease & {
  download_count: number;
  changelog: string | null;
  works_on: string | null;
  file_path: string | null;
  file_size: number | null;
};

export type Project = ProjectSummary & {
  author_id: string;
  original_url: string | null;
  permission_confirmed: boolean;
  body: string | null;
  link_url: string | null;
  source_url: string | null;
  cover_path: string | null;
  updated_at: string;
};

export type Comment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: Author | null;
};

export type WorksReport = {
  user_id: string;
  release_id: string | null;
  worked: boolean;
  setup: string | null;
  created_at: string;
  author: Author | null;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  created_at: string;
};

export type ActionState = { error?: string; ok?: boolean } | undefined;
