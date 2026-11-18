-- =============================================================
-- 0005: keep individual likes/dislikes private.
-- Totals stay public on projects (like_count / dislike_count); only you can see which projects
-- you reacted to. The app only ever reads the signed-in user's own votes, so nothing else changes.
-- Run in Supabase SQL Editor after 0004_like_dislike.sql
-- =============================================================

drop policy "votes are public" on public.votes;
create policy "users see own votes" on public.votes for select to authenticated
  using (user_id = auth.uid());
