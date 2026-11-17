-- =============================================================
-- 0003: releases (versions + changelog + zip per version),
--       version-aware "works for me" reports, following projects
-- Run in Supabase SQL Editor after 0002_files_and_video.sql
-- =============================================================

-- -------------------------------------------------------------
-- Releases
-- -------------------------------------------------------------
create table public.project_releases (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  version    text not null check (char_length(version) between 1 and 40),
  changelog  text check (char_length(changelog) <= 10000),
  works_on   text check (char_length(works_on) <= 200),
  file_path  text check (file_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.zip$'),
  file_name  text check (char_length(file_name) between 1 and 200),
  file_size  bigint check (file_size between 0 and 52428800),
  works_yes  integer not null default 0,
  works_no   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);
create index project_releases_project_idx on public.project_releases (project_id, created_at desc);

alter table public.projects
  add column latest_release_id uuid references public.project_releases (id) on delete set null,
  add column activity_at timestamptz not null default now();
update public.projects set activity_at = created_at;
create index projects_activity_idx on public.projects (activity_at desc);

-- Move existing project zips into a "1.0" release
insert into public.project_releases (project_id, version, works_on, file_path, file_name, file_size, created_at)
select id, '1.0', works_on, file_path, file_name, file_size, created_at
from public.projects
where file_path is not null;

-- Project file columns now live on releases. Policies reference them, so recreate those first.
drop policy "users create own projects" on public.projects;
drop policy "users update own projects" on public.projects;
create policy "users create own projects" on public.projects for insert to authenticated
  with check (
    author_id = auth.uid()
    and (cover_path is null or split_part(cover_path, '/', 1) = auth.uid()::text)
  );
create policy "users update own projects" on public.projects for update to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and (cover_path is null or split_part(cover_path, '/', 1) = auth.uid()::text)
  );
alter table public.projects
  drop column file_path,
  drop column file_name,
  drop column file_size;

-- Keep projects.latest_release_id / activity_at in sync
create or replace function public.refresh_latest_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid := coalesce(new.project_id, old.project_id);
begin
  update public.projects p set
    latest_release_id = (
      select r.id from public.project_releases r
      where r.project_id = pid
      order by r.created_at desc
      limit 1
    ),
    activity_at = greatest(
      p.created_at,
      coalesce((select max(r.created_at) from public.project_releases r where r.project_id = pid), p.created_at)
    )
  where p.id = pid;
  return null;
end;
$$;

create trigger project_releases_latest_trg
  after insert or delete on public.project_releases
  for each row execute function public.refresh_latest_release();

update public.projects p set
  latest_release_id = (
    select r.id from public.project_releases r where r.project_id = p.id order by r.created_at desc limit 1
  );

-- -------------------------------------------------------------
-- Version-aware "works for me" reports (one per user per release)
-- -------------------------------------------------------------
alter table public.works_reports drop constraint works_reports_pkey;
alter table public.works_reports
  add column id uuid not null default gen_random_uuid() primary key,
  add column release_id uuid references public.project_releases (id) on delete cascade;
alter table public.works_reports
  add constraint works_reports_one_per_version unique nulls not distinct (user_id, project_id, release_id);
create index works_reports_release_idx on public.works_reports (release_id);

update public.works_reports w
set release_id = p.latest_release_id
from public.projects p
where w.project_id = p.id and p.latest_release_id is not null;

create or replace function public.refresh_works_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid := coalesce(new.project_id, old.project_id);
  rid uuid;
begin
  update public.projects p set
    works_yes = (select count(*) from public.works_reports w where w.project_id = pid and w.worked),
    works_no  = (select count(*) from public.works_reports w where w.project_id = pid and not w.worked)
  where p.id = pid;

  foreach rid in array array_remove(array[
    case when tg_op <> 'INSERT' then old.release_id end,
    case when tg_op <> 'DELETE' then new.release_id end
  ], null) loop
    update public.project_releases r set
      works_yes = (select count(*) from public.works_reports w where w.release_id = rid and w.worked),
      works_no  = (select count(*) from public.works_reports w where w.release_id = rid and not w.worked)
    where r.id = rid;
  end loop;
  return null;
end;
$$;

update public.project_releases r set
  works_yes = (select count(*) from public.works_reports w where w.release_id = r.id and w.worked),
  works_no  = (select count(*) from public.works_reports w where w.release_id = r.id and not w.worked);

-- A report's release must belong to the same project
drop policy "users report works as self" on public.works_reports;
drop policy "users update own works" on public.works_reports;
create policy "users report works as self" on public.works_reports for insert to authenticated
  with check (
    user_id = auth.uid()
    and (release_id is null or exists (
      select 1 from public.project_releases r where r.id = release_id and r.project_id = works_reports.project_id
    ))
  );
create policy "users update own works" on public.works_reports for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (release_id is null or exists (
      select 1 from public.project_releases r where r.id = release_id and r.project_id = works_reports.project_id
    ))
  );

-- -------------------------------------------------------------
-- Following projects (get their updates in "For you")
-- -------------------------------------------------------------
create table public.project_follows (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);
create index project_follows_project_idx on public.project_follows (project_id);

-- -------------------------------------------------------------
-- RLS + privileges
-- -------------------------------------------------------------
alter table public.project_releases enable row level security;
alter table public.project_follows  enable row level security;

create policy "releases are public" on public.project_releases for select using (true);
create policy "authors publish releases" on public.project_releases for insert to authenticated
  with check (
    exists (select 1 from public.projects p where p.id = project_id and p.author_id = auth.uid())
    and (file_path is null or split_part(file_path, '/', 1) = auth.uid()::text)
  );
create policy "authors delete releases" on public.project_releases for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.author_id = auth.uid()));

revoke insert, update on public.project_releases from anon, authenticated;
grant insert (project_id, version, changelog, works_on, file_path, file_name, file_size)
  on public.project_releases to authenticated;

create policy "users see own project follows" on public.project_follows for select to authenticated
  using (user_id = auth.uid());
create policy "users follow projects as self" on public.project_follows for insert to authenticated
  with check (user_id = auth.uid());
create policy "users unfollow projects as self" on public.project_follows for delete to authenticated
  using (user_id = auth.uid());
revoke update on public.project_follows from anon, authenticated;

-- -------------------------------------------------------------
-- Download counts
-- -------------------------------------------------------------
alter table public.project_releases add column download_count integer not null default 0;
alter table public.projects         add column download_count integer not null default 0;

-- Called by the /d/<release id> route: counts the download and returns where the file lives.
create or replace function public.record_download(rid uuid)
returns table (path text, name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  update public.project_releases r
  set download_count = r.download_count + 1
  where r.id = rid and r.file_path is not null
  returning r.project_id, r.file_path, r.file_name into pid, path, name;

  if pid is null then
    return;
  end if;
  update public.projects p set download_count = p.download_count + 1 where p.id = pid;
  return next;
end;
$$;

-- -------------------------------------------------------------
-- Upload quotas (stops the buckets being used as a free file host)
-- -------------------------------------------------------------
create or replace function public.upload_quota_ok(bucket text, max_per_day integer, max_total_bytes bigint)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  with mine as (
    select o.created_at, coalesce((o.metadata ->> 'size')::bigint, 0) as size
    from storage.objects o
    where o.bucket_id = bucket
      and (storage.foldername(o.name))[1] = auth.uid()::text
  )
  select
    (select count(*) from mine where created_at > now() - interval '24 hours') < max_per_day
    and (select coalesce(sum(size), 0) from mine) < max_total_bytes;
$$;

drop policy "users upload own files" on storage.objects;
create policy "users upload own files" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.upload_quota_ok('files', 20, 2147483648)        -- 20 zips/day, 2 GB total per user
  );

drop policy "users upload own covers" on storage.objects;
create policy "users upload own covers" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.upload_quota_ok('covers', 50, 524288000)        -- 50 images/day, 500 MB total per user
  );

-- -------------------------------------------------------------
-- Orphaned uploads (uploaded but never attached to a project/release).
-- Only the server's secret key can call this; /api/cron/cleanup deletes them via the Storage API.
-- -------------------------------------------------------------
create or replace function public.orphaned_uploads(older_than interval default interval '24 hours')
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path = public, storage
as $$
  select o.bucket_id, o.name
  from storage.objects o
  where o.bucket_id in ('files', 'covers')
    and o.created_at < now() - older_than
    and not exists (select 1 from public.project_releases r where r.file_path = o.name)
    and not exists (select 1 from public.projects p where p.cover_path = o.name)
  order by o.created_at
  limit 1000;
$$;

revoke execute on function public.orphaned_uploads(interval) from public, anon, authenticated;
grant execute on function public.orphaned_uploads(interval) to service_role;
revoke execute on function public.upload_quota_ok(text, integer, bigint) from public, anon;
grant execute on function public.upload_quota_ok(text, integer, bigint) to authenticated;
