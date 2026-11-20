# Launch checklist

How to put IntelliPrep AI online: Supabase (accounts and database), Render (API) and Netlify
(website). Allow about an hour. Do the steps in order, because each step needs addresses from the one before.

> Secrets (database password, OpenAI key, Supabase service-role key) go only into the Render
> dashboard or `backend/.env`. Never into git, never into Netlify, never into a `VITE_` variable.

## 1. Supabase: database and accounts

1. Create a project at supabase.com. Region: **Southeast Asia (Singapore)** or **South Asia
   (Mumbai)**. Save the database password.
2. Create the tables. Either:
   - CLI: `cd backend`, `supabase link --project-ref <ref>`, `supabase db push`, or
   - Dashboard → SQL Editor: run each file in `backend/supabase/migrations/` **in filename order**.
3. **Authentication → URL Configuration**
   - Site URL: your Netlify address, e.g. `https://intelliprep.netlify.app`
   - Redirect URLs: add `https://intelliprep.netlify.app/**` and `http://localhost:3000/**`
4. **Authentication → Emails.** Supabase's built-in email sender only delivers to your own team's
   addresses and only a few emails an hour, so students would never get their confirmation email.
   Before launch, do one of these:
   - **Recommended:** Authentication → SMTP Settings, then connect a free sender (Resend, Brevo).
   - **Quick:** Authentication → Sign In / Providers → Email, then turn **Confirm email** off.
     Accounts then work immediately, but nobody verifies the email address, and password reset
     still needs SMTP.
5. Keep from **Project Settings → API**: the Project URL and the `anon` public key.
6. Keep from **Connect → Session pooler**: the connection string. Change the start from
   `postgresql://` to `postgresql+asyncpg://`. (Render can't reach the "Direct connection"
   address, which is IPv6-only.)

## 2. Render: the API

1. Push the repo to GitHub, then on render.com: **New → Blueprint**, pick the repo. It reads
   `render.yaml` (Docker, Singapore, health check `/api/health`).
2. Fill in the variables it asks for:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the session pooler string from step 1.6 (`postgresql+asyncpg://...`) |
   | `SUPABASE_URL` | Project URL, e.g. `https://abcd.supabase.co` |
   | `CORS_ORIGINS` | `["https://intelliprep.netlify.app"]` (JSON list, your real site) |
   | `OPENAI_API_KEY` | your OpenAI key |

   `ENVIRONMENT=production` and a random `SIGNING_SECRET` are set by the blueprint. If anything
   is missing, the API refuses to start and the log names the setting.
3. When it's live, open `https://<your-api>.onrender.com/api/health`. You should see `{"status":"ok"}`.

The free plan sleeps after 15 minutes idle, so the first request after that takes about a minute,
and reminders don't send while the API is asleep. For launch day, the Starter plan avoids both.

## 3. Netlify: the website

1. **Add new site → Import from GitHub**, pick the repo. Set **Base directory** to `frontend`. Build
   settings come from `frontend/netlify.toml`.
2. **Site configuration → Environment variables**:

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | `https://<your-api>.onrender.com/api` |
   | `VITE_SUPABASE_URL` | Project URL |
   | `VITE_SUPABASE_ANON_KEY` | the `anon` public key |

3. Deploy. If Netlify gave a different address than you used in steps 1.3 and 2.2, update
   those two settings.

## 4. Smoke test (10 minutes, in a private window)

- [ ] Create an account. The confirmation email arrives (or you're signed in, if confirmation is off).
- [ ] Sign out, then sign in again. A wrong password shows "Wrong email or password."
- [ ] Forgot password: the email arrives, and its link asks for a new password and signs you in.
- [ ] Add a subject. Refresh, and it's still there. Open it on another browser or your phone with the same account, and it's there too.
- [ ] Upload a PDF in Notes, then make a summary, a flashcard deck and a quiz. Each is saved and still there after a refresh.
- [ ] Rate a flashcard, finish a quiz, and check that weak topics appear.
- [ ] Sign up a second account: it doesn't see the first account's subjects.
- [ ] Delete the test subject.

## Running locally (unchanged)

Without `VITE_SUPABASE_*` in `frontend/.env.local` and with `ENVIRONMENT=local` in `backend/.env`,
sign-in only sets a flag in the browser and the API runs as a local test student. Use this only for
development; never deploy it like that.

## What's not in this launch

These are labelled "Soon" in the app: Google sign-in, keeping the original uploaded files, and
switching AI providers. Background jobs run inside the API process, so a restart in the middle of
processing a past paper loses that one job. Upload it again.
