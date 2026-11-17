# Forkyard (working name)

A social platform for sharing things people build: mods, tools, scripts, device tweaks and hacks.
Search for anything ("pokemon", "fire tv", "tesla"), follow tags to get a personal feed, and post your own projects.

Each project can include a **recipe**: the prompt or spec behind it, so someone else can hand it to their AI and rebuild it
for their own device or game version. Other users then add **"works for me"** reports saying whether it ran on their setup.

Stack: Next.js 15 (App Router, server actions) + Supabase (Postgres, auth, storage) + Tailwind CSS 4.

## Setup

1. **Create a Supabase project** at https://supabase.com.
2. **Run the schema:** in the Supabase dashboard open *SQL Editor → New query*, paste
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and run it.
3. **Configure auth redirects:** *Authentication → URL Configuration*
   - Site URL: `http://localhost:3000` (your real domain later)
   - Redirect URLs: add `http://localhost:3000/auth/callback` (and `https://yourdomain.com/auth/callback` later)
4. **Env vars:** copy `.env.example` to `.env.local` and fill in the project URL and anon (or publishable) key
   from *Project Settings → API*.
5. **Run it:**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000, sign in with your email, pick a username, and post.

> Supabase's built-in email sender is rate-limited (a few emails per hour). Before launching, set up custom SMTP under
> *Authentication → Emails* (e.g. Resend, Postmark).

## What's in the MVP

| Feature | Where |
| --- | --- |
| Feed: *For you* (followed tags), *New*, *Top* | `src/app/page.tsx` |
| Full-text + tag search (accent-insensitive) | `src/app/search`, `search_projects()` SQL function |
| Tag pages with follow | `src/app/t/[tag]` |
| Project page: links, recipe with copy, works-for-me reports, comments, report/delete | `src/app/p/[id]` |
| Post a project with cover image upload | `src/app/new` |
| Profiles + settings | `src/app/u/[username]`, `src/app/settings` |
| Magic-link auth | `src/app/login`, `src/app/auth/callback` |

All writes go through server actions in `src/lib/actions.ts`. The database enforces permissions with row-level
security. Vote, comment and works counters are kept in sync by triggers, and clients can't write them directly.

## Moderation

- Users can report projects. Reports land in the `reports` table; review them in the Supabase Table Editor.
- Projects link out to where code lives. The site doesn't host downloads, which keeps malware and copyright exposure low.
- Before launch, publish a DMCA / takedown contact, and terms that ban ROMs, pirated software and malware.

## Renaming

The name lives in `SITE_NAME` in `src/lib/env.ts`.
