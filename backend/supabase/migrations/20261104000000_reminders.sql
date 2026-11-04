-- IP-110, IP-111: reminders delivered automatically, and notification settings on the profile.
--
-- Reminders are personal (never shared with groups). The student decides what, when and how;
-- the scheduler (service role) owns delivery: status, attempts, retries and the delivery log.

alter table public.profiles
  add column telegram_chat_id bigint,
  add column quiet_hours_start time,
  add column quiet_hours_end time,
  add column timezone text not null default 'Asia/Karachi' check (char_length(timezone) <= 64);

-- Students edit their own profile, but only the server links a Telegram chat (after the
-- student opens the bot with a one-time code), so nobody can point reminders at someone else.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, notification_channel, quiet_hours_start, quiet_hours_end, timezone)
  on public.profiles to authenticated;

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Any subject id (account or browser) and its name, for filtering and for the message text.
  subject_key text check (char_length(subject_key) <= 64),
  subject_name text check (char_length(subject_name) <= 120),
  message text not null check (char_length(message) between 1 and 300),
  due_at timestamptz not null,
  channel text not null default 'app'
    check (channel in ('app', 'telegram', 'email', 'push', 'whatsapp', 'sms')),
  source text not null default 'manual' check (source in ('manual', 'nova', 'planner', 'flashcards')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts smallint not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  sent_at timestamptz,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reminders_user_due_idx on public.reminders (user_id, due_at);
create index reminders_pending_due_idx on public.reminders (due_at) where status = 'pending';

alter table public.reminders enable row level security;

create policy "Reminders are readable by their owner"
  on public.reminders for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Reminders are created by their owner"
  on public.reminders for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Reminders are editable by their owner"
  on public.reminders for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Reminders are deletable by their owner"
  on public.reminders for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Delivery fields belong to the scheduler.
revoke update on public.reminders from authenticated;
grant update (message, due_at, channel, seen_at) on public.reminders to authenticated;

create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

create table public.notification_log (
  id bigint generated always as identity primary key,
  reminder_id uuid not null references public.reminders (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null,
  attempt smallint not null,
  result text not null check (result in ('sent', 'retry', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index notification_log_reminder_idx on public.notification_log (reminder_id);

alter table public.notification_log enable row level security;

-- Written only by the scheduler; students can see how their reminders were delivered.
create policy "Delivery log is readable by its owner"
  on public.notification_log for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.notification_log from authenticated;
