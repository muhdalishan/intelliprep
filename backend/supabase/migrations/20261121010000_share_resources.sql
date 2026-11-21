-- Sharing study material into group chats, and keeping the original of uploaded documents.

-- The uploaded file itself (until now only its text was kept), so a PDF can be shared as a PDF.
-- Owner-only, like documents. Moves to Supabase Storage with IP-20.
create table public.document_files (
  document_id uuid primary key references public.documents (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 26214400),
  data bytea not null,
  created_at timestamptz not null default now()
);

alter table public.document_files enable row level security;

create policy "Document files are readable by their owner"
  on public.document_files for select to authenticated using (user_id = (select auth.uid()));
create policy "Document files are added by their owner"
  on public.document_files for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Document files are deletable by their owner"
  on public.document_files for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, delete on public.document_files to authenticated;

-- A chat message can carry a copy of something shared from a subject: a quiz, a deck of
-- flashcards, a summary or a document. It's a snapshot, so later edits or deletes by the sharer
-- don't change what the group received.
alter table public.group_messages add column resource jsonb
  check (resource is null or (jsonb_typeof(resource) = 'object' and pg_column_size(resource) < 400000));
