-- IP-60 / IP-61 / IP-62: past papers, their extracted questions, and ranked topic predictions.
-- Depends on 20261102000000_profiles_and_subjects.sql and 20261102020000_documents_and_chunks.sql.

create table public.past_papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  exam text not null default 'final' check (exam in ('mid', 'final', 'quiz', 'other')),
  year smallint not null check (year between 1990 and 2100),
  created_at timestamptz not null default now(),
  unique (subject_id, exam, year)
);

alter table public.past_papers enable row level security;

create policy "Past papers are readable by their owner"
  on public.past_papers for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Past papers are created by their owner on their own subjects"
  on public.past_papers for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = (select auth.uid()))
  );

create policy "Past papers are deletable by their owner"
  on public.past_papers for delete to authenticated
  using ((select auth.uid()) = user_id);

create table public.past_paper_questions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.past_papers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_number text,
  question_text text not null,
  marks smallint,
  embedding extensions.vector(1024),
  created_at timestamptz not null default now()
);

create index past_paper_questions_paper_id_idx on public.past_paper_questions (paper_id);

alter table public.past_paper_questions enable row level security;

-- Questions are extracted by the worker; students read their own.
create policy "Past paper questions are readable by their owner"
  on public.past_paper_questions for select to authenticated
  using ((select auth.uid()) = user_id);

-- Latest prediction run per subject; replaced on each run.
create table public.exam_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  rank smallint not null,
  topic_name text not null,
  confidence real not null check (confidence between 0 and 1),
  frequency real not null check (frequency between 0 and 1),
  years smallint[] not null,
  question_ids uuid[] not null,
  created_at timestamptz not null default now(),
  unique (subject_id, rank)
);

alter table public.exam_predictions enable row level security;

create policy "Predictions are readable by their owner"
  on public.exam_predictions for select to authenticated
  using ((select auth.uid()) = user_id);
