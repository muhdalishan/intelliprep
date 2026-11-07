-- IP-42: saved quizzes scored on the server, and weak topics.
--
-- The correct answer and explanation of every question are hidden from students' database
-- role (column grants), so they can't be read even through Supabase's REST API. Questions,
-- attempts and answers are written by the server, so a score can't be forged.

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  question_count smallint not null check (question_count between 1 and 30),
  source_document_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index quizzes_user_subject_idx on public.quizzes (user_id, subject_id);

alter table public.quizzes enable row level security;

create policy "Quizzes are readable by their owner"
  on public.quizzes for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Quizzes are created by their owner on subjects they can access"
  on public.quizzes for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_access_subject(subject_id));

create policy "Quizzes are deletable by their owner"
  on public.quizzes for delete to authenticated
  using ((select auth.uid()) = user_id);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  position smallint not null,
  question text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation text not null,
  topic text not null,
  unique (quiz_id, position)
);

alter table public.quiz_questions enable row level security;

create policy "Quiz questions are readable by their owner"
  on public.quiz_questions for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.quiz_questions from authenticated;
grant select (id, quiz_id, user_id, position, question, options, topic)
  on public.quiz_questions to authenticated;

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score smallint not null,
  total smallint not null,
  time_taken_s integer check (time_taken_s >= 0),
  submitted_at timestamptz not null default now()
);

create index quiz_attempts_user_idx on public.quiz_attempts (user_id, submitted_at desc);

alter table public.quiz_attempts enable row level security;

create policy "Attempts are readable by their owner"
  on public.quiz_attempts for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.quiz_attempts from authenticated;

create table public.attempt_answers (
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  chosen_index smallint check (chosen_index between 0 and 3),
  is_correct boolean not null,
  primary key (attempt_id, question_id)
);

alter table public.attempt_answers enable row level security;

create policy "Answers are readable by their owner"
  on public.attempt_answers for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.attempt_answers from authenticated;

create table public.weak_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic text not null check (char_length(topic) between 1 and 200),
  origin text not null default 'quiz' check (origin in ('quiz', 'flashcard', 'exam', 'manual')),
  note text check (char_length(note) <= 500),
  misses integer not null default 1 check (misses >= 1),
  last_missed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, subject_id, topic)
);

alter table public.weak_topics enable row level security;

create policy "Weak topics are readable by their owner"
  on public.weak_topics for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Weak topics are added by their owner on subjects they can access"
  on public.weak_topics for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_access_subject(subject_id));

create policy "Weak topics are updated by their owner"
  on public.weak_topics for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Weak topics are cleared by their owner"
  on public.weak_topics for delete to authenticated
  using ((select auth.uid()) = user_id);
