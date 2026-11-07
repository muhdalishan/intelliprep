-- IP-40: summaries saved to the student's history. Personal, even in shared subjects.

create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  content text not null check (char_length(content) between 1 and 60000),
  source_document_ids uuid[] not null default '{}',
  cites_pages boolean not null default false,
  created_at timestamptz not null default now()
);

create index summaries_user_subject_idx on public.summaries (user_id, subject_id, created_at desc);

alter table public.summaries enable row level security;

create policy "Summaries are readable by their owner"
  on public.summaries for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Summaries are saved by their owner on subjects they can access"
  on public.summaries for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_access_subject(subject_id));

create policy "Summaries are deletable by their owner"
  on public.summaries for delete to authenticated
  using ((select auth.uid()) = user_id);
