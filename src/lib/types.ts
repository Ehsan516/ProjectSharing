export type Author = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type ProjectSummary = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  cover_url: string | null;
  works_on: string | null;
  vote_count: number;
  comment_count: number;
  works_yes: number;
  works_no: number;
  created_at: string;
  author: Author | null;
};

export type Project = ProjectSummary & {
  author_id: string;
  body: string | null;
  prompt: string | null;
  made_with: string | null;
  link_url: string | null;
  source_url: string | null;
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
  created_at: string;
};

export type ActionState = { error?: string; ok?: boolean } | undefined;
