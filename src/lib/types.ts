export type Author = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type ScanStatus = "unscanned" | "pending" | "clean" | "flagged" | "malicious" | "error";

export type ZipEntryInfo = {
  name: string;
  size: number;
};

export type ZipManifest = {
  file_count: number;
  total_uncompressed: number;
  entries: ZipEntryInfo[];
  warnings: string[];
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
  hidden_at?: string | null;
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
  scan_status?: ScanStatus;
  created_at: string;
};

export type Release = LatestRelease & {
  download_count: number;
  changelog: string | null;
  works_on: string | null;
  file_path: string | null;
  file_size: number | null;
  file_sha256: string | null;
  file_manifest: ZipManifest | null;
  scan_status: ScanStatus;
  scan_engine: string | null;
  scan_positives: number;
  scan_total: number;
  scan_report_url: string | null;
  scanned_at: string | null;
};

export type Project = ProjectSummary & {
  author_id: string;
  original_url: string | null;
  permission_confirmed: boolean;
  body: string | null;
  link_url: string | null;
  source_url: string | null;
  cover_path: string | null;
  hidden_at: string | null;
  hidden_reason: string | null;
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
  role?: "user" | "moderator" | "admin";
  onboarded_at?: string | null;
  strikes?: number;
  suspended_until?: string | null;
  banned_at?: string | null;
  ban_reason?: string | null;
  created_at: string;
};

export type ActionState = { error?: string; ok?: boolean } | undefined;
