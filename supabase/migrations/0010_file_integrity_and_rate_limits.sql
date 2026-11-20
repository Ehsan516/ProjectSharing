-- =============================================================
-- 0010: release file integrity (SHA-256, zip manifest, scan status),
--       locked-down & deduplicated downloads, and rate limits.
-- Run in Supabase SQL Editor after 0009_moderation_and_safety.sql
-- =============================================================

-- -------------------------------------------------------------
-- File integrity and malware scan metadata on releases
-- (Only written by the server via service_role; never client-writable.)
-- -------------------------------------------------------------
alter table public.project_releases
  add column file_sha256     text check (file_sha256 ~ '^[0-9a-f]{64}$'),
  add column file_manifest   jsonb,
  add column scan_status     text not null default 'unscanned'
    check (scan_status in ('unscanned', 'pending', 'clean', 'flagged', 'malicious', 'error')),
  add column scan_engine     text check (char_length(scan_engine) <= 40),
  add column scan_positives  integer not null default 0,
  add column scan_total      integer not null default 0,
  add column scan_report_url text check (scan_report_url ~ '^https://'),
  add column scanned_at      timestamptz;

create index project_releases_sha256_idx
  on public.project_releases (file_sha256)
  where file_sha256 is not null;

create index project_releases_scan_idx
  on public.project_releases (scan_status, created_at desc)
  where scan_status in ('pending', 'flagged', 'malicious');

-- -------------------------------------------------------------
-- Deduplicated & locked-down download counter
-- -------------------------------------------------------------
create table public.release_downloads (
  release_id uuid not null references public.project_releases (id) on delete cascade,
  day        date not null,
  visitor    text not null check (char_length(visitor) = 64),
  hits       integer not null default 1,
  primary key (release_id, day, visitor)
);
create index release_downloads_day_idx on public.release_downloads (day);

alter table public.release_downloads enable row level security;
revoke all on public.release_downloads from anon, authenticated;

drop function if exists public.record_download(uuid);

create or replace function public.record_download(
  rid uuid,
  visitor_hash text,
  skip_count boolean default false
)
returns table (path text, name text, blocked text)
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  fpath text;
  fname text;
  sstatus text;
  phidden timestamptz;
  today date := (now() at time zone 'utc')::date;
  n integer;
begin
  select r.project_id, r.file_path, r.file_name, r.scan_status, p.hidden_at
  into pid, fpath, fname, sstatus, phidden
  from public.project_releases r
  join public.projects p on p.id = r.project_id
  where r.id = rid;

  if pid is null or fpath is null then
    return;
  end if;

  if phidden is not null then
    path := null;
    name := null;
    blocked := 'hidden';
    return next;
    return;
  end if;

  if sstatus = 'malicious' then
    path := null;
    name := null;
    blocked := 'malicious';
    return next;
    return;
  end if;

  if not skip_count and visitor_hash is not null then
    insert into public.release_downloads (release_id, day, visitor)
    values (rid, today, visitor_hash)
    on conflict (release_id, day, visitor) do update set hits = public.release_downloads.hits + 1
    returning hits into n;

    if n = 1 then
      update public.project_releases set download_count = download_count + 1 where id = rid;
      update public.projects set download_count = download_count + 1 where id = pid;
      insert into public.project_daily_stats (project_id, day, downloads)
      values (pid, today, 1)
      on conflict (project_id, day) do update set downloads = public.project_daily_stats.downloads + 1;
    end if;
  end if;

  path := fpath;
  name := fname;
  blocked := null;
  return next;
end;
$$;

revoke execute on function public.record_download(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.record_download(uuid, text, boolean) to service_role;

-- -------------------------------------------------------------
-- Postgres rate limiting (server-only via service_role)
-- -------------------------------------------------------------
create table public.rate_limits (
  key      text primary key,
  hits     integer not null default 1,
  reset_at timestamptz not null
);
create index rate_limits_reset_idx on public.rate_limits (reset_at);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.check_rate_limit(k text, lim integer, win_secs integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_hits integer;
  new_reset timestamptz := now() + make_interval(secs => win_secs);
begin
  insert into public.rate_limits as rl (key, hits, reset_at)
  values (k, 1, new_reset)
  on conflict (key) do update
    set hits = case when rl.reset_at <= now() then 1 else rl.hits + 1 end,
        reset_at = case when rl.reset_at <= now() then new_reset else rl.reset_at end
  returning hits into new_hits;

  return new_hits <= lim;
end;
$$;

revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
