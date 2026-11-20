-- =============================================================
-- 0009: moderation roles, onboarding flag, username history,
--       suspensions/bans, soft-hide, comment/profile reports,
--       author comment moderation, and audit log.
-- Run in Supabase SQL Editor after 0008_traffic.sql
-- =============================================================

-- -------------------------------------------------------------
-- Profiles: moderation role, onboarding flag, strikes/bans
-- -------------------------------------------------------------
alter table public.profiles
  add column role            text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  add column onboarded_at    timestamptz,
  add column strikes         integer not null default 0 check (strikes >= 0),
  add column suspended_until timestamptz,
  add column banned_at       timestamptz,
  add column ban_reason      text check (char_length(ban_reason) <= 500);

-- Existing accounts that already picked a custom username count as onboarded.
update public.profiles
set onboarded_at = created_at
where left(username, 5) <> 'user_' and onboarded_at is null;

-- -------------------------------------------------------------
-- Username redirect history (preserves old /u/<name> URLs)
-- -------------------------------------------------------------
create table public.username_history (
  username   text primary key check (username ~ '^[a-z0-9_]{3,24}$'),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  changed_at timestamptz not null default now()
);
create index username_history_user_idx on public.username_history (user_id);

alter table public.username_history enable row level security;
create policy "username history is public" on public.username_history for select using (true);
revoke insert, update, delete on public.username_history from anon, authenticated;

create or replace function public.profiles_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.username is distinct from old.username then
    delete from public.username_history where username = new.username;
    if left(old.username, 5) <> 'user_' then
      insert into public.username_history (username, user_id, changed_at)
      values (old.username, old.id, now())
      on conflict (username) do update
        set user_id = excluded.user_id,
            changed_at = now();
    end if;
  end if;

  if auth.uid() = old.id then
    new.onboarded_at := coalesce(old.onboarded_at, now());
  end if;

  return new;
end;
$$;

create trigger profiles_before_update_trg
  before update on public.profiles
  for each row execute function public.profiles_before_update();

-- -------------------------------------------------------------
-- Auth/moderation helper functions for RLS
-- -------------------------------------------------------------
create or replace function public.is_moderator(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role in ('moderator', 'admin')
      and p.banned_at is null
  );
$$;

create or replace function public.is_active_user(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.banned_at is null
      and (p.suspended_until is null or p.suspended_until <= now())
  );
$$;

grant execute on function public.is_moderator(uuid) to anon, authenticated;
grant execute on function public.is_active_user(uuid) to anon, authenticated;

-- -------------------------------------------------------------
-- Soft-hide / quarantine on projects and comments
-- -------------------------------------------------------------
alter table public.projects
  add column hidden_at     timestamptz,
  add column hidden_reason text check (char_length(hidden_reason) <= 500),
  add column hidden_by     uuid references public.profiles (id) on delete set null;

create index projects_visible_activity_idx
  on public.projects (activity_at desc)
  where hidden_at is null;

drop policy "projects are public" on public.projects;
create policy "projects are public" on public.projects for select
  using (hidden_at is null or author_id = auth.uid() or public.is_moderator(auth.uid()));

drop policy "users create own projects" on public.projects;
create policy "users create own projects" on public.projects for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_active_user(auth.uid())
    and (cover_path is null or split_part(cover_path, '/', 1) = auth.uid()::text)
  );

drop policy "users update own projects" on public.projects;
create policy "users update own projects" on public.projects for update to authenticated
  using (author_id = auth.uid() and public.is_active_user(auth.uid()))
  with check (
    author_id = auth.uid()
    and public.is_active_user(auth.uid())
    and (cover_path is null or split_part(cover_path, '/', 1) = auth.uid()::text)
  );

drop policy "releases are public" on public.project_releases;
create policy "releases are public" on public.project_releases for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.hidden_at is null or p.author_id = auth.uid() or public.is_moderator(auth.uid()))
    )
  );

drop policy "authors publish releases" on public.project_releases;
create policy "authors publish releases" on public.project_releases for insert to authenticated
  with check (
    public.is_active_user(auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.author_id = auth.uid())
    and (file_path is null or split_part(file_path, '/', 1) = auth.uid()::text)
  );

-- Exclude hidden projects from search and popular tags.
create or replace function public.search_projects(q text, lim integer default 30, off integer default 0)
returns setof public.projects
language sql
stable
set search_path = public, extensions
as $$
  with query as (
    select
      websearch_to_tsquery('english', unaccent(q)) as tsq,
      trim(both '-' from lower(regexp_replace(unaccent(trim(q)), '[^a-zA-Z0-9]+', '-', 'g'))) as tag_guess,
      '%' || replace(replace(replace(unaccent(trim(q)), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select p.*
  from public.projects p, query
  where p.hidden_at is null
    and (
      p.search @@ query.tsq
      or query.tag_guess = any (p.tags)
      or unaccent(p.title) ilike query.pattern
    )
  order by
    (query.tag_guess = any (p.tags)) desc,
    ts_rank(p.search, query.tsq) desc,
    p.vote_count desc,
    p.created_at desc
  limit least(lim, 100) offset off;
$$;

create or replace function public.popular_tags(lim integer default 20)
returns table (tag text, project_count bigint)
language sql
stable
set search_path = public
as $$
  select t as tag, count(*) as project_count
  from public.projects, unnest(tags) as t
  where hidden_at is null
  group by t
  order by count(*) desc, t
  limit least(lim, 100);
$$;

-- Comments: soft-hide + project author can delete comments on their project.
alter table public.comments
  add column hidden_at     timestamptz,
  add column hidden_reason text check (char_length(hidden_reason) <= 500);

drop policy "comments are public" on public.comments;
create policy "comments are public" on public.comments for select
  using (hidden_at is null or public.is_moderator(auth.uid()));

drop policy "users comment as self" on public.comments;
create policy "users comment as self" on public.comments for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_user(auth.uid()));

drop policy "users delete own comments" on public.comments;
create policy "users delete comments" on public.comments for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from public.projects p where p.id = project_id and p.author_id = auth.uid())
    or public.is_moderator(auth.uid())
  );

create or replace function public.bump_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid := coalesce(new.project_id, old.project_id);
begin
  update public.projects p set
    comment_count = (
      select count(*) from public.comments c
      where c.project_id = pid and c.hidden_at is null
    )
  where p.id = pid;
  return null;
end;
$$;

drop trigger comments_count_trg on public.comments;
create trigger comments_count_trg
  after insert or update of hidden_at or delete on public.comments
  for each row execute function public.bump_comment_count();

-- Gate votes, works_reports, and storage uploads with active-user checks.
drop policy "users vote as self" on public.votes;
create policy "users vote as self" on public.votes for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user(auth.uid()));

drop policy "users change own vote" on public.votes;
create policy "users change own vote" on public.votes for update to authenticated
  using (user_id = auth.uid() and public.is_active_user(auth.uid()))
  with check (user_id = auth.uid() and public.is_active_user(auth.uid()));

drop policy "users report works as self" on public.works_reports;
create policy "users report works as self" on public.works_reports for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_user(auth.uid())
    and (release_id is null or exists (
      select 1 from public.project_releases r where r.id = release_id and r.project_id = works_reports.project_id
    ))
  );

drop policy "users update own works" on public.works_reports;
create policy "users update own works" on public.works_reports for update to authenticated
  using (user_id = auth.uid() and public.is_active_user(auth.uid()))
  with check (
    user_id = auth.uid()
    and public.is_active_user(auth.uid())
    and (release_id is null or exists (
      select 1 from public.project_releases r where r.id = release_id and r.project_id = works_reports.project_id
    ))
  );

drop policy "users upload own files" on storage.objects;
create policy "users upload own files" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user(auth.uid())
    and public.upload_quota_ok('files', 20, 2147483648)
  );

drop policy "users upload own covers" on storage.objects;
create policy "users upload own covers" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user(auth.uid())
    and public.upload_quota_ok('covers', 50, 524288000)
  );

drop policy "users upload own avatars" on storage.objects;
create policy "users upload own avatars" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user(auth.uid())
    and public.upload_quota_ok('avatars', 20, 52428800)
  );

-- -------------------------------------------------------------
-- Expanded reports: projects, comments, profiles + lifecycle + dedupe
-- -------------------------------------------------------------
alter table public.reports
  alter column project_id drop not null,
  add column target_type     text not null default 'project' check (target_type in ('project', 'comment', 'profile')),
  add column comment_id      uuid references public.comments (id) on delete cascade,
  add column profile_id      uuid references public.profiles (id) on delete cascade,
  add column status          text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  add column resolved_at     timestamptz,
  add column resolved_by     uuid references public.profiles (id) on delete set null,
  add column moderator_notes text check (char_length(moderator_notes) <= 1000);

alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check
  check (kind in ('my_work', 'malware', 'rom_or_piracy', 'illegal', 'harassment', 'spam', 'impersonation', 'other'));

alter table public.reports add constraint reports_target_match check (
  (target_type = 'project' and project_id is not null and comment_id is null and profile_id is null)
  or (target_type = 'comment' and comment_id is not null and profile_id is null)
  or (target_type = 'profile' and profile_id is not null and project_id is null and comment_id is null)
);

create unique index reports_one_open_project_idx
  on public.reports (reporter_id, project_id)
  where status = 'open' and target_type = 'project';

create unique index reports_one_open_comment_idx
  on public.reports (reporter_id, comment_id)
  where status = 'open' and target_type = 'comment';

create unique index reports_one_open_profile_idx
  on public.reports (reporter_id, profile_id)
  where status = 'open' and target_type = 'profile';

drop policy "users file reports as self" on public.reports;
create policy "users see own reports or mods see all" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator(auth.uid()));

create policy "users file reports as self" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_active_user(auth.uid()));

create policy "moderators update reports" on public.reports for update to authenticated
  using (public.is_moderator(auth.uid()))
  with check (public.is_moderator(auth.uid()));

revoke insert, update on public.reports from anon, authenticated;
grant insert (target_type, project_id, comment_id, profile_id, reporter_id, kind, reason)
  on public.reports to authenticated;
grant update (status, resolved_at, resolved_by, moderator_notes)
  on public.reports to authenticated;

-- -------------------------------------------------------------
-- Audit log for moderation decisions
-- -------------------------------------------------------------
create table public.moderation_actions (
  id             uuid primary key default gen_random_uuid(),
  moderator_id   uuid references public.profiles (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  project_id     uuid references public.projects (id) on delete set null,
  comment_id     uuid references public.comments (id) on delete set null,
  report_id      uuid references public.reports (id) on delete set null,
  action         text not null check (action in (
    'hide_project', 'restore_project', 'delete_project',
    'hide_comment', 'restore_comment',
    'quarantine_release', 'clear_release',
    'issue_strike', 'revoke_strike',
    'suspend_user', 'ban_user', 'unban_user',
    'dismiss_report'
  )),
  reason         text not null check (char_length(reason) between 1 and 1000),
  created_at     timestamptz not null default now()
);
create index moderation_actions_created_idx on public.moderation_actions (created_at desc);

alter table public.moderation_actions enable row level security;
create policy "moderators read audit log" on public.moderation_actions for select to authenticated
  using (public.is_moderator(auth.uid()));
revoke insert, update, delete on public.moderation_actions from anon, authenticated;

-- -------------------------------------------------------------
-- Updated report queue view
-- -------------------------------------------------------------
drop view if exists public.report_queue;
create view public.report_queue
with (security_invoker = true)
as
select
  r.id,
  r.created_at,
  r.status,
  r.target_type,
  r.kind,
  r.reason,
  r.project_id,
  r.comment_id,
  r.profile_id,
  p.title,
  c.body as comment_body,
  coalesce(pa.username, ca.username, tp.username) as posted_by,
  rep.username as reported_by
from public.reports r
left join public.projects p on p.id = r.project_id
left join public.profiles pa on pa.id = p.author_id
left join public.comments c on c.id = r.comment_id
left join public.profiles ca on ca.id = c.author_id
left join public.profiles tp on tp.id = r.profile_id
left join public.profiles rep on rep.id = r.reporter_id
where r.status = 'open'
order by
  case r.kind
    when 'malware' then 0
    when 'illegal' then 1
    when 'my_work' then 2
    when 'rom_or_piracy' then 3
    when 'harassment' then 4
    when 'impersonation' then 5
    when 'spam' then 6
    else 7
  end,
  r.created_at;
revoke all on public.report_queue from anon, authenticated;
