-- =============================================================
-- 0006: profile photos, and locking image URLs to our own storage.
-- Run in Supabase SQL Editor after 0005_private_votes.sql
-- =============================================================

-- Public bucket for profile photos. The app crops and shrinks them to 400x400 before upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "users upload own avatars" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.upload_quota_ok('avatars', 20, 52428800)        -- 20 photos/day, 50 MB total per user
  );
create policy "users read own avatar objects" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own avatars" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Where the current photo lives, so the old one can be deleted when it's replaced.
alter table public.profiles
  add column avatar_path text check (avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$');
alter table public.profiles
  add constraint profiles_avatar_path_own check (avatar_path is null or split_part(avatar_path, '/', 1) = id::text);
grant update (avatar_path) on public.profiles to authenticated;

-- Image URLs can only point at our own Supabase storage, so nobody can set their avatar or a cover
-- to a tracking pixel or an image hosted elsewhere by calling the API directly.
-- NOT VALID: existing rows aren't re-checked, every new insert/update is.
alter table public.profiles add constraint profiles_avatar_url_storage check (
  avatar_url is null
  or avatar_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'
) not valid;
alter table public.projects add constraint projects_cover_url_storage check (
  cover_url is null
  or cover_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/covers/'
) not valid;

-- The daily cleanup also removes photos that were uploaded but never saved, or were replaced.
create or replace function public.orphaned_uploads(older_than interval default interval '24 hours')
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path = public, storage
as $$
  select o.bucket_id, o.name
  from storage.objects o
  where o.bucket_id in ('files', 'covers', 'avatars')
    and o.created_at < now() - older_than
    and not exists (select 1 from public.project_releases r where r.file_path = o.name)
    and not exists (select 1 from public.projects p where p.cover_path = o.name)
    and not exists (select 1 from public.profiles pr where pr.avatar_path = o.name)
  order by o.created_at
  limit 1000;
$$;
