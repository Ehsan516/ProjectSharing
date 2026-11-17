-- =============================================================
-- 0002: zip file uploads + YouTube videos; drop recipe/made-with
-- Run in Supabase SQL Editor after 0001_init.sql
-- =============================================================

alter table public.projects
  drop column if exists prompt,
  drop column if exists made_with;

alter table public.projects
  add column youtube_id text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  add column file_path  text check (file_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.zip$'),
  add column file_name  text check (char_length(file_name) between 1 and 200),
  add column file_size  bigint check (file_size between 0 and 52428800),
  add column cover_path text check (cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp|gif)$');

grant insert (youtube_id, file_path, file_name, file_size, cover_path) on public.projects to authenticated;
grant update (youtube_id, file_path, file_name, file_size, cover_path) on public.projects to authenticated;

-- Uploaded files/covers must live in the author's own folder.
drop policy "users create own projects" on public.projects;
drop policy "users update own projects" on public.projects;

create policy "users create own projects" on public.projects for insert to authenticated
  with check (
    author_id = auth.uid()
    and (file_path  is null or split_part(file_path,  '/', 1) = auth.uid()::text)
    and (cover_path is null or split_part(cover_path, '/', 1) = auth.uid()::text)
  );
create policy "users update own projects" on public.projects for update to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and (file_path  is null or split_part(file_path,  '/', 1) = auth.uid()::text)
    and (cover_path is null or split_part(cover_path, '/', 1) = auth.uid()::text)
  );

-- Public bucket for project zips (50 MB max, the Supabase free-plan per-file limit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('files', 'files', true, 52428800, array['application/zip', 'application/x-zip-compressed'])
on conflict (id) do nothing;

create policy "users upload own files" on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own file objects" on storage.objects for select to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = auth.uid()::text);
