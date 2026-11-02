-- IP-41 / IP-50 / IP-51: flashcards with SM-2 scheduling, and the review log that drives streaks.
-- Depends on 20261102000000_profiles_and_subjects.sql (subjects, set_updated_at).

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  term text not null,
  definition text not null,
  -- SM-2 state (app/modules/flashcards/sm2.py)
  ease_factor real not null default 2.5 check (ease_factor >= 1.3),
  interval_days integer not null default 1 check (interval_days >= 1),
  repetitions integer not null default 0 check (repetitions >= 0),
  next_review date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index flashcards_due_idx on public.flashcards (user_id, next_review);
create index flashcards_subject_id_idx on public.flashcards (subject_id);

alter table public.flashcards enable row level security;

create policy "Flashcards are readable by their owner"
  on public.flashcards for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Flashcards are created by their owner on their own subjects"
  on public.flashcards for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = (select auth.uid()))
  );

create policy "Flashcards are editable by their owner"
  on public.flashcards for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Flashcards are deletable by their owner"
  on public.flashcards for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger flashcards_set_updated_at
  before update on public.flashcards
  for each row execute function public.set_updated_at();

-- One row per rating. Streaks are computed from distinct review days.
create table public.flashcard_reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  flashcard_id uuid not null references public.flashcards (id) on delete cascade,
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  reviewed_on date not null default current_date,
  reviewed_at timestamptz not null default now()
);

create index flashcard_reviews_user_day_idx on public.flashcard_reviews (user_id, reviewed_on);

alter table public.flashcard_reviews enable row level security;

create policy "Reviews are readable by their owner"
  on public.flashcard_reviews for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Reviews are recorded by their owner on their own cards"
  on public.flashcard_reviews for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.flashcards f where f.id = flashcard_id and f.user_id = (select auth.uid()))
  );
