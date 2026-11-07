-- IP-41, IP-51: flashcards saved in decks and reviewed on a schedule.
--
-- Flashcards stay personal, but a student may now keep cards for any subject they can access,
-- including one shared with their group (before, only their own subjects).

create table public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  source_document_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index flashcard_decks_user_subject_idx on public.flashcard_decks (user_id, subject_id);

alter table public.flashcard_decks enable row level security;

create policy "Decks are readable by their owner"
  on public.flashcard_decks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Decks are created by their owner on subjects they can access"
  on public.flashcard_decks for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_access_subject(subject_id));

create policy "Decks are deletable by their owner"
  on public.flashcard_decks for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.flashcards
  add column deck_id uuid references public.flashcard_decks (id) on delete cascade;

create index flashcards_deck_id_idx on public.flashcards (deck_id);

drop policy "Flashcards are created by their owner on their own subjects" on public.flashcards;

create policy "Flashcards are created by their owner on subjects they can access"
  on public.flashcards for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_access_subject(subject_id));
