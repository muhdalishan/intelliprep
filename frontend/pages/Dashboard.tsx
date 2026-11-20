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

  // What to do now, from real numbers only (product principle: tell the student what to study next).
  const dueCards = server?.cards_due_today ?? 0;
  const nextReminder = server?.upcoming_reminders?.[0];
  const firstAccount = allSubjects.find(s => isAccountSubjectId(s.id)) ?? allSubjects[0];
  const today: { key: string; title: string; detail: string; action: string; go: () => void; now?: boolean }[] = [];
  if (nextPaper && nextPaper.days <= 14) today.push({
    key: 'exam', now: true,
    title: nextPaper.days === 0 ? `${nextPaper.sub.name} paper is today` : `${nextPaper.sub.name} paper in ${nextPaper.days} day${nextPaper.days === 1 ? '' : 's'}`,
    detail: 'A timed practice exam is the closest thing to the real one',
    action: 'Practice exam', go: () => navigate(`/subject/${nextPaper.sub.id}?tab=exam`),
  });
  if (dueCards > 0 && firstAccount) today.push({
    key: 'cards', title: `${dueCards} flashcard${dueCards === 1 ? '' : 's'} due today`,
    detail: 'Review them before they slip, it takes a few minutes',
    action: 'Review', go: () => navigate(`/subject/${firstAccount.id}?tab=flashcards`),
  });
  if (weakTopicCount > 0 && firstAccount) today.push({
    key: 'weak', title: `${weakTopicCount} weak topic${weakTopicCount === 1 ? '' : 's'} to go over`,
    detail: 'From questions you got wrong or flagged',
    action: 'Go over', go: () => navigate(`/subject/${firstAccount.id}?tab=weak-topics`),
  });
  if (nextReminder) today.push({
    key: 'reminder', title: nextReminder.message,
    detail: `Reminder · ${new Date(nextReminder.due_at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}${nextReminder.subject_name ? ` · ${nextReminder.subject_name}` : ''}`,
    action: 'Open plan', go: () => firstAccount ? navigate(`/subject/${firstAccount.id}?tab=reminders`) : navigate('/dashboard'),
  });
  if (today.length === 0 && allSubjects.length > 0) today.push({
    key: 'start', title: 'Make a quiz from your notes',
    detail: 'The fastest way to find out what you already know',
    action: 'Start', go: () => navigate(`/subject/${allSubjects[0].id}?tab=quiz`),
  });

  const papers = upcoming.slice(0, 5);
  const horizon = Math.max(30, ...papers.map(p => p.days));
  const quizzesTaken = (server?.recent_quiz_scores?.length ?? 0) + allSubjects.filter(s => lastQuiz(s.id)).length;
  const figures = [
    { label: 'Study streak', value: `${streak}`, unit: streak === 1 ? 'day' : 'days' },
    { label: 'Cards due today', value: `${dueCards}`, unit: '' },
    { label: 'Cards mastered', value: `${masteredCards}`, unit: '' },
    { label: 'Weak topics', value: `${weakTopicCount}`, unit: '' },
    { label: 'Quizzes taken', value: `${quizzesTaken}`, unit: '' },
  ];
  const dateTitle = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <AppShell
      title="Dashboard"
      actions={
        <>
          {searchBox('hidden w-56 sm:block')}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-primary-600 px-3 text-[13px] font-medium text-white transition-colors hover:bg-primary-500"
          >
            <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">New subject</span><span className="sm:hidden">New</span>
          </button>
        </>
      }
    >
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-32 pt-8 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-medium leading-tight tracking-[-0.02em] text-gray-900 dark:text-white">{dateTitle}</h1>
            <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400">
              {allSubjects.length === 0 ? 'Add a subject to get started'
                : `${allSubjects.length} subject${allSubjects.length === 1 ? '' : 's'}${nextPaper ? ` · next paper in ${nextPaper.days === 0 ? 'less than a day' : `${nextPaper.days} day${nextPaper.days === 1 ? '' : 's'}`}` : ''}`}
            </p>
          </div>
          {searchBox('w-full sm:hidden')}
        </header>

        {allSubjects.length > 0 && (
          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            {/* Today: the next few things worth doing, each one click away */}
            <section className="rounded-2xl border border-gray-200 bg-white dark:border-white/[.07] dark:bg-white/[.015]" aria-labelledby="today-title">
              <div className="flex items-center justify-between px-5 pb-2 pt-5">
                <h2 id="today-title" className="text-[15px] font-medium text-gray-900 dark:text-white">Today</h2>
                <span className="font-mono text-xs tabular-nums text-gray-500">{today.length} to do</span>
              </div>
              <ul className="px-2 pb-2">
                {today.map(item => (
                  <li key={item.key}>
                    <button onClick={item.go} className="group flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[.03]">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", item.now ? "bg-primary-500" : "bg-gray-300 dark:bg-white/20")} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-gray-900 dark:text-gray-100">{item.title}</span>
                        <span className="block truncate text-[13px] text-gray-500">{item.detail}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors group-hover:border-gray-300 group-hover:bg-white dark:border-white/[.09] dark:text-gray-300 dark:group-hover:bg-white/[.05]">
                        {item.action} <ArrowRight className="h-3 w-3" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {/* The moment: papers counting down to today */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/[.07] dark:bg-white/[.015]" aria-labelledby="papers-title">
              <div className="flex items-center justify-between">
                <h2 id="papers-title" className="text-[15px] font-medium text-gray-900 dark:text-white">Papers ahead</h2>
                <span className="font-mono text-xs text-gray-500">next {horizon} days</span>
              </div>
              {papers.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center dark:border-white/[.1]">
                  <Calendar className="mx-auto h-5 w-5 text-gray-400" />
                  <p className="mt-2 text-[13px] text-gray-600 dark:text-gray-400">Add exam dates to your subjects to see the countdown</p>
                </div>
              ) : (
                <ol className="mt-5 space-y-4">
                  {papers.map(({ sub, days }, i) => {
                    const left = Math.max(2, 100 - (days / horizon) * 100);
                    return (
                      <li key={sub.id}>
                        <button onClick={() => navigate(`/subject/${sub.id}`)} className="block w-full text-left">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{sub.name}</span>
                            <span className={cn("shrink-0 font-mono text-xs tabular-nums", i === 0 ? "text-primary-600 dark:text-primary-400" : "text-gray-500")}>
                              {days === 0 ? 'today' : `${days}d`}
                            </span>
                          </div>
                          <div className="relative mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-white/[.06]">
                            <div className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-500", i === 0 ? "bg-primary-500" : "bg-gray-300 dark:bg-white/25")} style={{ width: `${left}%` }} />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>
        )}

        {/* Quiet figures */}
        {allSubjects.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 divide-gray-200 rounded-2xl border border-gray-200 dark:divide-white/[.07] dark:border-white/[.07] sm:grid-cols-5 sm:divide-x">
            {figures.map(f => (
              <div key={f.label} className="px-5 py-4">
                <dt className="text-xs text-gray-500">{f.label}</dt>
                <dd className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-[24px] font-medium leading-none tabular-nums text-gray-900 dark:text-white">{f.value}</span>
                  {f.unit && <span className="text-xs text-gray-500">{f.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {/* Subjects */}
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-medium text-gray-900 dark:text-white">Subjects <span className="ml-1 font-mono text-xs font-normal text-gray-500">{filtered.length}</span></h2>
            <button onClick={() => setShowAddModal(true)} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white">
              <Plus className="h-3.5 w-3.5" /> Add subject
            </button>
          </div>

          {allSubjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-14 text-center dark:border-white/[.1]">
              <GraduationCap className="mx-auto h-7 w-7 text-gray-400" />
              <h3 className="mt-3 text-[15px] font-medium text-gray-900 dark:text-white">Start with one subject</h3>
              <ol className="mx-auto mt-3 max-w-sm space-y-1.5 text-left text-[13px] text-gray-600 dark:text-gray-400">
                <li>1. Add a subject, with its exam date</li>
                <li>2. Upload your lecture notes (PDF or text)</li>
                <li>3. Make flashcards, a summary or a quiz from them</li>
              </ol>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button size="sm" icon={Plus} onClick={() => setShowAddModal(true)}>Add your first subject</Button>
                <Button size="sm" variant="secondary" onClick={loadSampleSubjects}>Try sample subjects</Button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-2xl border border-gray-200 px-4 py-10 text-center text-[13px] text-gray-500 dark:border-white/[.07]">No subjects match “{search}”</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                    className="group flex cursor-pointer flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300 dark:border-white/[.07] dark:bg-white/[.015] dark:hover:border-white/[.14] dark:hover:bg-white/[.03]"
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", sub.color || "bg-primary-500")} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[15px] font-medium text-gray-900 dark:text-white">{sub.name}</h3>
                        <p className="truncate text-[13px] text-gray-500">{shared ? `Shared · ${sub.sharedIn!.join(', ')}` : (sub.teacher || 'No instructor added')}</p>
                      </div>
                      {!shared && (
                        <button
                          onClick={e => deleteSubject(sub.id, e)}
                          className="-mr-1.5 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 dark:hover:text-red-400"
                          aria-label={`Delete ${sub.name}`}
                          title="Delete subject"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Last quiz</p>
                        <p className="mt-0.5 text-[20px] font-medium leading-none tabular-nums text-gray-900 dark:text-white">{quiz ? `${quiz.score}/${quiz.total}` : '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Paper</p>
                        <p className={cn("mt-0.5 font-mono text-[13px] tabular-nums", days !== null && days >= 0 && days <= 14 ? "text-primary-600 dark:text-primary-400" : "text-gray-700 dark:text-gray-300")}>
                          {days !== null && days >= 0 ? (days === 0 ? 'today' : `in ${days}d`) : 'no date'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[.06]">
                      <div className="h-full rounded-full bg-gray-400 dark:bg-white/40" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="-mx-2 mt-4 flex items-center gap-0.5 border-t border-gray-100 pt-3 dark:border-white/[.06]">
                      {[
                        { tab: 'upload', label: 'Notes' },
                        { tab: 'flashcards', label: 'Flashcards' },
                        { tab: 'quiz', label: 'Quiz' },
                      ].map(action => (
                        <button
                          key={action.tab}
                          onClick={e => { e.stopPropagation(); open(action.tab); }}
                          className="h-7 rounded-md px-2 text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.06] dark:hover:text-white"
                        >
                          {action.label}
                        </button>
                      ))}
                      <ArrowRight className="ml-auto mr-2 h-3.5 w-3.5 text-gray-400 transition-colors group-hover:text-gray-900 dark:group-hover:text-white" />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Planner, predictions and notes from the server */}
        <section className="mt-10">
          <ComingUp />
        </section>
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
