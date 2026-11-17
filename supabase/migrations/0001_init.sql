-- =============================================================
-- Project sharing platform: initial schema
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run
-- (or `supabase db push` if you use the Supabase CLI)
-- =============================================================

create extension if not exists unaccent with schema extensions;

-- -------------------------------------------------------------
-- Profiles (one per auth user, created automatically on sign-up)
-- -------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 60),
  bio          text check (char_length(bio) <= 300),
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 10),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------
-- Projects
-- -------------------------------------------------------------
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles (id) on delete cascade,
  title         text not null check (char_length(title) between 3 and 120),
  summary       text not null check (char_length(summary) between 1 and 280),
  body          text check (char_length(body) <= 20000),
  -- The "recipe": prompt/spec so others can rebuild it for their own setup
  prompt        text check (char_length(prompt) <= 20000),
  made_with     text check (char_length(made_with) <= 80),   -- e.g. "Claude Code"
  works_on      text check (char_length(works_on) <= 200),   -- e.g. "Fire TV Stick 4K, FireOS 8"
  link_url      text check (link_url ~ '^https?://'),
  source_url    text check (source_url ~ '^https?://'),
  cover_url     text,
  tags          text[] not null default '{}' check (cardinality(tags) <= 8),
  vote_count    integer not null default 0,
  comment_count integer not null default 0,
  works_yes     integer not null default 0,
  works_no      integer not null default 0,
  search        tsvector,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index projects_created_at_idx on public.projects (created_at desc);
create index projects_votes_idx      on public.projects (vote_count desc, created_at desc);
create index projects_author_idx     on public.projects (author_id, created_at desc);
create index projects_tags_idx       on public.projects using gin (tags);
create index projects_search_idx     on public.projects using gin (search);

create or replace function public.projects_search_update()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.search :=
       setweight(to_tsvector('english', unaccent(coalesce(new.title, ''))), 'A')
    || setweight(to_tsvector('english', unaccent(replace(array_to_string(new.tags, ' '), '-', ' '))), 'A')
    || setweight(to_tsvector('english', unaccent(coalesce(new.works_on, ''))), 'B')
    || setweight(to_tsvector('english', unaccent(coalesce(new.summary, ''))), 'B')
    || setweight(to_tsvector('english', unaccent(coalesce(new.body, ''))), 'C');
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_search_trg
  before insert or update of title, summary, body, tags, works_on on public.projects
  for each row execute function public.projects_search_update();

-- -------------------------------------------------------------
-- Votes, comments, "works for me" reports, tag follows, abuse reports
-- -------------------------------------------------------------
create table public.votes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);
create index votes_project_idx on public.votes (project_id);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index comments_project_idx on public.comments (project_id, created_at);

create table public.works_reports (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  worked     boolean not null,
  setup      text check (char_length(setup) <= 200),  -- their device / game version
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);
create index works_reports_project_idx on public.works_reports (project_id, created_at desc);

create table public.tag_follows (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  tag        text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, tag)
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason      text not null check (char_length(reason) between 1 and 1000),
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Counter maintenance (security definer so it can bypass RLS)
-- -------------------------------------------------------------
create or replace function public.bump_vote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.projects set vote_count = vote_count + 1 where id = new.project_id;
  elsif tg_op = 'DELETE' then
    update public.projects set vote_count = greatest(vote_count - 1, 0) where id = old.project_id;
  end if;
  return null;
end;
$$;

create trigger votes_count_trg
  after insert or delete on public.votes
  for each row execute function public.bump_vote_count();

create or replace function public.bump_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.projects set comment_count = comment_count + 1 where id = new.project_id;
  elsif tg_op = 'DELETE' then
    update public.projects set comment_count = greatest(comment_count - 1, 0) where id = old.project_id;
  end if;
  return null;
end;
$$;

create trigger comments_count_trg
  after insert or delete on public.comments
  for each row execute function public.bump_comment_count();

create or replace function public.refresh_works_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid := coalesce(new.project_id, old.project_id);
begin
  update public.projects p set
    works_yes = (select count(*) from public.works_reports w where w.project_id = pid and w.worked),
    works_no  = (select count(*) from public.works_reports w where w.project_id = pid and not w.worked)
  where p.id = pid;
  return null;
end;
$$;

create trigger works_reports_count_trg
  after insert or update or delete on public.works_reports
  for each row execute function public.refresh_works_counts();

-- -------------------------------------------------------------
-- Search + discovery functions
-- -------------------------------------------------------------
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
  where p.search @@ query.tsq
     or query.tag_guess = any (p.tags)
     or unaccent(p.title) ilike query.pattern
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
  group by t
  order by count(*) desc, t
  limit least(lim, 100);
$$;

-- -------------------------------------------------------------
-- Row level security
-- -------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.projects      enable row level security;
alter table public.votes         enable row level security;
alter table public.comments      enable row level security;
alter table public.works_reports enable row level security;
alter table public.tag_follows   enable row level security;
alter table public.reports       enable row level security;

-- profiles
create policy "profiles are public"      on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- projects
create policy "projects are public"      on public.projects for select using (true);
create policy "users create own projects" on public.projects for insert to authenticated
  with check (author_id = auth.uid());
create policy "users update own projects" on public.projects for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "users delete own projects" on public.projects for delete to authenticated
  using (author_id = auth.uid());

-- votes
create policy "votes are public"    on public.votes for select using (true);
create policy "users vote as self"  on public.votes for insert to authenticated with check (user_id = auth.uid());
create policy "users unvote as self" on public.votes for delete to authenticated using (user_id = auth.uid());

-- comments
create policy "comments are public"       on public.comments for select using (true);
create policy "users comment as self"     on public.comments for insert to authenticated with check (author_id = auth.uid());
create policy "users delete own comments" on public.comments for delete to authenticated using (author_id = auth.uid());

-- works reports
create policy "works reports are public"   on public.works_reports for select using (true);
create policy "users report works as self" on public.works_reports for insert to authenticated with check (user_id = auth.uid());
create policy "users update own works"     on public.works_reports for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own works"     on public.works_reports for delete to authenticated using (user_id = auth.uid());

-- tag follows (private to the user)
create policy "users see own follows"  on public.tag_follows for select to authenticated using (user_id = auth.uid());
create policy "users follow as self"   on public.tag_follows for insert to authenticated with check (user_id = auth.uid());
create policy "users unfollow as self" on public.tag_follows for delete to authenticated using (user_id = auth.uid());

-- abuse reports: insert only; review them in the Supabase dashboard
create policy "users file reports as self" on public.reports for insert to authenticated with check (reporter_id = auth.uid());

-- Column-level privileges: stop clients from writing counters / ids directly
revoke insert, update on public.profiles from anon, authenticated;
grant update (username, display_name, bio, avatar_url) on public.profiles to authenticated;

revoke insert, update on public.projects from anon, authenticated;
grant insert (author_id, title, summary, body, prompt, made_with, works_on, link_url, source_url, cover_url, tags)
  on public.projects to authenticated;
grant update (title, summary, body, prompt, made_with, works_on, link_url, source_url, cover_url, tags)
  on public.projects to authenticated;

revoke update on public.votes, public.comments, public.tag_follows, public.reports from anon, authenticated;

-- -------------------------------------------------------------
-- Storage: public bucket for cover images, uploads go in <user_id>/...
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "users upload own covers" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read own cover objects" on storage.objects for select to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own covers" on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
