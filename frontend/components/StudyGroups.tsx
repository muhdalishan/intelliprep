import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, Copy, Crown, Database, ImagePlus, Info, LogIn, LogOut, Mic, Paperclip, Plus,
  RefreshCw, SendHorizontal, Share2, Trash2, Upload, Users, X,
} from 'lucide-react';
import { Button, cn } from './UIComponents';
import { apiFetch, ApiError } from '../services/apiClient';
import * as groups from '../services/groupService';
import type { GroupAttachment, GroupDetail, GroupMessage, GroupSummary, SharedResource } from '../services/groupService';
import { listAccountSubjects, saveSubjectToAccount } from '../services/workspaceService';
import { ResourceCard, ResourceViewer, SharePicker } from './GroupResources';
import { Subject } from '../types';
import { confirmAction, notify } from './Feedback';
import { FileCard, formatSize, KIND_STYLE, mediaKind, MediaViewer, MessageMedia, fileUrl } from './GroupMedia';
import { clock, MAX_VOICE_SECONDS, useVoiceRecorder } from '../hooks/useVoiceRecorder';

interface Props {
  /** The open group, from the address /groups/:groupId. None shows the groups page. */
  groupId?: string;
  /** The subject the student is in; the Groups page passes none. */
  subject?: Subject;
}

const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.zip';

const initials = (name: string) => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || '?';
// People and groups are quiet initials on a raised neutral; colour is kept for what they share.
const TILE = "bg-gray-100 text-gray-700 ring-1 ring-inset ring-black/[.06] dark:bg-white/[.07] dark:text-gray-200 dark:ring-white/[.08]";

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
  <span data-id={id} className={cn("flex shrink-0 items-center justify-center rounded-full font-medium", TILE, size === 'sm' ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs")}>
    {initials(name)}
  </span>
);

interface Pending { id: string; file: File; preview: string | null }

/** Study groups as a group chat: groups on the left, the conversation with files in the middle, details on the right. */
export const StudyGroups: React.FC<Props> = ({ subject, groupId }) => {
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
  const [sharing, setSharing] = useState(false);
  const [openResource, setOpenResource] = useState<{ resource: SharedResource; from: string } | null>(null);
  const [mySubjects, setMySubjects] = useState<{ id: string; name: string }[]>([]);
  const [subjectMenu, setSubjectMenu] = useState(false);
  useEffect(() => {
    listAccountSubjects().then(list => setMySubjects(list.filter(s => s.owned).map(s => ({ id: s.id, name: s.name })))).catch(() => setMySubjects([]));
  }, []);
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

  // The address decides which group is open.
  useEffect(() => {
    if (groupId) { open(groupId); setShowInfo(false); } else { setSelected(null); setMessages([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

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

  // Keep the newest message in view, also while photos and files finish loading, unless the
  // student has scrolled up to read older messages.
  const pinned = useRef(true);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => { pinned.current = true; }, [selected?.id]);
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, selected?.id]);
  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner) return;
    // Only scrolling up unpins; our own scrolling down (and content growing) never does.
    let lastTop = el.scrollTop;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (nearBottom) pinned.current = true;
      else if (el.scrollTop < lastTop - 4) pinned.current = false;
      lastTop = el.scrollTop;
    };
    const grow = new ResizeObserver(() => { if (pinned.current) el.scrollTop = el.scrollHeight; });
    el.addEventListener('scroll', onScroll, { passive: true });
    grow.observe(inner);
    return () => { el.removeEventListener('scroll', onScroll); grow.disconnect(); };
  }, [selected?.id]);

  // Tell Nova a message box is at the bottom, so its button moves out of the way.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('chat-composer', { detail: selected ? (showInfo ? 'beside-panel' : 'above') : false }));
    return () => { window.dispatchEvent(new CustomEvent('chat-composer', { detail: false })); };
  }, [selected, showInfo]);

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

  // Voice notes: record in the browser, then send like any other file.
  const recorder = useVoiceRecorder(useCallback((message: string) => notify(message, 'error'), []));
  const sendVoice = async () => {
    if (!selected) return;
    const file = await recorder.stop();
    if (!file) { notify('Nothing was recorded.', 'info'); return; }
    if (file.size > MAX_BYTES) { notify('That voice note is over 10 MB.', 'error'); return; }
    setSending(true);
    try {
      const message = await groups.postFiles(selected.id, [file], '');
      setMessages(current => [...current, message]);
    } catch (e) { fail(e); } finally { setSending(false); }
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

  const unsharedSubjects = mySubjects.filter(s => !selected?.subjects.some(shared => shared.id === s.id));

  const shareThisSubject = async () => {
    if (!selected || !subject) return;
    if (canShareHere) { afterChange(await run(() => groups.shareSubject(selected.id, subjectId))); return; }
    // Subjects that live only in this browser are saved to the account first.
    const accountId = await run(() => saveSubjectToAccount(subject));
    if (!accountId) return;
    const detail = await run(() => groups.shareSubject(selected.id, accountId));
    if (detail) refreshList();
  };

  // Group details: invite code, subjects, members, files.
  const details = selected && (
    <div className="space-y-6 p-4">
      <div className="flex items-center gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-medium", TILE)}>{initials(selected.name)}</span>
        <div className="min-w-0">
        <h3 className="truncate text-[15px] font-medium text-gray-900 dark:text-white">{selected.name}</h3>
        <p className="text-xs text-gray-500">{selected.members.length} member{selected.members.length === 1 ? '' : 's'} · you're {selected.role === 'lead' ? 'the lead' : 'a member'}</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-3 dark:border-white/[.07]">
        <p className="text-xs text-gray-500">Invite code</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="font-mono text-[15px] tabular-nums tracking-[0.08em] text-gray-900 dark:text-white">{selected.invite_code}</span>
          <button onClick={() => copyCode(selected.invite_code)} className="flex h-7 items-center gap-1 rounded-md border border-gray-200 px-2 text-xs text-gray-700 hover:bg-gray-50 dark:border-white/[.09] dark:text-gray-300 dark:hover:bg-white/[.05]">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-medium text-gray-500">Shared subjects</h4>
          {subject && !alreadyShared ? (
            <button onClick={shareThisSubject} disabled={busy} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
              <Share2 className="h-3.5 w-3.5" /> Share {subject.name}
            </button>
          ) : unsharedSubjects.length > 0 && (
            <button onClick={() => setSubjectMenu(!subjectMenu)} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
              <Plus className="h-3.5 w-3.5" /> Share a subject
            </button>
          )}
        </div>
        {subjectMenu && (
          <ul className="mb-2 overflow-hidden rounded-lg border border-gray-200 animate-in dark:border-white/[.08]">
            {unsharedSubjects.map(s => (
              <li key={s.id}>
                <button
                  disabled={busy}
                  onClick={async () => { setSubjectMenu(false); afterChange(await run(() => groups.shareSubject(selected.id, s.id))); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/[.04]"
                >
                  <Share2 className="h-3.5 w-3.5 text-gray-400" /> {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
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
        <h4 className="mb-2 text-xs font-medium text-gray-500">Members</h4>
        <ul className="space-y-1">
          {selected.members.map(member => (
            <li key={member.user_id} className="group/member flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-white/[.03]">
              <Avatar name={member.full_name || 'Student'} id={member.user_id} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-gray-800 dark:text-gray-200">{member.full_name || 'Student'}{member.user_id === me ? <span className="text-gray-400"> (you)</span> : null}</span>
              {member.role === 'lead'
                ? <span className="text-[11px] text-gray-500">Lead</span>
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
        <h4 className="mb-2 text-xs font-medium text-gray-500">Shared files <span className="font-mono text-gray-400">{sharedFiles.length}</span></h4>
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
        className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
        onClick={async () => {
          const ok = await confirmAction({ title: `Leave ${selected.name}?`, message: "You'll lose access to its shared subjects and chat.", confirmLabel: 'Leave group', danger: true });
          if (!ok) return;
          await run(() => groups.leaveGroup(selected.id));
          setSelected(null); setShowInfo(false);
          refreshList();
          navigate('/groups');
        }}
      >
        <LogOut className="h-3.5 w-3.5" /> Leave group
      </button>
    </div>
  );

  return (
    <div className="flex h-full min-h-[560px] flex-1 overflow-hidden">
      {/* Groups home: every group as a card, like the dashboard */}
      {!groupId && (
        <main className="mx-auto w-full max-w-[1480px] overflow-y-auto px-4 py-7 pb-32 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Study groups</h1>
              <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">Chat, share notes and quizzes, and plan shared subjects with your classmates.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" icon={LogIn} onClick={() => setForm(form === 'join' ? null : 'join')}>Join with code</Button>
              <Button size="sm" icon={Plus} onClick={() => setForm(form === 'create' ? null : 'create')}>New group</Button>
            </div>
          </div>

          {form && (
            <form
              className="mt-5 flex max-w-xl flex-col gap-2 rounded-xl border border-gray-200 p-4 animate-in dark:border-white/[.08] sm:flex-row sm:items-center"
              onSubmit={async e => {
                e.preventDefault();
                const detail = form === 'create'
                  ? await run(() => groups.createGroup(newName.trim()))
                  : await run(() => groups.joinGroup(code.trim()));
                if (detail) { setCode(''); setForm(null); refreshList(); navigate(`/groups/${detail.id}`); }
              }}
            >
              {form === 'create' ? (
                <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} maxLength={80} placeholder="Group name, e.g. DS midterm crew" aria-label="Group name"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-transparent px-3 text-[13px] outline-none focus:border-primary-500/70 dark:border-white/[.09]" />
              ) : (
                <input autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={16} placeholder="Invite code, e.g. 7F3A9C21" aria-label="Invite code"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-transparent px-3 font-mono text-[13px] tracking-[0.08em] outline-none focus:border-primary-500/70 dark:border-white/[.09]" />
              )}
              <div className="flex gap-2">
                <Button type="submit" size="md" disabled={busy || (form === 'create' ? !newName.trim() : code.trim().length < 4)}>
                  {form === 'create' ? 'Create group' : 'Join group'}
                </Button>
                <Button type="button" size="md" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
              </div>
            </form>
          )}

          <div className="mt-6">
            {list === null && <p className="py-10 text-[13px] text-gray-500">Loading your groups…</p>}
            {list?.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 px-6 py-14 text-center dark:border-white/[.1]">
                <Users className="mx-auto h-7 w-7 text-gray-400" />
                <h3 className="mt-3 text-[15px] font-medium text-gray-900 dark:text-white">No groups yet</h3>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-gray-500">Start one for your class and share the invite code, or join with a code from a classmate.</p>
                <div className="mt-5 flex justify-center gap-2">
                  <Button size="sm" icon={Plus} onClick={() => setForm('create')}>New group</Button>
                  <Button size="sm" variant="secondary" icon={LogIn} onClick={() => setForm('join')}>Join with code</Button>
                </div>
              </div>
            )}
            {list && list.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map(group => (
                  <article
                    key={group.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/groups/${group.id}`)}
                    onKeyDown={e => { if (e.key === 'Enter') navigate(`/groups/${group.id}`); }}
                    className="group flex cursor-pointer flex-col rounded-xl border border-gray-200 bg-white p-4 transition-[border-color,background-color,box-shadow] hover:border-gray-300 hover:shadow-lg dark:border-white/[.07] dark:bg-white/[.015] dark:hover:border-white/[.14] dark:hover:bg-white/[.035]"
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-medium", TILE)}>{initials(group.name)}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[14px] font-medium text-gray-900 dark:text-white">{group.name}</h3>
                        <p className="text-xs text-gray-500">{group.role === 'lead' ? 'You lead this group' : 'Member'}</p>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/[.03]">
                        <dt className="text-gray-500">Members</dt>
                        <dd className="mt-0.5 text-[15px] font-medium tabular-nums text-gray-900 dark:text-white">{group.member_count}</dd>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/[.03]">
                        <dt className="text-gray-500">Shared subjects</dt>
                        <dd className="mt-0.5 text-[15px] font-medium tabular-nums text-gray-900 dark:text-white">{group.subject_count}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-white/[.06]">
                      <button
                        onClick={e => { e.stopPropagation(); copyCode(group.invite_code); }}
                        className="flex h-7 items-center gap-1.5 rounded-md px-2 font-mono text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[.06]"
                        title="Copy invite code"
                      >
                        <Copy className="h-3.5 w-3.5" /> {group.invite_code}
                      </button>
                      <span className="flex items-center gap-1 text-xs font-medium text-gray-400 transition-colors group-hover:text-primary-500">
                        Open chat <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </article>
                ))}
                <button
                  onClick={() => setForm('create')}
                  className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 text-[13px] text-gray-500 transition-colors hover:border-primary-500/60 hover:bg-primary-500/[.04] hover:text-primary-600 dark:border-white/[.1] dark:hover:text-primary-400"
                >
                  <Plus className="h-5 w-5" /> New group
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* One group: the chat, full width */}
      {groupId && !selected ? (
        <div className="flex flex-1 items-center justify-center text-[13px] text-gray-500">Opening group…</div>
      ) : selected && (
        <section
          className="relative flex min-w-0 flex-1 flex-col"
          onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
          onDragLeave={e => { if (e.currentTarget === e.target) setDragging(false); }}
          onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
        >
          <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 dark:border-white/[.07] sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <button onClick={() => navigate('/groups')} className="-ml-1 flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[.06]" aria-label="Back to groups">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-medium", TILE)}>{initials(selected.name)}</span>
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
              <button onClick={() => setShowInfo(!showInfo)} className={cn("flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[.06]", showInfo && "bg-gray-100 text-gray-900 dark:bg-white/[.08] dark:text-white")} aria-label={showInfo ? "Hide group details" : "Show group details"} title="Group details">
                <Info className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 pb-16 pt-4 sm:px-6">
            <div ref={content} className="mx-auto min-h-full max-w-4xl">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className={cn("flex h-12 w-12 items-center justify-center rounded-xl text-base font-medium", TILE)}>{initials(selected.name)}</span>
                <p className="mt-3 text-[15px] font-medium text-gray-900 dark:text-white">{selected.name}</p>
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
                  <div className={cn("group/msg flex items-end gap-2", mine ? "flex-row-reverse" : "", continued ? "mt-1" : "mt-4")}>
                    {!mine && (continued ? <span className="w-8 shrink-0" /> : <Avatar name={message.author} id={message.user_id} />)}
                    <div className={cn("flex min-w-0 max-w-[82%] flex-col gap-1 sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
                      {!mine && !continued && <span className="px-1 text-xs font-medium text-gray-700 dark:text-gray-300">{message.author}</span>}
                      {message.resource && (
                        <ResourceCard resource={message.resource} mine={false} onOpen={() => setOpenResource({ resource: message.resource!, from: mine ? 'you' : message.author })} />
                      )}
                      {message.attachments.length > 0 && (
                        <MessageMedia groupId={selected.id} files={message.attachments} mine={false} onOpen={setViewing} />
                      )}
                      {hasText && (
                        <p className={cn(
                          "max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13px] leading-relaxed text-gray-900 dark:text-gray-100",
                          mine
                            ? "rounded-br-md bg-gray-100 dark:bg-white/[.09]"
                            : "rounded-bl-md border border-gray-200 bg-white dark:border-white/[.08] dark:bg-white/[.02]"
                        )}>
                          {message.body}
                        </p>
                      )}
                      <span className="px-1 text-[11px] tabular-nums text-gray-500 opacity-0 transition-opacity group-hover/msg:opacity-100">{timeLabel(message.created_at)}</span>
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
          </div>

          {/* Composer */}
          <div className="mx-auto w-full max-w-4xl shrink-0 px-3 pb-3 sm:px-6 sm:pb-4">
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
              {recorder.state === 'recording' ? (
                <div className="flex items-center gap-2 p-2" role="status" aria-live="polite">
                  <button onClick={recorder.cancel} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-red-500/10 hover:text-red-500" title="Discard" aria-label="Discard voice note">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium tabular-nums text-gray-900 dark:text-gray-100">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> {clock(recorder.seconds)}
                  </span>
                  <div className="flex h-9 min-w-0 flex-1 items-center gap-[3px] overflow-hidden px-2" aria-hidden="true">
                    {recorder.levels.map((level, i) => (
                      <span key={i} className="w-[3px] shrink-0 rounded-full bg-primary-500/80 transition-[height] duration-100" style={{ height: `${Math.max(3, level * 32)}px` }} />
                    ))}
                  </div>
                  <span className="hidden shrink-0 text-[11px] text-gray-400 sm:inline">Up to {MAX_VOICE_SECONDS / 60} min</span>
                  <button onClick={sendVoice} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-3 text-[13px] font-medium text-white hover:bg-primary-500" aria-label="Send voice note">
                    <SendHorizontal className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Send</span>
                  </button>
                </div>
              ) : (<>
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
                  <button onClick={() => setSharing(true)} className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/[.06] dark:hover:text-white" title="Share notes, quizzes, flashcards or summaries from your subjects" aria-label="Share from your subjects">
                    <BookOpen className="h-4 w-4" /> <span className="hidden sm:inline">Share</span>
                  </button>
                  <span className="mx-0.5 h-4 w-px bg-gray-200 dark:bg-white/[.08]" />
                  <button onClick={() => picker.current?.click()} className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white" title="Attach files" aria-label="Attach files">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button onClick={() => { if (picker.current) { picker.current.accept = 'image/*,video/*'; picker.current.click(); picker.current.accept = ACCEPT; } }} className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white" title="Photo or video" aria-label="Attach photo or video">
                    <ImagePlus className="h-4 w-4" />
                  </button>
                  <button onClick={recorder.start} disabled={sending} className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white" title="Record a voice note" aria-label="Record a voice note">
                    <Mic className="h-4 w-4" />
                  </button>
                  <span className="ml-2 hidden text-xs text-gray-500 lg:inline">Up to 10 MB per file</span>
                </div>
                {!draft.trim() && pending.length === 0 && !sending ? (
                  <button
                    onClick={recorder.start}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-primary-600 px-3 text-[13px] font-medium text-white hover:bg-primary-500"
                    aria-label="Record voice note"
                  >
                    <Mic className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Voice</span>
                  </button>
                ) : (
                  <button
                    onClick={send}
                    disabled={sending || (!draft.trim() && pending.length === 0)}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-primary-600 px-3 text-[13px] font-medium text-white hover:bg-primary-500 disabled:opacity-40"
                    aria-label="Send"
                  >
                    {sending ? <Upload className="h-3.5 w-3.5 animate-pulse" /> : <SendHorizontal className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{sending ? (pending.length ? 'Uploading…' : 'Sending…') : 'Send'}</span>
                  </button>
                )}
              </div>
              </>)}
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

      {/* Details, on demand: a side pane on wide screens, a sheet elsewhere */}
      {selected && showInfo && (
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-gray-200 animate-in dark:border-white/[.07] xl:block">{details}</aside>
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
      {openResource && <ResourceViewer resource={openResource.resource} from={openResource.from} onClose={() => setOpenResource(null)} />}
      {sharing && selected && (
        <SharePicker
          groupId={selected.id}
          groupName={selected.name}
          onClose={() => setSharing(false)}
          onShare={async (item, comment) => {
            try {
              const message = await groups.shareResource(selected.id, item.kind, item.id, comment);
              setMessages(current => [...current, message]);
              notify(`Shared ${item.title}`, 'success');
              return true;
            } catch (e) { fail(e); return false; }
          }}
        />
      )}
    </div>
  );
};

const GalleryThumb: React.FC<{ groupId: string; file: GroupAttachment; onOpen: () => void }> = ({ groupId, file, onOpen }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let live = true; fileUrl(groupId, file).then(u => live && setUrl(u)).catch(() => {}); return () => { live = false; }; }, [groupId, file]);
  return (
    <button onClick={onOpen} className="aspect-square overflow-hidden rounded-md bg-gray-100 dark:bg-white/[.05]" aria-label={`Open ${file.filename}`}>
      {url && <img src={url} alt={file.filename} className="h-full w-full object-cover transition-opacity duration-150 hover:opacity-90" />}
    </button>
  );
};
