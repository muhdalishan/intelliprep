-- Files in the group chat: photos, PDFs, audio, video and documents attached to a message.
-- Files are kept in the database (up to 10 MB each) so the chat works without a storage bucket;
-- moving them to Supabase Storage later only changes where `data` lives (IP-20).

-- A message may now be only attachments, with no text.
alter table public.group_messages drop constraint if exists group_messages_body_check;
alter table public.group_messages add constraint group_messages_body_check check (char_length(body) <= 2000);

create table public.group_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id bigint not null references public.group_messages (id) on delete cascade,
  group_id uuid not null references public.study_groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  filename text not null check (char_length(filename) between 1 and 200),
  content_type text not null check (char_length(content_type) between 3 and 120),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  data bytea not null,
  created_at timestamptz not null default now()
);

create index group_attachments_message_idx on public.group_attachments (message_id);
create index group_attachments_group_idx on public.group_attachments (group_id, created_at);

alter table public.group_attachments enable row level security;

create policy "Members can see the group's files"
  on public.group_attachments for select to authenticated using (public.is_group_member(group_id));
create policy "Members can attach files to their own messages"
  on public.group_attachments for insert to authenticated
  with check (
    public.is_group_member(group_id)
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.group_messages m
      where m.id = message_id and m.group_id = group_attachments.group_id and m.user_id = (select auth.uid())
    )
  );
create policy "Authors can delete their files"
  on public.group_attachments for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, delete on public.group_attachments to authenticated;
