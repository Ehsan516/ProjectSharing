# Forkyard (working name)

A social platform for sharing things people build: mods, tools, scripts, device tweaks and hacks.
Search for anything ("pokemon", "fire tv", "tesla"), follow tags to get a personal feed, and post your own projects.

Projects can include a downloadable **.zip**, a **YouTube video** (autoplays muted while it's centered on screen, tap to
unmute) and **"works for me"** reports from other users saying whether it ran on their setup.

Stack: Next.js 15 (App Router, server actions) + Supabase (Postgres, auth, storage) + Tailwind CSS 4.

## Setup

1. **Create a Supabase project** at https://supabase.com.
2. **Run the schema:** in the Supabase dashboard open *SQL Editor → New query*, then paste and run each file in
   [`supabase/migrations/`](supabase/migrations/) in order (`0001_…` through `0006_…`). Skipping one breaks the feed, because the code reads
   columns the later migrations add.
3. **Configure auth redirects:** *Authentication → URL Configuration*
   - Site URL: `http://localhost:3000` (your real domain later)
   - Redirect URLs: add `http://localhost:3000/**` (and `https://yourdomain.com/**` later). The wildcard lets
     sign-in links return to any page, including the `?next=` page people were on. If Supabase rejects the redirect,
     it falls back to the Site URL, and the middleware still finishes the sign-in from there.
   - Optional: paste `supabase/templates/sign_in.html` into the "Magic link or OTP" and "Confirm sign up" templates
     to add a 6-digit code and a link that works on any device. Sign-in works with the default emails too.
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
| Project page: zip download, YouTube video, links, works-for-me reports, comments, report/delete | `src/app/p/[id]` |
| Post a project with zip + cover upload (direct to Supabase Storage, with progress) | `src/app/new` |
| Releases: version + changelog + zip per version; "works for me" reports per version | `src/app/p/[id]/release` |
| Follow a project to get its updates in *For you*; updates bump it to the top of *Latest* | `toggleFollowProject` |
| Download counts (downloads go through `/d/<release id>`) | `src/app/d/[releaseId]` |
| Profiles + settings | `src/app/u/[username]`, `src/app/settings` |
| Magic-link auth | `src/app/login`, `src/app/auth/callback` |

All writes go through server actions in `src/lib/actions.ts`. The database enforces permissions with row-level
security. Vote, comment and works counters are kept in sync by triggers, and clients can't write them directly.

## Upload limits & cleanup

- Per user: 20 zips/day and 2 GB total; 50 cover images/day and 500 MB total (enforced by storage policies in `0003`).
- `/api/cron/cleanup` deletes uploads older than 24h that were never attached to a project or release. It needs
  `SUPABASE_SECRET_KEY` and `CRON_SECRET` (server-only env vars). On Vercel, `vercel.json` runs it daily; elsewhere call
  it with `curl -H "Authorization: Bearer $CRON_SECRET" https://yoursite/api/cron/cleanup`.
- The 50 MB per-file limit comes from the Supabase free plan. Paid plans allow far larger files, which matters for big game mods.

## Moderation

- Users can report projects. Reports land in the `reports` table; review them in the Supabase Table Editor.
- Zips are user uploads and are **not scanned**. Consider adding malware scanning (e.g. VirusTotal API) before launch.
- Before launch, publish a DMCA / takedown contact, and terms that ban ROMs, pirated software and malware.

## Legal pages and account deletion

- `/terms`, `/privacy` and `/contact` (takedowns, complaints) are linked in the footer. Set `NEXT_PUBLIC_OPERATOR_NAME` and
  `NEXT_PUBLIC_CONTACT_EMAIL`: until you do, those pages show a red placeholder where your name and email go.
- Settings has **Download your data** (JSON export) and **Delete account**. Deletion needs `SUPABASE_SECRET_KEY` on the
  server, because removing the sign-in account requires the service role.
- The pages are a starting draft, not legal advice. Get them checked before launch, and update them if you add analytics,
  ads or a new provider.

## Renaming

The name lives in `SITE_NAME` in `src/lib/env.ts`.
