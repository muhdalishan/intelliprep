-- IP-90 / IP-91: study groups. Students create or join a group with an invite code and share one or
-- many of their subjects into it. Every member can then read the shared subject, its documents and
-- chunks, and edit its shared planner and board together. Flashcards and reminders stay personal.

create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.study_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('lead', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id);

create table public.group_subjects (
  group_id uuid not null references public.study_groups (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  shared_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  shared_at timestamptz not null default now(),
  primary key (group_id, subject_id)
);

create index group_subjects_subject_id_idx on public.group_subjects (subject_id);

create table public.group_messages (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.study_groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index group_messages_group_created_idx on public.group_messages (group_id, created_at);

-- Membership checks run as the table owner so policies can use them without recursing into RLS.

create function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m where m.group_id = gid and m.user_id = (select auth.uid())
  );
$$;

create function public.is_group_lead(gid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = (select auth.uid()) and m.role = 'lead'
  );
$$;

create function public.group_has_members(gid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.group_members m where m.group_id = gid);
$$;

-- True for the subject's owner and for members of any group the subject is shared with.
create function public.can_access_subject(sid uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.subjects s where s.id = sid and s.user_id = (select auth.uid()))
      or exists (
        select 1
        from public.group_subjects gs
        join public.group_members m on m.group_id = gs.group_id
        where gs.subject_id = sid and m.user_id = (select auth.uid())
      );
$$;

-- The creator of a group is its lead.
create function public.add_group_creator() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, role) values (new.id, new.created_by, 'lead');
  return new;
end;
$$;

create trigger study_groups_add_creator
  after insert on public.study_groups
  for each row execute function public.add_group_creator();

-- Joining needs the invite code; non-members can't read groups, so this runs as the owner.
create function public.join_group(code text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  gid uuid;
begin
  select id into gid from public.study_groups where invite_code = upper(trim(code));
  if gid is null then
    raise exception 'No group has that invite code' using errcode = 'P0002';
  end if;
  insert into public.group_members (group_id, user_id) values (gid, (select auth.uid()))
  on conflict do nothing;
  return gid;
end;
$$;

-- Leaving: the last member's departure deletes the group; a group never stays without a lead.
create function public.leave_group(gid uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.group_members where group_id = gid and user_id = (select auth.uid());
  if not exists (select 1 from public.group_members where group_id = gid) then
    delete from public.study_groups where id = gid;
  elsif not exists (select 1 from public.group_members where group_id = gid and role = 'lead') then
    update public.group_members set role = 'lead'
    where group_id = gid
      and user_id = (select user_id from public.group_members where group_id = gid order by joined_at limit 1);
  end if;
end;
$$;

-- Members see each other's name and avatar, never email or settings.
create function public.group_member_list(gid uuid)
returns table (user_id uuid, full_name text, avatar_url text, role text, joined_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, p.full_name, p.avatar_url, m.role, m.joined_at
  from public.group_members m
  join public.profiles p on p.id = m.user_id
  where m.group_id = gid and public.is_group_member(gid)
  order by m.joined_at;
$$;

revoke execute on function public.join_group(text), public.leave_group(uuid), public.group_member_list(uuid)
  from public, anon;
grant execute on function public.join_group(text), public.leave_group(uuid), public.group_member_list(uuid)
  to authenticated;

-- Policies ------------------------------------------------------------------

alter table public.study_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_subjects enable row level security;
alter table public.group_messages enable row level security;

-- The creator clause only covers the instant between insert and the lead trigger (so
-- `insert ... returning` works); once anyone is a member, membership alone decides.
create policy "Groups are readable by their members"
  on public.study_groups for select to authenticated
  using (
    public.is_group_member(id)
    or (created_by = (select auth.uid()) and not public.group_has_members(id))
  );
create policy "Anyone signed in can create a group"
  on public.study_groups for insert to authenticated with check ((select auth.uid()) = created_by);
create policy "Leads can rename their group"
  on public.study_groups for update to authenticated
  using (public.is_group_lead(id)) with check (public.is_group_lead(id));
create policy "Leads can delete their group"
  on public.study_groups for delete to authenticated using (public.is_group_lead(id));

create policy "Members can see who is in their group"
  on public.group_members for select to authenticated using (public.is_group_member(group_id));
create policy "Leads can remove members"
  on public.group_members for delete to authenticated
  using (public.is_group_lead(group_id) and user_id <> (select auth.uid()));
-- Joining goes through join_group(), leaving through leave_group().

create policy "Members can see the group's subjects"
  on public.group_subjects for select to authenticated using (public.is_group_member(group_id));
create policy "Members can share their own subjects into the group"
  on public.group_subjects for insert to authenticated
  with check (
    public.is_group_member(group_id)
    and shared_by = (select auth.uid())
    and exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = (select auth.uid()))
  );
create policy "The sharer or a lead can unshare a subject"
  on public.group_subjects for delete to authenticated
  using (shared_by = (select auth.uid()) or public.is_group_lead(group_id));

create policy "Members can read the group chat"
  on public.group_messages for select to authenticated using (public.is_group_member(group_id));
create policy "Members can post in the group chat"
  on public.group_messages for insert to authenticated
  with check (public.is_group_member(group_id) and user_id = (select auth.uid()));
create policy "Authors can delete their messages"
  on public.group_messages for delete to authenticated using (user_id = (select auth.uid()));

-- Shared subjects are readable by group members (adds to the owner-only policies).

create policy "Shared subjects are readable by group members"
  on public.subjects for select to authenticated using (public.can_access_subject(id));
create policy "Class slots of shared subjects are readable by group members"
  on public.class_slots for select to authenticated using (public.can_access_subject(subject_id));
create policy "Documents of shared subjects are readable by group members"
  on public.documents for select to authenticated using (public.can_access_subject(subject_id));
create policy "Chunks of shared subjects are readable by group members"
  on public.document_chunks for select to authenticated using (public.can_access_subject(subject_id));

-- Shared planner and board ---------------------------------------------------
-- One planner and one board per subject, edited together by everyone who can access the subject.

create table public.subject_tasks (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'todo' check (status in ('todo', 'learning', 'practiced', 'mastered')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subject_tasks_subject_id_idx on public.subject_tasks (subject_id);

create table public.board_notes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) <= 2000),
  color text not null default 'bg-yellow-200',
  x integer not null default 100,
  y integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index board_notes_subject_id_idx on public.board_notes (subject_id);

alter table public.subject_tasks enable row level security;
alter table public.board_notes enable row level security;

create policy "Tasks are readable by everyone on the subject"
  on public.subject_tasks for select to authenticated using (public.can_access_subject(subject_id));
create policy "Tasks are added by everyone on the subject"
  on public.subject_tasks for insert to authenticated
  with check (public.can_access_subject(subject_id) and created_by = (select auth.uid()));
create policy "Tasks are updated by everyone on the subject"
  on public.subject_tasks for update to authenticated
  using (public.can_access_subject(subject_id)) with check (public.can_access_subject(subject_id));
create policy "Tasks are deleted by everyone on the subject"
  on public.subject_tasks for delete to authenticated using (public.can_access_subject(subject_id));

create policy "Board notes are readable by everyone on the subject"
  on public.board_notes for select to authenticated using (public.can_access_subject(subject_id));
create policy "Board notes are added by everyone on the subject"
  on public.board_notes for insert to authenticated
  with check (public.can_access_subject(subject_id) and created_by = (select auth.uid()));
create policy "Board notes are updated by everyone on the subject"
  on public.board_notes for update to authenticated
  using (public.can_access_subject(subject_id)) with check (public.can_access_subject(subject_id));
create policy "Board notes are deleted by everyone on the subject"
  on public.board_notes for delete to authenticated using (public.can_access_subject(subject_id));

create trigger subject_tasks_set_updated_at
  before update on public.subject_tasks for each row execute function public.set_updated_at();
create trigger board_notes_set_updated_at
  before update on public.board_notes for each row execute function public.set_updated_at();

-- Live updates for chat, planner and board through Supabase Realtime (skipped where it isn't set up).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.group_messages, public.subject_tasks, public.board_notes;
  end if;
end;
$$;
