-- IP-02 / IP-11: profiles (one per account) and subjects, with row-level security.
-- Every table: RLS on, policies scoped to (select auth.uid()). The backend queries as the
-- `authenticated` role with the caller's JWT claims (app/db/session.py), so these policies
-- apply to every API request.

-- Keeps updated_at current on any table that has the column.
create function public.set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  notification_channel text not null default 'none'
    check (notification_channel in ('none', 'telegram', 'whatsapp')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by their owner"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Profiles are editable by their owner"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert or delete policy: rows are created by the trigger below and removed with the account.

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile when Supabase Auth creates the user. full_name comes from the
-- sign-up form's user metadata.
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Subjects ------------------------------------------------------------------

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  instructor text,
  credits smallint check (credits between 1 and 6),
  color text,
  exam_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subjects_user_id_idx on public.subjects (user_id);

alter table public.subjects enable row level security;

create policy "Subjects are readable by their owner"
  on public.subjects for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Subjects are created by their owner"
  on public.subjects for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Subjects are editable by their owner"
  on public.subjects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Subjects are deletable by their owner"
  on public.subjects for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();

-- Weekly class times for a subject (the timetable in the workspace).
create table public.class_slots (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  time_label text not null,
  room text,
  created_at timestamptz not null default now()
);

create index class_slots_subject_id_idx on public.class_slots (subject_id);

alter table public.class_slots enable row level security;

create policy "Class slots are readable by their owner"
  on public.class_slots for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Class slots are created by their owner on their own subjects"
  on public.class_slots for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = (select auth.uid()))
  );

create policy "Class slots are deletable by their owner"
  on public.class_slots for delete to authenticated
  using ((select auth.uid()) = user_id);
