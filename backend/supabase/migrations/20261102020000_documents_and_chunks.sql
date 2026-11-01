-- IP-20 / IP-22 / IP-30: uploaded documents and their chunks, with embeddings in pgvector.
-- Depends on 20261102000000_profiles_and_subjects.sql (subjects, set_updated_at).

create extension if not exists vector with schema extensions;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  filename text not null,
  storage_path text not null unique,
  format text not null check (format in ('pdf', 'image', 'pptx', 'audio', 'text')),
  kind text not null default 'notes' check (kind in ('notes', 'past_paper')),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'completed', 'failed')),
  failure_reason text,
  page_count integer,
  empty_pages integer[] not null default '{}',
  chunk_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_subject_id_idx on public.documents (subject_id);

alter table public.documents enable row level security;

create policy "Documents are readable by their owner"
  on public.documents for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Documents are created by their owner on their own subjects"
  on public.documents for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = (select auth.uid()))
  );

create policy "Documents are deletable by their owner"
  on public.documents for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Status, counts and failure reasons are written by the ingestion worker (service role), not by users.

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  page_start integer not null,
  page_end integer not null,
  token_estimate integer not null,
  -- voyage-3.5 embeddings (1024 dimensions)
  embedding extensions.vector(1024),
  -- Full-text side of hybrid search (IP-31)
  content_tsv tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index document_chunks_user_subject_idx on public.document_chunks (user_id, subject_id);
create index document_chunks_embedding_idx on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);
create index document_chunks_tsv_idx on public.document_chunks using gin (content_tsv);

alter table public.document_chunks enable row level security;

-- Students can only ever read their own chunks; chunks are written by the ingestion worker.
create policy "Chunks are readable by their owner"
  on public.document_chunks for select to authenticated
  using ((select auth.uid()) = user_id);
