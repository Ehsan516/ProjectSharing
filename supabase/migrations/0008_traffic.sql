-- =============================================================
-- 0008: per-project traffic for creators (views, unique visitors, downloads, sources).
-- Run in Supabase SQL Editor after 0007_authorship_and_duplicates.sql
--
-- Privacy: no cookies, nothing stored on the visitor's device, no IP addresses stored.
-- Unique visitors are a SHA-256 of (secret salt + date + IP + browser + project), made on the server.
-- The salt and date make it change daily and impossible to reverse. Those hashes are deleted after 2 days;
-- only the daily totals are kept.
-- =============================================================

create table public.project_daily_stats (
  project_id uuid not null references public.projects (id) on delete cascade,
  day        date not null,
  views      integer not null default 0,
  visitors   integer not null default 0,
  downloads  integer not null default 0,
  primary key (project_id, day)
);

create table public.project_referrers (
  project_id uuid not null references public.projects (id) on delete cascade,
  day        date not null,
  source     text not null check (char_length(source) between 1 and 60),
  visitors   integer not null default 0,
  primary key (project_id, day, source)
);

-- Short-lived, only so the same person isn't counted twice in a day. Nobody can read it but the server.
create table public.project_visitors (
  project_id uuid not null references public.projects (id) on delete cascade,
  day        date not null,
  visitor    text not null check (char_length(visitor) = 64),
  views      integer not null default 1,
  primary key (project_id, day, visitor)
);
create index project_visitors_day_idx on public.project_visitors (day);

alter table public.project_daily_stats enable row level security;
alter table public.project_referrers enable row level security;
alter table public.project_visitors enable row level security;

-- Only the project's author can see its traffic.
create policy "authors see their traffic" on public.project_daily_stats for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.author_id = auth.uid()));
create policy "authors see their sources" on public.project_referrers for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.author_id = auth.uid()));

revoke all on public.project_daily_stats, public.project_referrers, public.project_visitors from anon, authenticated;
grant select on public.project_daily_stats, public.project_referrers to authenticated;

-- Called only by the server (service role) from /api/view.
create or replace function public.record_view(pid uuid, visitor_hash text, ref_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  n integer;
begin
  if not exists (select 1 from public.projects where id = pid) then
    return;
  end if;

  insert into public.project_visitors (project_id, day, visitor)
  values (pid, today, visitor_hash)
  on conflict (project_id, day, visitor) do update set views = public.project_visitors.views + 1
  returning views into n;

  -- One person refreshing can't inflate a project's numbers.
  if n > 20 then
    return;
  end if;

  insert into public.project_daily_stats (project_id, day, views, visitors)
  values (pid, today, 1, case when n = 1 then 1 else 0 end)
  on conflict (project_id, day) do update
    set views = public.project_daily_stats.views + 1,
        visitors = public.project_daily_stats.visitors + (case when n = 1 then 1 else 0 end);

  -- Where people came from, counted once per visitor per day.
  if n = 1 and ref_source is not null then
    insert into public.project_referrers (project_id, day, source, visitors)
    values (pid, today, left(ref_source, 60), 1)
    on conflict (project_id, day, source) do update set visitors = public.project_referrers.visitors + 1;
  end if;
end;
$$;

revoke execute on function public.record_view(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_view(uuid, text, text) to service_role;

-- Downloads now also count per day.
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

  insert into public.project_daily_stats (project_id, day, downloads)
  values (pid, (now() at time zone 'utc')::date, 1)
  on conflict (project_id, day) do update set downloads = public.project_daily_stats.downloads + 1;

  return next;
end;
$$;
