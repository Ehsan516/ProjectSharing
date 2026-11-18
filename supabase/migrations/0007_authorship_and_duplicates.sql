-- =============================================================
-- 0007: credit for shared work, duplicate-file detection, and report types.
-- Run in Supabase SQL Editor after 0006_avatars.sql
-- =============================================================

-- -------------------------------------------------------------
-- Authorship: "I made this" or "Sharing someone else's work (with permission)"
-- -------------------------------------------------------------
alter table public.projects
  add column authorship text not null default 'own' check (authorship in ('own', 'shared')),
  add column original_creator text check (char_length(original_creator) between 1 and 80),
  add column original_url text check (original_url ~ '^https?://' and char_length(original_url) <= 2000),
  add column permission_confirmed boolean not null default false;

-- Shared work must credit the creator, link the original, and confirm permission.
alter table public.projects add constraint projects_shared_credit check (
  authorship = 'own'
  or (original_creator is not null and original_url is not null and permission_confirmed)
);

grant insert (authorship, original_creator, original_url, permission_confirmed) on public.projects to authenticated;
grant update (authorship, original_creator, original_url, permission_confirmed) on public.projects to authenticated;

-- -------------------------------------------------------------
-- Duplicate files: every uploaded zip is fingerprinted by storage (its ETag, computed server-side
-- from the file's bytes). A release can't use a file that's already on Forkyard under someone
-- else's account. Enforced here, so it can't be skipped by calling the API directly.
-- -------------------------------------------------------------
alter table public.project_releases add column file_etag text check (char_length(file_etag) <= 100);
create index project_releases_etag_idx on public.project_releases (file_etag) where file_etag is not null;

create or replace function public.release_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  fp text;
  owner_id uuid;
  dup record;
begin
  new.file_etag := null;
  if new.file_path is null then
    return new;
  end if;

  select o.metadata ->> 'eTag' into fp
  from storage.objects o
  where o.bucket_id = 'files' and o.name = new.file_path;
  new.file_etag := fp;
  if fp is null then
    return new;
  end if;

  select p.author_id into owner_id from public.projects p where p.id = new.project_id;

  select p.title, pr.username into dup
  from public.project_releases r
  join public.projects p on p.id = r.project_id
  join public.profiles pr on pr.id = p.author_id
  where r.file_etag = fp and p.author_id <> owner_id
  limit 1;

  if found then
    -- The app turns this into a friendly message.
    raise exception using errcode = 'P0001', message = format('duplicate_file:%s:%s', dup.username, dup.title);
  end if;
  return new;
end;
$$;

create trigger project_releases_fingerprint_trg
  before insert on public.project_releases
  for each row execute function public.release_fingerprint();

-- Fingerprint files that were uploaded before this migration.
update public.project_releases r
set file_etag = o.metadata ->> 'eTag'
from storage.objects o
where o.bucket_id = 'files' and o.name = r.file_path and r.file_etag is null;

-- -------------------------------------------------------------
-- Report types, so "this is my work" claims can be handled first.
-- -------------------------------------------------------------
alter table public.reports
  add column kind text not null default 'other'
  check (kind in ('my_work', 'malware', 'rom_or_piracy', 'illegal', 'other'));
create index reports_kind_idx on public.reports (kind, created_at desc);

-- A queue to review in the Table Editor or SQL Editor: ownership claims and malware first.
create or replace view public.report_queue
with (security_invoker = true)
as
select r.created_at, r.kind, r.reason, p.id as project_id, p.title, a.username as posted_by, rep.username as reported_by
from public.reports r
join public.projects p on p.id = r.project_id
left join public.profiles a on a.id = p.author_id
left join public.profiles rep on rep.id = r.reporter_id
order by
  case r.kind when 'my_work' then 0 when 'malware' then 1 when 'illegal' then 2 when 'rom_or_piracy' then 3 else 4 end,
  r.created_at;
revoke all on public.report_queue from anon, authenticated;
