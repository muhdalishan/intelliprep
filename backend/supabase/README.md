# Database migrations

SQL migrations for the Supabase Postgres database, in the folder layout the
[Supabase CLI](https://supabase.com/docs/guides/cli) expects. Files run in filename order and are
never edited once applied: add a new file instead.

## Apply to a Supabase project

With the Supabase CLI (installed via `npm i -g supabase` or `scoop install supabase`):

```bash
cd backend
supabase link --project-ref <your-project-ref>
supabase db push
```

Without the CLI: open the project's SQL Editor and run each file in `migrations/` in order.

## Rules for new migrations

- Name: `YYYYMMDDHHMMSS_short_description.sql`
- Every new table enables row-level security and has policies using `(select auth.uid())`
  (Definition of Done item 4), plus an isolation test once IP-12 lands.
- Tables owned by a user carry `user_id uuid not null default auth.uid()`.
