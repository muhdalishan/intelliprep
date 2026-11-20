import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Check, Copy, Crown, Database, ImagePlus, Info, LogIn, LogOut, Paperclip, Plus,
  RefreshCw, SendHorizontal, Share2, Trash2, Upload, Users, X,
} from 'lucide-react';
import { Button, cn } from './UIComponents';
import { apiFetch, ApiError } from '../services/apiClient';
import * as groups from '../services/groupService';
import type { GroupAttachment, GroupDetail, GroupMessage, GroupSummary } from '../services/groupService';
import { saveSubjectToAccount } from '../services/workspaceService';
import { Subject } from '../types';
import { confirmAction, notify } from './Feedback';
import { FileCard, formatSize, KIND_STYLE, mediaKind, MediaViewer, MessageMedia, fileUrl } from './GroupMedia';

interface Props {
  /** The subject the student is in; the Groups page passes none. */
  subject?: Subject;
}

const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.zip';

const initials = (name: string) => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || '?';
const HUES = ['bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500'];
const NAME_TONES = ['text-rose-500', 'text-amber-500', 'text-emerald-500', 'text-sky-500', 'text-violet-500', 'text-pink-500', 'text-teal-500', 'text-indigo-500'];
const hash = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const hue = (key: string) => HUES[hash(key) % HUES.length];
const nameTone = (key: string) => NAME_TONES[hash(key) % NAME_TONES.length];

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

const Avatar: React.FC<{ name: string; id: string; size?: 'sm' | 'md' }> = ({ name, id, size = 'md' }) => (
  <span className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold text-white", hue(id), size === 'sm' ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs")}>
    {initials(name)}
  </span>
);

interface Pending { id: string; file: File; preview: string | null }

/** Study groups as a group chat: groups on the left, the conversation with files in the middle, details on the right. */
export const StudyGroups: React.FC<Props> = ({ subject }) => {
  const navigate = useNavigate();
  const subjectId = subject?.id ?? '';
  const [list, setList] = useState<GroupSummary[] | null>(null);
  const [selected, setSelected] = useState<GroupDetail | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState<'create' | 'join' | null>(null);
  const [newName, setNewName] = useState(subject ? `${subject.name} study group` : '');
  const [code, setCode] = useState('');
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [viewing, setViewing] = useState<GroupAttachment | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const fail = (e: unknown) => {
    if (e instanceof ApiError && (e.code === 'database_unavailable' || e.code === 'offline')) setUnavailable(e.message);
    else notify(e instanceof Error ? e.message : 'Something went wrong.', 'error');
  };

  const run = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    try { return await action(); } catch (e) { fail(e); return undefined; } finally { setBusy(false); }
  };

  const refreshList = useCallback(async () => {
    try { setList(await groups.listGroups()); setUnavailable(null); } catch (e) { fail(e); }
  }, []);

  useEffect(() => { refreshList(); }, [refreshList]);
  useEffect(() => {
    apiFetch<{ id: string }>('/auth/me').then(p => setMe(p.id)).catch(() => setMe(null));
  }, []);

  const open = async (id: string) => {
    const detail = await run(() => groups.getGroup(id));
    if (detail) {
      setSelected(detail);
      setMessages(await groups.listMessages(id).catch(() => []));
    }
  };

  // Open the first group straight away on wide screens, so the page is never a blank form.
  useEffect(() => {
    if (!selected && list && list.length > 0 && window.matchMedia('(min-width: 768px)').matches) open(list[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  // New messages every few seconds while a group is open.
  useEffect(() => {
    if (!selected) return;
    const timer = window.setInterval(async () => {
      if (document.hidden) return;
      const lastId = messages.at(-1)?.id ?? 0;
      const fresh = await groups.listMessages(selected.id, lastId).catch(() => []);
      if (fresh.length) setMessages(current => [...current, ...fresh.filter(f => !current.some(c => c.id === f.id))]);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [selected, messages]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, selected?.id]);

  const afterChange = (detail: GroupDetail | undefined) => {
    if (detail) { setSelected(detail); refreshList(); }
  };

  // Files waiting to be sent ------------------------------------------------------------------
  const addFiles = (incoming: FileList | File[]) => {
    const files = Array.from(incoming);
    const room = MAX_FILES - pending.length;
    if (files.length > room) notify(`You can send up to ${MAX_FILES} files at once.`, 'info');
    const accepted: Pending[] = [];
    for (const file of files.slice(0, Math.max(0, room))) {
      if (file.size > MAX_BYTES) { notify(`${file.name} is over 10 MB.`, 'error'); continue; }
      if (/\.(html?|svg|js|exe|bat|sh)$/i.test(file.name)) { notify(`${file.name} can't be shared here.`, 'error'); continue; }
      const kind = mediaKind(file.type, file.name);
      accepted.push({ id: `${file.name}-${file.size}-${Math.random()}`, file, preview: kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : null });
    }
    if (accepted.length) setPending(current => [...current, ...accepted]);
  };

  const removePending = (id: string) => setPending(current => {
    const item = current.find(p => p.id === id);
    if (item?.preview) URL.revokeObjectURL(item.preview);
    return current.filter(p => p.id !== id);
  });

  const send = async () => {
    if (!selected || sending) return;
    const text = draft.trim();
    if (!text && pending.length === 0) return;
    setSending(true);
    try {
      const message = pending.length
        ? await groups.postFiles(selected.id, pending.map(p => p.file), text)
        : await groups.postMessage(selected.id, text);
      setMessages(current => [...current, message]);
      setDraft('');
      pending.forEach(p => p.preview && URL.revokeObjectURL(p.preview));
      setPending([]);
      textarea.current?.focus();
    } catch (e) {
      fail(e);
    } finally {
      setSending(false);
    }
  };

  const removeMessage = async (message: GroupMessage) => {
    if (!selected) return;
    if (!(await confirmAction({ title: 'Delete this message?', message: message.attachments.length ? 'Its files are deleted too.' : 'Everyone in the group stops seeing it.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await groups.deleteMessage(selected.id, message.id);
      setMessages(current => current.filter(m => m.id !== message.id));
    } catch (e) { fail(e); }
  };

  const copyCode = (inviteCode: string) => {
    navigator.clipboard?.writeText(inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  // Day separators and runs of messages from the same person.
  const timeline = useMemo(() => messages.map((message, i) => {
    const previous = messages[i - 1];
    const newDay = !previous || new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString();
    const continued = !newDay && previous && previous.user_id === message.user_id
      && new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < 5 * 60 * 1000;
    return { message, newDay, continued };
  }), [messages]);

  const sharedFiles = useMemo(() => messages.flatMap(m => m.attachments ?? []), [messages]);
  const sharedImages = sharedFiles.filter(f => mediaKind(f.content_type, f.filename) === 'image');
  const sharedDocs = sharedFiles.filter(f => mediaKind(f.content_type, f.filename) !== 'image');

  if (unavailable) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <div className="space-y-4 rounded-xl border border-gray-200 p-8 text-center dark:border-white/[.07]">
          <Database className="mx-auto h-6 w-6 text-amber-500" />
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">Study groups go live with accounts</h2>
          <p className="mx-auto max-w-md text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
            Groups let classmates join with an invite code, share subjects, plan and chat together. They need real
            accounts and a shared database. Connect the Supabase project, or for testing on this computer set
            DATABASE_URL=local in backend/.env and restart the backend.
          </p>
          <p className="text-xs text-gray-400">{unavailable}</p>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => { setUnavailable(null); refreshList(); }}>Try again</Button>
        </div>
      </div>
    );
  }

  const canShareHere = groups.isAccountSubjectId(subjectId);
  const alreadyShared = selected?.subjects.some(s => s.id === subjectId);

  const shareThisSubject = async () => {
    if (!selected || !subject) return;
    if (canShareHere) { afterChange(await run(() => groups.shareSubject(selected.id, subjectId))); return; }
    // Subjects that live only in this browser are saved to the account first.
    const accountId = await run(() => saveSubjectToAccount(subject));
    if (!accountId) return;
    const detail = await run(() => groups.shareSubject(selected.id, accountId));
    if (detail) navigate(`/subject/${accountId}?tab=studyroom`, { replace: true });
  };

  // Group details: invite code, subjects, members, files.
  const details = selected && (
    <div className="space-y-6 p-4">
      <div className="text-center">
        <span className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-semibold text-white", hue(selected.id))}>{initials(selected.name)}</span>
        <h3 className="mt-2 text-[15px] font-semibold text-gray-900 dark:text-white">{selected.name}</h3>
        <p className="text-xs text-gray-500">{selected.members.length} member{selected.members.length === 1 ? '' : 's'} · you're {selected.role === 'lead' ? 'the lead' : 'a member'}</p>
      </div>

      <div className="rounded-lg border border-gray-200 p-3 dark:border-white/[.07]">
        <p className="text-xs text-gray-500">Invite code</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="font-mono text-base font-semibold tracking-[0.2em] text-gray-900 dark:text-white">{selected.invite_code}</span>
          <button onClick={() => copyCode(selected.invite_code)} className="flex h-7 items-center gap-1 rounded-md border border-gray-200 px-2 text-xs text-gray-700 hover:bg-gray-50 dark:border-white/[.09] dark:text-gray-300 dark:hover:bg-white/[.05]">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-xs font-medium text-gray-500"><BookOpen className="h-3.5 w-3.5" /> Shared subjects</h4>
          {subject && !alreadyShared && (
            <button onClick={shareThisSubject} disabled={busy} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
              <Share2 className="h-3.5 w-3.5" /> Share {subject.name}
            </button>
          )}
        </div>
        {selected.subjects.length === 0 ? <p className="text-[13px] text-gray-400">No subjects shared yet.</p> : (
          <ul className="space-y-1">
            {selected.subjects.map(s => (
              <li key={s.id} className="group/subj flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-white/[.03]">
                <button onClick={() => navigate(`/subject/${s.id}`)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{s.name}</p>
                  <p className="truncate text-[11px] text-gray-500">by {s.shared_by_name}{s.exam_date ? ` · paper ${new Date(s.exam_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</p>
                </button>
                <button className="text-[11px] text-gray-400 opacity-0 hover:text-red-500 group-hover/subj:opacity-100" onClick={async () => afterChange(await run(() => groups.unshareSubject(selected.id, s.id)))}>Unshare</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500"><Users className="h-3.5 w-3.5" /> Members</h4>
        <ul className="space-y-1">
          {selected.members.map(member => (
            <li key={member.user_id} className="group/member flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-white/[.03]">
              <Avatar name={member.full_name || 'Student'} id={member.user_id} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-gray-800 dark:text-gray-200">{member.full_name || 'Student'}{member.user_id === me ? <span className="text-gray-400"> (you)</span> : null}</span>
              {member.role === 'lead'
                ? <Crown className="h-3.5 w-3.5 text-amber-500" aria-label="Lead" />
                : selected.role === 'lead' && member.user_id !== me && (
                  <button className="text-[11px] text-gray-400 opacity-0 hover:text-red-500 group-hover/member:opacity-100"
                    onClick={async () => { if (await confirmAction({ title: `Remove ${member.full_name}?`, message: 'They lose access to the shared subjects and chat. They can rejoin with the invite code.', confirmLabel: 'Remove', danger: true })) afterChange(await run(() => groups.removeMember(selected.id, member.user_id))); }}>
                    Remove
                  </button>
                )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500"><Paperclip className="h-3.5 w-3.5" /> Shared files <span className="text-gray-400">{sharedFiles.length}</span></h4>
        {sharedFiles.length === 0 ? <p className="text-[13px] text-gray-400">Photos and files sent in the chat show up here.</p> : (
          <div className="space-y-2">
            {sharedImages.length > 0 && (
              <div className="grid grid-cols-3 gap-1">
                {sharedImages.slice(-9).reverse().map(file => <GalleryThumb key={file.id} groupId={selected.id} file={file} onOpen={() => setViewing(file)} />)}
              </div>
            )}
            {sharedDocs.slice(-5).reverse().map(file => (
              <FileCard key={file.id} groupId={selected.id} file={file} onPreview={['pdf', 'video'].includes(mediaKind(file.content_type, file.filename)) ? () => setViewing(file) : undefined} />
            ))}
          </div>
        )}
      </section>

      <button
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/30 py-2 text-[13px] text-red-600 hover:bg-red-500/10 dark:text-red-400"
        onClick={async () => {
          const ok = await confirmAction({ title: `Leave ${selected.name}?`, message: "You'll lose access to its shared subjects and chat.", confirmLabel: 'Leave group', danger: true });
          if (!ok) return;
          await run(() => groups.leaveGroup(selected.id));
          setSelected(null); setShowInfo(false);
          refreshList();
        }}
      >
        <LogOut className="h-3.5 w-3.5" /> Leave group
      </button>
    </div>
  );

  return (
    <div className="flex h-full min-h-[560px] flex-1 overflow-hidden">
      {/* Groups */}
      <aside className={cn("w-full shrink-0 flex-col border-r border-gray-200 dark:border-white/[.07] md:flex md:w-72", selected ? "hidden" : "flex")}>
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-4 dark:border-white/[.07]">
          <h2 className="text-[13px] font-semibold text-gray-900 dark:text-white">Groups</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setForm(form === 'join' ? null : 'join')} className={cn("flex h-7 items-center gap-1 rounded-md px-2 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[.06]", form === 'join' && "bg-gray-100 dark:bg-white/[.08]")}>
              <LogIn className="h-3.5 w-3.5" /> Join
            </button>
            <button onClick={() => setForm(form === 'create' ? null : 'create')} className={cn("flex h-7 items-center gap-1 rounded-md px-2 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[.06]", form === 'create' && "bg-gray-100 dark:bg-white/[.08]")}>
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
        </div>

        {form && (
          <form
            className="space-y-2 border-b border-gray-200 p-3 animate-in dark:border-white/[.07]"
            onSubmit={async e => {
              e.preventDefault();
              if (form === 'create') {
                const detail = await run(() => groups.createGroup(newName.trim()));
                if (detail) { afterChange(detail); setMessages([]); setForm(null); }
              } else {
                const detail = await run(() => groups.joinGroup(code.trim()));
                if (detail) { setCode(''); afterChange(detail); setMessages(await groups.listMessages(detail.id).catch(() => [])); setForm(null); }
              }
            }}
          >
            {form === 'create' ? (
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} maxLength={80} placeholder="Group name" aria-label="Group name"
                className="h-8 w-full rounded-md border border-gray-200 bg-transparent px-2.5 text-[13px] outline-none focus:border-primary-500/70 dark:border-white/[.09]" />
            ) : (
              <input autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={16} placeholder="Invite code, e.g. 7F3A9C21" aria-label="Invite code"
                className="h-8 w-full rounded-md border border-gray-200 bg-transparent px-2.5 font-mono text-[13px] tracking-widest outline-none focus:border-primary-500/70 dark:border-white/[.09]" />
            )}
            <Button type="submit" size="sm" className="w-full" disabled={busy || (form === 'create' ? !newName.trim() : code.trim().length < 4)}>
              {form === 'create' ? 'Create group' : 'Join group'}
            </Button>
          </form>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {list === null && <p className="px-2 py-3 text-xs text-gray-400">Loading your groups…</p>}
          {list?.length === 0 && (
            <div className="px-3 py-8 text-center">
              <Users className="mx-auto h-6 w-6 text-gray-300 dark:text-gray-600" />
              <p className="mt-2 text-[13px] font-medium text-gray-700 dark:text-gray-300">No groups yet</p>
              <p className="mt-1 text-xs text-gray-500">Start one for your class, or join with a code from a classmate.</p>
              <div className="mt-3 flex justify-center gap-2">
                <Button size="sm" icon={Plus} onClick={() => setForm('create')}>New group</Button>
                <Button size="sm" variant="secondary" icon={LogIn} onClick={() => setForm('join')}>Join</Button>
              </div>
            </div>
          )}
          {list?.map(group => (
            <button
              key={group.id}
              onClick={() => { open(group.id); setShowInfo(false); }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                selected?.id === group.id ? "bg-gray-100 dark:bg-white/[.07]" : "hover:bg-gray-50 dark:hover:bg-white/[.03]"
              )}
            >
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-white", hue(group.id))}>{initials(group.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">
                  <span className="truncate">{group.name}</span>
                  {group.role === 'lead' && <Crown className="h-3 w-3 shrink-0 text-amber-500" />}
                </span>
                <span className="block truncate text-xs text-gray-500">{group.member_count} member{group.member_count === 1 ? '' : 's'} · {group.subject_count} subject{group.subject_count === 1 ? '' : 's'}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Conversation */}
      {!selected ? (
        <div className="hidden flex-1 flex-col items-center justify-center p-8 text-center md:flex">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/[.06]"><Users className="h-5 w-5 text-gray-400" /></span>
          <p className="mt-3 text-[15px] font-semibold text-gray-900 dark:text-white">Pick a group to start chatting</p>
          <p className="mt-1 max-w-sm text-[13px] text-gray-500">{subject ? `Share ${subject.name} into a group` : 'Share a subject into a group'} so everyone can see its documents, plan together and swap notes, photos and files here.</p>
        </div>
      ) : (
        <section
          className="relative flex min-w-0 flex-1 flex-col"
          onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
          onDragLeave={e => { if (e.currentTarget === e.target) setDragging(false); }}
          onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
        >
          <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 dark:border-white/[.07] sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <button onClick={() => setSelected(null)} className="-ml-1 flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[.06] md:hidden" aria-label="Back to groups">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold text-white", hue(selected.id))}>{initials(selected.name)}</span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-gray-900 dark:text-white">{selected.name}</p>
                <p className="truncate text-[11px] text-gray-500">{selected.members.map(m => m.full_name.split(' ')[0]).join(', ')}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <div className="mr-1 hidden -space-x-1.5 sm:flex">
                {selected.members.slice(0, 4).map(m => <span key={m.user_id} className="rounded-full ring-2 ring-white dark:ring-gray-900"><Avatar name={m.full_name || 'Student'} id={m.user_id} size="sm" /></span>)}
              </div>
              <button onClick={() => copyCode(selected.invite_code)} className="hidden h-7 items-center gap-1 rounded-md border border-gray-200 px-2 font-mono text-[11px] text-gray-600 hover:bg-gray-50 dark:border-white/[.09] dark:text-gray-300 dark:hover:bg-white/[.05] sm:flex" title="Copy invite code">
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />} {selected.invite_code}
              </button>
              <button onClick={() => setShowInfo(!showInfo)} className={cn("flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[.06] xl:hidden", showInfo && "bg-gray-100 text-gray-900 dark:bg-white/[.08] dark:text-white")} aria-label="Group details">
                <Info className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-semibold text-white", hue(selected.id))}>{initials(selected.name)}</span>
                <p className="mt-3 text-[15px] font-semibold text-gray-900 dark:text-white">Welcome to {selected.name}</p>
                <p className="mt-1 max-w-xs text-[13px] text-gray-500">Say hi, or share lecture slides, photos of the whiteboard, voice notes or past papers.</p>
              </div>
            )}
            {timeline.map(({ message, newDay, continued }) => {
              const mine = me !== null && message.user_id === me;
              const hasText = message.body.trim().length > 0;
              return (
                <React.Fragment key={message.id}>
                  {newDay && (
                    <div className="my-4 flex items-center gap-3">
                      <span className="h-px flex-1 bg-gray-200 dark:bg-white/[.07]" />
                      <span className="text-[11px] font-medium text-gray-500">{dayLabel(message.created_at)}</span>
                      <span className="h-px flex-1 bg-gray-200 dark:bg-white/[.07]" />
                    </div>
                  )}
                  <div className={cn("group/msg flex items-end gap-2", mine ? "flex-row-reverse" : "", continued ? "mt-0.5" : "mt-3")}>
                    {!mine && (continued ? <span className="w-8 shrink-0" /> : <Avatar name={message.author} id={message.user_id} />)}
                    <div className={cn("flex min-w-0 max-w-[82%] flex-col sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
                      {!mine && !continued && <span className={cn("mb-1 px-1 text-xs font-semibold", nameTone(message.user_id))}>{message.author}</span>}
                      <div className={cn(
                        "relative max-w-full break-words text-[13px] leading-relaxed",
                        (hasText || message.attachments.some(a => mediaKind(a.content_type, a.filename) !== 'image')) && "rounded-2xl px-3 py-2",
                        hasText || message.attachments.some(a => mediaKind(a.content_type, a.filename) !== 'image')
                          ? mine ? "rounded-br-md bg-primary-600 text-white" : "rounded-bl-md bg-gray-100 text-gray-900 dark:bg-white/[.07] dark:text-gray-100"
                          : ""
                      )}>
                        {message.attachments.length > 0 && (
                          <div className={cn(hasText && "mb-1.5")}>
                            <MessageMedia groupId={selected.id} files={message.attachments} mine={mine} onOpen={setViewing} />
                          </div>
                        )}
                        {hasText && <p className="whitespace-pre-wrap">{message.body}</p>}
                      </div>
                      <span className="mt-0.5 px-1 text-[10px] text-gray-400 opacity-0 transition-opacity group-hover/msg:opacity-100">{timeLabel(message.created_at)}</span>
                    </div>
                    {mine && (
                      <button onClick={() => removeMessage(message)} className="mb-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 opacity-0 hover:bg-red-500/10 hover:text-red-500 group-hover/msg:opacity-100" aria-label="Delete message">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Composer */}
          <div className="shrink-0 px-3 pb-3 sm:px-6 sm:pb-4">
            <div className="rounded-xl border border-gray-200 bg-white transition-colors focus-within:border-gray-300 dark:border-white/[.09] dark:bg-white/[.02] dark:focus-within:border-white/[.18]">
              {pending.length > 0 && (
                <div className="flex gap-2 overflow-x-auto border-b border-gray-100 p-2 dark:border-white/[.06]">
                  {pending.map(item => {
                    const kind = mediaKind(item.file.type, item.file.name);
                    const style = KIND_STYLE[kind];
                    return (
                      <div key={item.id} className="relative shrink-0 animate-in">
                        {item.preview && kind === 'image' ? (
                          <img src={item.preview} alt={item.file.name} className="h-16 w-16 rounded-lg object-cover" />
                        ) : item.preview && kind === 'video' ? (
                          <video src={item.preview} muted className="h-16 w-24 rounded-lg bg-black object-cover" />
                        ) : (
                          <div className="flex h-16 w-40 items-center gap-2 rounded-lg border border-gray-200 px-2 dark:border-white/[.08]">
                            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", style.tone)}><style.icon className="h-4 w-4" /></span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium text-gray-800 dark:text-gray-200">{item.file.name}</span>
                              <span className="block text-[11px] text-gray-500">{formatSize(item.file.size)}</span>
                            </span>
                          </div>
                        )}
                        <button onClick={() => removePending(item.id)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white shadow ring-2 ring-white dark:bg-white dark:text-gray-900 dark:ring-gray-900" aria-label={`Remove ${item.file.name}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <textarea
                ref={textarea}
                value={draft}
                onChange={e => { setDraft(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`; }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                onPaste={e => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); } }}
                rows={1}
                maxLength={2000}
                placeholder={pending.length ? 'Add a caption…' : `Message ${selected.name}`}
                aria-label={`Message ${selected.name}`}
                className="block max-h-[140px] w-full resize-none bg-transparent px-3 pt-2.5 text-[13px] text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
              />
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-0.5">
                  <button onClick={() => picker.current?.click()} className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white" title="Attach files" aria-label="Attach files">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button onClick={() => { if (picker.current) { picker.current.accept = 'image/*,video/*'; picker.current.click(); picker.current.accept = ACCEPT; } }} className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white" title="Photo or video" aria-label="Attach photo or video">
                    <ImagePlus className="h-4 w-4" />
                  </button>
                  <span className="ml-1 hidden text-[11px] text-gray-400 sm:inline">Photos, video, audio, PDF, Office · up to 10 MB</span>
                </div>
                <button
                  onClick={send}
                  disabled={sending || (!draft.trim() && pending.length === 0)}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-primary-600 px-3 text-[13px] font-medium text-white hover:bg-primary-500 disabled:opacity-40"
                  aria-label="Send"
                >
                  {sending ? <Upload className="h-3.5 w-3.5 animate-pulse" /> : <SendHorizontal className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{sending ? (pending.length ? 'Uploading…' : 'Sending…') : 'Send'}</span>
                </button>
              </div>
            </div>
            <input ref={picker} type="file" multiple accept={ACCEPT} className="hidden" onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
          </div>

          {dragging && (
            <div className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary-500 bg-primary-500/10 backdrop-blur-[1px]">
              <Upload className="h-6 w-6 text-primary-500" />
              <p className="mt-2 text-[13px] font-medium text-primary-700 dark:text-primary-300">Drop files to share with {selected.name}</p>
            </div>
          )}
        </section>
      )}

      {/* Details: always on wide screens, as a panel elsewhere */}
      {selected && (
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-gray-200 dark:border-white/[.07] xl:block">{details}</aside>
      )}
      {selected && showInfo && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-label="Group details">
          <button className="absolute inset-0 bg-black/40" onClick={() => setShowInfo(false)} aria-label="Close details" />
          <aside className="absolute inset-y-0 right-0 w-[22rem] max-w-[90vw] overflow-y-auto border-l border-gray-200 bg-white shadow-2xl animate-in dark:border-white/[.07] dark:bg-gray-900">
            <div className="flex justify-end p-2"><button onClick={() => setShowInfo(false)} className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[.06]" aria-label="Close details"><X className="h-4 w-4" /></button></div>
            {details}
          </aside>
        </div>
      )}

      {viewing && selected && <MediaViewer groupId={selected.id} file={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
};

const GalleryThumb: React.FC<{ groupId: string; file: GroupAttachment; onOpen: () => void }> = ({ groupId, file, onOpen }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let live = true; fileUrl(groupId, file).then(u => live && setUrl(u)).catch(() => {}); return () => { live = false; }; }, [groupId, file]);
  return (
    <button onClick={onOpen} className="aspect-square overflow-hidden rounded-md bg-gray-100 dark:bg-white/[.05]" aria-label={`Open ${file.filename}`}>
      {url && <img src={url} alt={file.filename} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />}
    </button>
  );
};
