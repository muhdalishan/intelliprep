-- IP-130: AI usage per student per day, for the daily budget. Written only by the server.

create table public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  tokens bigint not null default 0 check (tokens >= 0),
  requests integer not null default 0 check (requests >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

create policy "AI usage is readable by its owner"
  on public.ai_usage for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.ai_usage from authenticated;
