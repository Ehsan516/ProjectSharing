-- =============================================================
-- 0004: like / dislike instead of upvote-only
-- votes.value: 1 = like, -1 = dislike. projects.vote_count becomes the score (likes - dislikes),
-- which is what the "Top" tab sorts by.
-- Run in Supabase SQL Editor after 0003_releases.sql
-- =============================================================

alter table public.votes
  add column value smallint not null default 1 check (value in (-1, 1));

alter table public.projects
  add column like_count    integer not null default 0,
  add column dislike_count integer not null default 0;

create or replace function public.bump_vote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid := coalesce(new.project_id, old.project_id);
  likes integer;
  dislikes integer;
begin
  select count(*) filter (where value = 1), count(*) filter (where value = -1)
  into likes, dislikes
  from public.votes
  where project_id = pid;

  update public.projects
  set like_count = likes, dislike_count = dislikes, vote_count = likes - dislikes
  where id = pid;
  return null;
end;
$$;

drop trigger votes_count_trg on public.votes;
create trigger votes_count_trg
  after insert or update or delete on public.votes
  for each row execute function public.bump_vote_count();

-- Backfill existing upvotes as likes
update public.projects p set
  like_count    = (select count(*) from public.votes v where v.project_id = p.id and v.value = 1),
  dislike_count = (select count(*) from public.votes v where v.project_id = p.id and v.value = -1);
update public.projects set vote_count = like_count - dislike_count;

-- Users can switch their own vote between like and dislike
grant update (value) on public.votes to authenticated;
create policy "users change own vote" on public.votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
