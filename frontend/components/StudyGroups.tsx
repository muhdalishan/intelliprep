import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, LogIn, Copy, Check, Crown, X, Send, BookOpen, Share2, LogOut, Database, RefreshCw } from 'lucide-react';
import { Button, Card, Input, cn } from './UIComponents';
import { ApiError } from '../services/apiClient';
import * as groups from '../services/groupService';
import type { GroupDetail, GroupMessage, GroupSummary } from '../services/groupService';
import { saveSubjectToAccount } from '../services/workspaceService';
import { DevStudentSwitcher } from './DevStudentSwitcher';
import { Subject } from '../types';
import { confirmAction } from './Feedback';

interface Props {
  /** The subject the student is in; the Groups page passes none. */
  subject?: Subject;
}

const initials = (name: string) => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || '?';

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Study groups: create or join with a code, share subjects, chat. Data and access rules live on the server. */
export const StudyGroups: React.FC<Props> = ({ subject }) => {
  const navigate = useNavigate();
  const subjectId = subject?.id ?? '';
  const subjectName = subject?.name ?? 'a subject';
  const [list, setList] = useState<GroupSummary[] | null>(null);
  const [selected, setSelected] = useState<GroupDetail | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState(subject ? `${subject.name} study group` : '');
  const [code, setCode] = useState('');
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  const fail = (e: unknown) => {
    if (e instanceof ApiError && (e.code === 'database_unavailable' || e.code === 'offline')) {
      setUnavailable(e.message);
    } else {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const run = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch (e) {
      fail(e);
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const refreshList = useCallback(async () => {
    try {
      setList(await groups.listGroups());
      setUnavailable(null);
    } catch (e) {
      fail(e);
    }
  }, []);

  useEffect(() => { refreshList(); }, [refreshList]);

  const open = async (id: string) => {
    const detail = await run(() => groups.getGroup(id));
    if (detail) {
      setSelected(detail);
      setMessages(await groups.listMessages(id).catch(() => []));
    }
  };

  // New chat messages every few seconds while a group is open (live updates come with Supabase Realtime).
  useEffect(() => {
    if (!selected) return;
    const timer = window.setInterval(async () => {
      const lastId = messages.at(-1)?.id ?? 0;
      const fresh = await groups.listMessages(selected.id, lastId).catch(() => []);
      if (fresh.length) setMessages(current => [...current, ...fresh]);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [selected, messages]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const afterChange = (detail: GroupDetail | undefined) => {
    if (detail) {
      setSelected(detail);
      refreshList();
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !draft.trim()) return;
    const message = await run(() => groups.postMessage(selected.id, draft.trim()));
    if (message) {
      setMessages(current => [...current, message]);
      setDraft('');
    }
  };

  const copyCode = (inviteCode: string) => {
    navigator.clipboard?.writeText(inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  if (unavailable) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card className="space-y-4 border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30">
            <Database className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Study groups go live with accounts</h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            Groups let classmates join with an invite code, share one or many subjects, plan and chat together.
            They need real accounts and a shared database. Connect the Supabase project, or for testing on this
            computer set DATABASE_URL=local in backend/.env and restart the backend.
          </p>
          <p className="text-xs text-gray-400">{unavailable}</p>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => { setUnavailable(null); refreshList(); }}>
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  const canShareHere = groups.isAccountSubjectId(subjectId);
  const alreadyShared = selected?.subjects.some(s => s.id === subjectId);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-6 overflow-y-auto p-6 md:p-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:overflow-hidden">
      {/* Groups list, create and join */}
      <div className="space-y-5 lg:overflow-y-auto">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-gray-900 dark:text-white">
            <Users className="h-5 w-5 text-emerald-500" /> Study groups
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Study one or many subjects together with classmates.</p>
          <DevStudentSwitcher className="mt-3" />
        </div>

        {error && (
          <div className="flex items-start justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
            <button onClick={() => setError(null)} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        <div className="space-y-2">
          {list === null && <p className="text-xs text-gray-400">Loading your groups…</p>}
          {list?.length === 0 && <p className="text-xs text-gray-400">You're not in any group yet.</p>}
          {list?.map(group => (
            <button
              key={group.id}
              onClick={() => open(group.id)}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-all",
                selected?.id === group.id
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                  : "border-gray-200 bg-white hover:border-emerald-300 dark:border-gray-700 dark:bg-gray-800"
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-bold text-gray-800 dark:text-gray-100">
                {group.name}
                {group.role === 'lead' && <Crown className="h-3.5 w-3.5 text-amber-500" />}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {group.member_count} member{group.member_count === 1 ? '' : 's'} · {group.subject_count} subject{group.subject_count === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </div>

        <Card className="space-y-2.5 border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Start a group</h3>
          <Input value={newName} onChange={e => setNewName(e.target.value)} maxLength={80} className="text-xs" />
          <Button size="sm" icon={Plus} className="w-full" disabled={busy || !newName.trim()}
            onClick={async () => { const detail = await run(() => groups.createGroup(newName.trim())); afterChange(detail); if (detail) setMessages([]); }}>
            Create group
          </Button>
        </Card>

        <Card className="space-y-2.5 border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Join with a code</h3>
          <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. 7F3A9C21" maxLength={16} className="font-mono text-xs tracking-widest" />
          <Button size="sm" variant="secondary" icon={LogIn} className="w-full" disabled={busy || code.trim().length < 4}
            onClick={async () => { const detail = await run(() => groups.joinGroup(code.trim())); if (detail) { setCode(''); afterChange(detail); setMessages(await groups.listMessages(detail.id).catch(() => [])); } }}>
            Join group
          </Button>
        </Card>
      </div>

      {/* Selected group */}
      {!selected ? (
        <Card className="flex min-h-[320px] flex-col items-center justify-center border border-dashed border-gray-300 bg-white text-center dark:border-gray-700 dark:bg-gray-800">
          <Users className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-bold text-gray-700 dark:text-gray-200">Pick a group, start one, or join with a code</p>
          <p className="mt-1 max-w-sm text-xs text-gray-400">{subject ? `Share ${subject.name} into a group` : 'Open a subject and share it into a group'} so everyone can see its documents and edit its planner and board together.</p>
        </Card>
      ) : (
        <div className="grid min-h-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-5 xl:overflow-y-auto">
            <Card className="space-y-4 border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white">{selected.name}</h3>
                  <p className="text-xs text-gray-500">You're {selected.role === 'lead' ? 'the lead' : 'a member'}</p>
                </div>
                <Button variant="ghost" size="sm" icon={LogOut} className="text-xs text-red-600"
                  onClick={async () => {
                    const ok = await confirmAction({ title: `Leave ${selected.name}?`, message: "You'll lose access to its shared subjects and chat.", confirmLabel: 'Leave group', danger: true });
                    if (!ok) return;
                    await run(() => groups.leaveGroup(selected.id));
                    setSelected(null);
                    refreshList();
                  }}>
                  Leave
                </Button>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/20">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Invite code</p>
                  <p className="font-mono text-lg font-black tracking-[0.25em] text-gray-900 dark:text-white">{selected.invite_code}</p>
                </div>
                <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={() => copyCode(selected.invite_code)}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </Card>

            <Card className="space-y-3 border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500"><BookOpen className="h-4 w-4" /> Shared subjects</h4>
                {subject && !alreadyShared && (
                  <Button size="sm" icon={Share2} disabled={busy}
                    onClick={async () => {
                      if (canShareHere) {
                        afterChange(await run(() => groups.shareSubject(selected.id, subjectId)));
                        return;
                      }
                      // Subjects that live only in this browser are saved to the account first.
                      const accountId = await run(() => saveSubjectToAccount(subject!));
                      if (!accountId) return;
                      const detail = await run(() => groups.shareSubject(selected.id, accountId));
                      if (detail) navigate(`/subject/${accountId}?tab=studyroom`, { replace: true });
                    }}>
                    Share {subjectName}
                  </Button>
                )}
              </div>
              {subject && !canShareHere && !alreadyShared && (
                <p className="text-[11px] text-gray-400">Sharing saves {subjectName} to your account first, with its planner and moodboard.</p>
              )}
              {selected.subjects.length === 0 ? (
                <p className="text-xs text-gray-400">No subjects shared yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {selected.subjects.map(subject => (
                    <li key={subject.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{subject.name}</p>
                        <p className="text-[11px] text-gray-500">Shared by {subject.shared_by_name}{subject.exam_date ? ` · paper ${new Date(subject.exam_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</p>
                      </div>
                      <button className="text-[11px] font-semibold text-gray-400 hover:text-red-500"
                        onClick={async () => afterChange(await run(() => groups.unshareSubject(selected.id, subject.id)))}>
                        Unshare
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="space-y-3 border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500"><Users className="h-4 w-4" /> Members ({selected.members.length})</h4>
              <ul className="space-y-2">
                {selected.members.map(member => (
                  <li key={member.user_id} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {initials(member.full_name)}
                    </span>
                    <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100">{member.full_name || 'Student'}</span>
                    {member.role === 'lead'
                      ? <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600"><Crown className="h-3.5 w-3.5" /> Lead</span>
                      : selected.role === 'lead' && (
                        <button className="text-[11px] font-semibold text-gray-400 hover:text-red-500"
                          onClick={async () => { if (await confirmAction({ title: `Remove ${member.full_name}?`, message: 'They lose access to the shared subjects and chat. They can rejoin with the invite code.', confirmLabel: 'Remove', danger: true })) afterChange(await run(() => groups.removeMember(selected.id, member.user_id))); }}>
                          Remove
                        </button>
                      )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Chat */}
          <Card className="flex min-h-[420px] flex-col border border-gray-200 bg-white p-0 dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-700">
              <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">Group chat</h4>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {messages.length === 0 && <p className="pt-8 text-center text-xs text-gray-400">No messages yet. Say hi to your group.</p>}
              {messages.map(message => (
                <div key={message.id} className="flex gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                    {initials(message.author)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-500"><span className="font-bold text-gray-800 dark:text-gray-100">{message.author}</span> · {timeLabel(message.created_at)}</p>
                    <p className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-200">{message.body}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEnd} />
            </div>
            <form onSubmit={sendMessage} className="flex gap-2 border-t border-gray-100 p-3 dark:border-gray-700">
              <Input value={draft} onChange={e => setDraft(e.target.value)} placeholder={`Message ${selected.name}…`} maxLength={2000} className="text-sm" />
              <Button type="submit" size="icon" disabled={busy || !draft.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
