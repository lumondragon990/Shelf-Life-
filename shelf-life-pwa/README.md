# Shelf Life — deployable PWA

The complete Shelf Life app as an installable Progressive Web App.
Build verified. Follow GO-LIVE below and you're on the internet in ~30 minutes.

## What's inside
- src/App.jsx ................ the full app (shelf, discover, personality, club, classroom, rewards)
- src/storage.js ............. localStorage now; Supabase for shared features when you add keys
- src/InstallPrompt.jsx ...... "Add to home screen" banner (with iOS instructions)
- api/claude.js .............. serverless proxy for AI features (keeps your API key secret)
- public/manifest.json + sw.js + icons ... the PWA layer (already wired into index.html)

## GO-LIVE (in order)

1. **Put this folder on GitHub.**
   Easiest path, no command line: github.com -> New repository -> "uploading an existing file"
   -> drag this whole folder's contents in -> Commit.
   (Don't upload node_modules or dist if present — they're rebuilt automatically.)

2. **Deploy on Vercel.**
   vercel.com -> Sign up with GitHub -> Add New Project -> pick the repo -> Deploy.
   Vercel auto-detects Vite. ~90 seconds later you have https://shelf-life-xxxx.vercel.app
   The app ALREADY WORKS at this point: shelf, streaks, personality quiz, rewards, classroom
   (single-device). Installable from the browser immediately.

3. **Turn on AI features** (personality extra picks + book quizzes).
   console.anthropic.com -> create an API key.
   Vercel -> your project -> Settings -> Environment Variables:
     ANTHROPIC_API_KEY = sk-ant-...
   Redeploy (Deployments -> ... -> Redeploy).

4. **Turn on shared features** (club wall, meetups, classroom sync across devices).
   supabase.com -> New project (free tier) -> SQL Editor -> paste the SQL from the
   top of src/storage.js -> Run.
   Vercel env vars:
     VITE_SUPABASE_URL      = https://xxxx.supabase.co
     VITE_SUPABASE_ANON_KEY = (from Supabase -> Settings -> API)
   Redeploy. Now a teacher's dashboard sees students on other phones.

5. **Custom domain** (optional but worth it): buy shelflifereading.com (or similar)
   at any registrar (~$15/yr) -> Vercel -> Settings -> Domains -> add it.

6. **Make the QR codes** (from the pwa-kit):
   python make_qr.py https://yourdomain.com
   python make_qr.py "https://yourdomain.com/?class=K7M3Q"   # per-class QR

## Verify it's a real PWA
- Chrome desktop: DevTools -> Application -> Manifest -> "Installable" is green
- Android: visit the site -> install banner appears -> installs to home screen
- iPhone: Safari -> Share -> Add to Home Screen -> opens full-screen, no browser bar
- Airplane mode: installed app still opens

## Local development (optional)
Requires Node 18+: `npm install` then `npm run dev` -> http://localhost:5173
Note: /api/claude only runs on Vercel; use `npx vercel dev` to test AI locally.

## Before a real school pilot (not needed for friendly demos)
- Tighten Supabase row-level-security policies + add auth
- Add a moderation/report flow for the club wall
- COPPA: minimal data (first names only — already the design), privacy policy page
