-- IP-60, IP-61: past papers are processed in the background, like documents.
-- Students upload; the server extracts questions, embeds them and ranks topics, and owns these
-- status fields (there is no update policy for students on past_papers).

alter table public.past_papers
  add column filename text not null default 'paper' check (char_length(filename) <= 200),
  add column status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  add column failure_reason text,
  add column question_count integer not null default 0;
