import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell, SUBJECTS_CHANGED } from '../components/AppShell';
import { Subject } from '../types';
import { MOCK_SUBJECTS } from '../constants';
import { ComingUp } from '../components/ComingUp';
import { Card, Button, ProgressBar, Badge, cn, Input } from '../components/UIComponents';
import {
  Plus, Search, Users, Trash2, Calendar, BookOpen, Clock, Award,
  Flame, Moon, Sun, Settings, GraduationCap, ArrowRight, MessageSquare, Send, Bot,
  MoreVertical, Sparkles, Bolt, CheckCircle2, Target
} from 'lucide-react';
import { daysUntil, readSubjectList, studyStreak } from '../services/studyStore';
import { deleteAccountSubject, isAccountSubjectId, listAccountSubjects, saveSubjectToAccount, toSubject } from '../services/workspaceService';
import { ApiError } from '../services/apiClient';
import { realAccounts, signOut } from '../services/authService';
import { DashboardData, fetchDashboard } from '../services/dashboardService';
import { notify } from '../components/Feedback';

type SharedSubjectCard = Subject & { owned?: boolean; sharedIn?: string[] };

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Persist subjects
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem('prep_subjects');
    return saved ? JSON.parse(saved) : [];
  });

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);

  const userName = localStorage.getItem('userName') || 'Student';
  const userEmail = localStorage.getItem('userEmail') || '';
  const profilePic = localStorage.getItem('profilePic') || '';

  // Theme Toggle State



  useEffect(() => {
    localStorage.setItem('prep_subjects', JSON.stringify(subjects));
    window.dispatchEvent(new CustomEvent(SUBJECTS_CHANGED));
  }, [subjects]);

  // The sidebar's + opens the new-subject form here.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('new') === '1') { setShowAddModal(true); setParams({}, { replace: true }); }
  }, [params, setParams]);



  // Subjects on the account that aren't in this browser's list, e.g. shared with you by a group.
  const [accountSubjects, setAccountSubjects] = useState<SharedSubjectCard[]>([]);
  useEffect(() => {
    listAccountSubjects()
      .then(list => setAccountSubjects(list.map(toSubject)))
      .catch(() => setAccountSubjects([])); // no database yet: only browser subjects
  }, []);
  const extraSubjects = accountSubjects.filter(remote => !subjects.some(local => local.id === remote.id));
  const allSubjects: SharedSubjectCard[] = [...subjects, ...extraSubjects];
  const filtered = allSubjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  // Add Subject Form
  const [savingSubject, setSavingSubject] = useState(false);
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    const teacher = (form.elements.namedItem('teacher') as HTMLInputElement).value;
    const credits = Number((form.elements.namedItem('credits') as HTMLInputElement).value || 3);
    const colorChosen = (form.elements.namedItem('color') as HTMLSelectElement).value;

    const schedule_day = (form.elements.namedItem('schedule_day') as HTMLSelectElement).value;
    const schedule_time = (form.elements.namedItem('schedule_time') as HTMLInputElement).value;
    const schedule_room = (form.elements.namedItem('schedule_room') as HTMLInputElement).value;
    const examDate = (form.elements.namedItem('exam_date') as HTMLInputElement).value;

    const newSubject: Subject = {
      id: Date.now().toString(),
      name,
      teacher,
      attendance: 100,
      credits,
      progress: 0,
      color: colorChosen,
      examDate: examDate || undefined,
      nextClass: `${schedule_day.substring(0, 3)} ${schedule_time}`,
      schedule: [{
        day: schedule_day,
        time: schedule_time,
        room: schedule_room,
        type: 'Lecture'
      }]
    };
    // Saved to the account so it's on every device and can keep decks, quizzes and summaries.
    // Without a reachable database (local development) it stays in this browser.
    setSavingSubject(true);
    let added = newSubject;
    try {
      added = { ...newSubject, id: await saveSubjectToAccount(newSubject) };
    } catch {
      if (realAccounts) notify(`Couldn't save ${name} to your account, so it's only on this device for now.`, 'error');
    } finally {
      setSavingSubject(false);
    }
    setSubjects(current => [...current, added]);
    form.reset();
    setShowAddModal(false);
  };

  const deleteSubject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSubjectToDelete(id);
  };

  const confirmDeleteSubject = async () => {
    if (!subjectToDelete) return;
    const target = allSubjects.find(s => s.id === subjectToDelete);
    setSubjectToDelete(null);
    if (isAccountSubjectId(subjectToDelete) && target?.owned !== false) {
      try {
        await deleteAccountSubject(subjectToDelete);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) {
          notify(`Couldn't delete ${target?.name ?? 'the subject'}. Try again.`, 'error');
          return;
        }
      }
    }
    setSubjects(current => current.filter(s => s.id !== subjectToDelete));
    setAccountSubjects(current => current.filter(s => s.id !== subjectToDelete));
    window.dispatchEvent(new CustomEvent(SUBJECTS_CHANGED));
  };

  // Real numbers: subjects kept in this browser count here, account subjects on the server.
  const [server, setServer] = useState<DashboardData | null>(null);
  useEffect(() => { fetchDashboard().then(setServer).catch(() => setServer(null)); }, []);
  const streak = Math.max(studyStreak(), server?.streak_days ?? 0);
  const upcoming = allSubjects
    .map(sub => ({ sub, days: daysUntil(sub.examDate) }))
    .filter((item): item is { sub: SharedSubjectCard; days: number } => item.days !== null && item.days >= 0)
    .sort((a, b) => a.days - b.days);
  const nextPaper = upcoming[0];
  const masteredCards = allSubjects.reduce(
    (total, sub) => total + readSubjectList<{ mastered: boolean }>('cards', sub.id).filter(card => card.mastered).length, 0);
  const weakTopicCount = allSubjects.reduce((total, sub) => total + readSubjectList('weak', sub.id).length, 0) + (server?.weak_topics ?? 0);
  const lastQuiz = (subjectId: string) => readSubjectList<{ score: number; total: number }>('quizzes', subjectId)[0];

  const loadSampleSubjects = () => setSubjects(MOCK_SUBJECTS);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const searchBox = (className: string) => (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
      <input
        placeholder="Search subjects"
        aria-label="Search subjects"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-8 w-full rounded-md border border-gray-200 bg-transparent pl-8 pr-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary-500/60 dark:border-white/[.08] dark:text-gray-100"
      />
    </div>
  );

  const stats = [
    { icon: Flame, tone: 'text-orange-500', chip: 'bg-orange-500/10', go: undefined as undefined | (() => void), label: streak ? 'Study streak' : 'Study today to start a streak', value: `${streak} day${streak === 1 ? '' : 's'}` },
    { icon: Calendar, tone: 'text-blue-500', chip: 'bg-blue-500/10', go: nextPaper ? () => navigate(`/subject/${nextPaper.sub.id}`) : undefined, label: nextPaper ? `Until ${nextPaper.sub.name}` : 'Add exam dates to your subjects', value: nextPaper ? (nextPaper.days === 0 ? 'Today' : `${nextPaper.days} day${nextPaper.days === 1 ? '' : 's'}`) : '—' },
    { icon: Award, tone: 'text-emerald-500', chip: 'bg-emerald-500/10', go: allSubjects[0] ? () => navigate(`/subject/${allSubjects[0].id}?tab=flashcards`) : undefined, label: 'Flashcards mastered', value: `${masteredCards}` },
    { icon: Target, tone: 'text-violet-500', chip: 'bg-violet-500/10', go: allSubjects[0] && weakTopicCount > 0 ? () => navigate(`/subject/${allSubjects[0].id}?tab=weak-topics`) : undefined, label: 'Weak topics to review', value: `${weakTopicCount}` },
  ];

  return (
    <AppShell
      title="Dashboard"
      actions={
        <>
          {searchBox('hidden w-56 sm:block')}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex h-8 items-center gap-1.5 rounded-md bg-primary-600 px-3 text-[13px] font-medium text-white hover:bg-primary-500"
          >
            <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">New subject</span><span className="sm:hidden">New</span>
          </button>
        </>
      }
    >
      <main className="mx-auto w-full max-w-[1480px] px-4 py-7 pb-32 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">Welcome back, {userName}</h1>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">What are we studying today? Pick a subject and jump back in.</p>
          </div>
          {searchBox('w-full sm:hidden')}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat, i) => {
            const body = (
              <>
                <dt className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", stat.chip)}>
                    <stat.icon className={cn("h-3.5 w-3.5", stat.tone)} />
                  </span>
                  <span className="line-clamp-2 sm:truncate">{stat.label}</span>
                </dt>
                <dd className="mt-3 truncate text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{stat.value}</dd>
              </>
            );
            const cell = "min-w-0 rounded-xl border border-gray-200 p-4 text-left dark:border-white/[.07]";
            return stat.go ? (
              <button key={i} onClick={stat.go} className={cn(cell, "transition-colors hover:border-gray-300 hover:bg-gray-50 dark:hover:border-white/[.14] dark:hover:bg-white/[.03]")}>{body}</button>
            ) : (
              <div key={i} className={cell}>{body}</div>
            );
          })}
        </dl>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">
                Your subjects <span className="ml-1 text-[13px] font-normal text-gray-500">{filtered.length}</span>
              </h2>
              <button onClick={() => setShowAddModal(true)} className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>

            {allSubjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center dark:border-white/[.1]">
                <GraduationCap className="mx-auto mb-3 h-8 w-8 text-primary-500" />
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">Welcome to IntelliPrep</h3>
                <ol className="mx-auto mt-3 max-w-sm space-y-1.5 text-left text-[13px] text-gray-600 dark:text-gray-400">
                  <li>1. Add a subject, with its exam date.</li>
                  <li>2. Upload your lecture notes (PDF or text).</li>
                  <li>3. Make flashcards, a summary or a quiz from them.</li>
                </ol>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button size="sm" icon={Plus} onClick={() => setShowAddModal(true)}>Add your first subject</Button>
                  <Button size="sm" variant="secondary" onClick={loadSampleSubjects}>Try with sample subjects</Button>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <p className="rounded-xl border border-gray-200 px-4 py-10 text-center text-[13px] text-gray-500 dark:border-white/[.07]">
                No subjects match “{search}”.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {filtered.map(sub => {
                  const quiz = lastQuiz(sub.id);
                  const pct = quiz && quiz.total ? Math.round((quiz.score / quiz.total) * 100) : 0;
                  const days = daysUntil(sub.examDate);
                  const shared = Boolean(sub.sharedIn && !sub.owned);
                  const open = (tab?: string) => navigate(`/subject/${sub.id}${tab ? `?tab=${tab}` : ''}`);
                  return (
                    <article
                      key={sub.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => open()}
                      onKeyDown={e => { if (e.key === 'Enter') open(); }}
                      className="group relative flex cursor-pointer flex-col rounded-xl border border-gray-200 bg-white p-4 transition-[border-color,background-color,box-shadow] hover:border-gray-300 hover:shadow-lg dark:border-white/[.07] dark:bg-white/[.015] dark:hover:border-white/[.14] dark:hover:bg-white/[.035]"
                    >
                      <div className="flex items-start gap-3">
                        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white", sub.color || "bg-primary-500")}>
                          {sub.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[14px] font-semibold text-gray-900 dark:text-white">{sub.name}</h3>
                          <p className="truncate text-xs text-gray-500">{sub.teacher || 'No instructor added'}</p>
                        </div>
                        {shared ? (
                          <span className="shrink-0 rounded border border-indigo-500/30 px-1.5 py-0.5 text-[11px] text-indigo-600 dark:text-indigo-300" title={`Shared in ${sub.sharedIn!.join(', ')}`}>Shared</span>
                        ) : (
                          <button
                            onClick={e => deleteSubject(sub.id, e)}
                            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-red-500/10 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 dark:hover:text-red-400"
                            aria-label={`Delete ${sub.name}`}
                            title="Delete subject"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Last quiz</span>
                          <span className="font-medium tabular-nums text-gray-700 dark:text-gray-300">{quiz ? `${quiz.score} / ${quiz.total}` : 'Not taken yet'}</span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[.06]">
                          <div className="h-full rounded-full bg-primary-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className={cn(
                          "flex items-center gap-1 rounded-md border px-1.5 py-0.5",
                          days !== null && days >= 0 && days <= 14
                            ? "border-orange-500/30 text-orange-600 dark:text-orange-400"
                            : "border-gray-200 text-gray-500 dark:border-white/[.08]"
                        )}>
                          <Calendar className="h-3 w-3" />
                          {days !== null && days >= 0 ? (days === 0 ? 'Exam today' : `Exam in ${days}d`) : 'No exam date'}
                        </span>
                        <span className="rounded-md border border-gray-200 px-1.5 py-0.5 text-gray-500 dark:border-white/[.08]">{sub.credits || 3} credits</span>
                        {sub.nextClass && <span className="hidden rounded-md border border-gray-200 px-1.5 py-0.5 text-gray-500 dark:border-white/[.08] md:inline">{sub.nextClass}</span>}
                      </div>

                      <div className="mt-4 flex items-center gap-1 border-t border-gray-100 pt-3 dark:border-white/[.06]">
                        {[
                          { tab: 'upload', label: 'Notes', icon: BookOpen },
                          { tab: 'flashcards', label: 'Flashcards', icon: Award },
                          { tab: 'quiz', label: 'Quiz', icon: CheckCircle2 },
                        ].map(action => (
                          <button
                            key={action.tab}
                            onClick={e => { e.stopPropagation(); open(action.tab); }}
                            className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white"
                          >
                            <action.icon className="h-3.5 w-3.5" /> {action.label}
                          </button>
                        ))}
                        <span className="ml-auto flex items-center gap-1 text-xs font-medium text-gray-400 transition-colors group-hover:text-primary-500">
                          Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </article>
                  );
                })}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 text-[13px] text-gray-500 transition-colors hover:border-primary-500/60 hover:bg-primary-500/[.04] hover:text-primary-600 dark:border-white/[.1] dark:hover:text-primary-400"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-current/20">
                    <Plus className="h-4 w-4" />
                  </span>
                  Add a subject
                </button>
              </div>
            )}
          </section>

          <aside className="min-w-0">
            <ComingUp />
          </aside>
        </div>
      </main>

      {/* Add Subject Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md animate-in zoom-in-95 duration-200 bg-white dark:bg-slate-950 shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary-500" /> New subject
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <form onSubmit={handleAddSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-450 mb-1">Course Title</label>
                <Input name="name" required placeholder="e.g. Advanced Calculus II" className="text-xs h-10" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-450 mb-1">Instructor / Prof</label>
                  <Input name="teacher" required placeholder="e.g. Dr. Newton" className="text-xs h-10" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-450 mb-1">Academic Credits</label>
                  <Input name="credits" type="number" defaultValue="3" min="1" max="6" className="text-xs h-10" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-450 mb-1">Exam date (optional)</label>
                <Input name="exam_date" type="date" className="text-xs h-10" />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-450 mb-1">Visual Color Accent</label>
                <select name="color" className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none">
                  <option value="bg-teal-500">Ocean Teal Accent</option>
                  <option value="bg-pink-600">Berry Pink Accent</option>
                  <option value="bg-cyan-500">Cyan Prestige Accent</option>
                  <option value="bg-emerald-600">Emerald Green Accent</option>
                  <option value="bg-rose-500">Coral Red Accent</option>
                </select>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-bold uppercase text-slate-450 mb-2">Class Timetable</label>
                <div className="grid grid-cols-3 gap-2">
                  <select name="schedule_day" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none">
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                  </select>
                  <Input name="schedule_time" placeholder="10:00 AM" defaultValue="10:00 AM" className="text-xs h-10" />
                  <Input name="schedule_room" placeholder="Room 301" defaultValue="Room 301" className="text-xs h-10" />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)} className="text-xs font-bold">Cancel</Button>
                <Button type="submit" disabled={savingSubject} className="bg-primary-600 text-white hover:bg-primary-700 text-xs font-bold">{savingSubject ? 'Saving…' : 'Add subject'}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {subjectToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm animate-in zoom-in-95 duration-200 bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-center p-2">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">Delete this subject?</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                Its notes, flashcards and quizzes go with it. This can't be undone.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="ghost" onClick={() => setSubjectToDelete(null)} className="flex-1 text-xs font-bold border-slate-200 dark:border-slate-800">
                  Cancel
                </Button>
                <Button onClick={confirmDeleteSubject} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/10">
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

    </AppShell>
  );
};
