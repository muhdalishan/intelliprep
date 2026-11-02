import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Subject } from '../types';
import { MOCK_SUBJECTS } from '../constants';
import { Card, Button, ProgressBar, Badge, cn, Input } from '../components/UIComponents';
import {
  Plus, Search, Users, Trash2, Calendar, BookOpen, Clock, Award,
  Flame, Moon, Sun, Settings, GraduationCap, ArrowRight, MessageSquare, Send, Bot,
  MoreVertical, Sparkles, Bolt, CheckCircle2, Target
} from 'lucide-react';
import { DevStudentSwitcher } from '../components/DevStudentSwitcher';
import { daysUntil, readSubjectList, studyStreak } from '../services/studyStore';
import { listAccountSubjects, toSubject } from '../services/workspaceService';

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
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');


  useEffect(() => {
    localStorage.setItem('prep_subjects', JSON.stringify(subjects));
  }, [subjects]);

  // Handle dark theme assignment
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);


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
  const handleAddSubject = (e: React.FormEvent) => {
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
    setSubjects([...subjects, newSubject]);
    form.reset();
    setShowAddModal(false);
  };

  const deleteSubject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSubjectToDelete(id);
  };

  const confirmDeleteSubject = () => {
    if (subjectToDelete) {
      setSubjects(subjects.filter(s => s.id !== subjectToDelete));
      setSubjectToDelete(null);
    }
  };

  // Real numbers from what the student has done in this browser.
  const streak = studyStreak();
  const upcoming = allSubjects
    .map(sub => ({ sub, days: daysUntil(sub.examDate) }))
    .filter((item): item is { sub: SharedSubjectCard; days: number } => item.days !== null && item.days >= 0)
    .sort((a, b) => a.days - b.days);
  const nextPaper = upcoming[0];
  const masteredCards = allSubjects.reduce(
    (total, sub) => total + readSubjectList<{ mastered: boolean }>('cards', sub.id).filter(card => card.mastered).length, 0);
  const weakTopicCount = allSubjects.reduce((total, sub) => total + readSubjectList('weak', sub.id).length, 0);
  const lastQuiz = (subjectId: string) => readSubjectList<{ score: number; total: number }>('quizzes', subjectId)[0];

  const loadSampleSubjects = () => setSubjects(MOCK_SUBJECTS);

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#fafbff] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-all duration-300 relative overflow-x-hidden selection:bg-primary-200/50">

      {/* Premium Background Ambient Glow Elements */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary-100/30 dark:bg-primary-950/10 blur-[130px] pointer-events-none" />
      <div className="absolute top-[30%] -right-40 w-[600px] h-[600px] rounded-full bg-teal-100/30 dark:bg-teal-950/10 blur-[150px] pointer-events-none" />
      <div className="absolute -bottom-20 left-1/3 w-96 h-96 rounded-full bg-cyan-400/5 dark:bg-cyan-500/5 blur-[120px] pointer-events-none" />

      {/* SaaS Style Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/60 dark:border-slate-900/60 shadow-sm backdrop-blur-md transition-all">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25 shrink-0 transition-transform hover:scale-105 duration-300">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div className="hidden min-[400px]:block text-left">
              <span className="font-bold text-lg sm:text-[1.35rem] text-slate-900 dark:text-white leading-none whitespace-nowrap block tracking-tight">IntelliPrep AI</span>
              <span className="hidden sm:block text-[11px] text-slate-500 font-medium tracking-wide">Integrated Academic Workspace</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900"
              onClick={() => setIsDark(!isDark)}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-500" />}
            </Button>

            <Button variant="secondary" size="sm" onClick={() => navigate('/groups')} className="flex items-center gap-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-full px-3 sm:px-4 py-2" aria-label="Study groups">
              <Users className="w-4 h-4 text-slate-400" /> <span className="hidden sm:inline">Groups</span>
            </Button>

            <Button
              variant="secondary"
              aria-label="Settings"
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-full px-3 sm:px-4 py-2"
              size="sm"
            >
              <Settings className="w-4 h-4 text-slate-400" /> <span className="hidden sm:inline">Settings</span>
            </Button>


            <DevStudentSwitcher className="hidden lg:inline-flex" />

            <div className="flex items-center gap-1 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-200/80 dark:border-slate-800">
              <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0 overflow-hidden hover:scale-105 transition-transform">
                {profilePic ? (
                  <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  userName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="hidden lg:block text-left truncate max-w-[120px]">
                <p className="text-[13px] font-extrabold leading-tight truncate text-slate-900 dark:text-white uppercase">{userName}</p>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide truncate">{userEmail || 'Student'}</p>
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 p-1.5 transition-colors shrink-0" title="Sign out" aria-label="Sign out">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Console Content */}
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-32 flex-1 flex flex-col gap-8 relative z-10">

        {/* Welcome Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between p-6 sm:p-8 gap-6">
          <div className="text-left">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
              Welcome back, {userName}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">
              What are we studying today? Pick a subject and jump back in.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search subjects"
                className="pl-10 h-11 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-primary-500/30 text-xs"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button
              icon={Plus}
              onClick={() => setShowAddModal(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold h-11 px-5 shadow-md shadow-primary-500/20 rounded-xl whitespace-nowrap active:scale-95 transition-all text-xs w-full sm:w-auto shrink-0"
            >
              Add Subject
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col items-start text-left relative overflow-hidden">
            <Flame className="w-5 h-5 text-orange-500 mb-4" />
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1">{streak} day{streak === 1 ? '' : 's'}</h3>
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{streak ? 'Study streak' : 'Study today to start a streak'}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col items-start text-left relative overflow-hidden">
            <Calendar className="w-5 h-5 text-blue-500 mb-4" />
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1 truncate max-w-full">{nextPaper ? (nextPaper.days === 0 ? 'Today' : `${nextPaper.days} day${nextPaper.days === 1 ? '' : 's'}`) : '—'}</h3>
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider line-clamp-2 max-w-full">{nextPaper ? `Until ${nextPaper.sub.name}` : 'Add exam dates to your subjects'}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col items-start text-left relative overflow-hidden">
            <Award className="w-5 h-5 text-emerald-500 mb-4" />
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1">{masteredCards} card{masteredCards === 1 ? '' : 's'}</h3>
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Flashcards mastered</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col items-start text-left relative overflow-hidden">
            <Target className="w-5 h-5 text-purple-500 mb-4" />
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1">{weakTopicCount}</h3>
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Weak topics to review</p>
          </div>
        </div>

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary-600" />
            Your subjects ({filtered.length})
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">
            Tap a subject to jump in
          </span>
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allSubjects.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-primary-300 bg-white p-8 text-center dark:border-primary-800 dark:bg-slate-900">
              <GraduationCap className="mx-auto mb-3 h-10 w-10 text-primary-500" />
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Welcome to IntelliPrep</h3>
              <ol className="mx-auto mt-4 max-w-sm space-y-2 text-left text-sm text-slate-600 dark:text-slate-300">
                <li><strong>1.</strong> Add a subject, with its exam date.</li>
                <li><strong>2.</strong> Upload your lecture notes (PDF or text).</li>
                <li><strong>3.</strong> Make flashcards, a summary or a quiz from them.</li>
              </ol>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button icon={Plus} onClick={() => setShowAddModal(true)}>Add your first subject</Button>
                <Button variant="secondary" onClick={loadSampleSubjects}>Try with sample subjects</Button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <GraduationCap className="w-12 h-12 text-slate-300 mx-auto" />
              <h5 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No subjects here yet</h5>
              <p className="text-xs text-slate-400">Try another search, or add your first subject.</p>
            </div>
          ) : (
            filtered.map((sub, idx) => (
              <div
                key={sub.id}
                onClick={() => navigate(`/subject/${sub.id}`)}
                className="lift group cursor-pointer bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all text-left relative overflow-hidden flex flex-col justify-between min-h-[190px]"
              >
                {/* Accent border strip */}
                <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", sub.color || "bg-primary-500")} />

                <div className="pl-1">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Workspace</span>
                    {sub.sharedIn && !sub.owned ? (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                        Shared · {sub.sharedIn.join(', ')}
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSubject(sub.id, e);
                        }}
                        className="text-slate-300 hover:text-red-500 transition-colors z-10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <h3 className="font-bold text-[17px] text-slate-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-tight mb-1">{sub.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-6 font-medium">
                    <Users className="w-3.5 h-3.5" />
                    <span className="truncate">{sub.teacher || 'No instructor added'}</span>
                  </div>

                  {(() => {
                    const quiz = lastQuiz(sub.id);
                    return (
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center text-[11px] font-bold">
                          <span className="text-slate-500">Last quiz</span>
                          <span className="text-slate-700 dark:text-slate-300">{quiz ? `${quiz.score} / ${quiz.total}` : 'Not taken yet'}</span>
                        </div>
                        <ProgressBar value={quiz && quiz.total ? Math.round((quiz.score / quiz.total) * 100) : 0} className="h-2 rounded-xl" />
                      </div>
                    );
                  })()}
                </div>

                <div className="mt-6 flex justify-between items-center pl-1 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <div className="bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[10px] font-extrabold px-3 py-1 rounded-full border border-primary-100 dark:border-primary-800/50">
                    {sub.credits || 3} Credits
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-medium text-slate-500">
                      {(() => {
                        const days = daysUntil(sub.examDate);
                        if (days !== null && days >= 0) return days === 0 ? 'Exam today' : `Exam in ${days} day${days === 1 ? '' : 's'}`;
                        return sub.nextClass ? `Class: ${sub.nextClass}` : 'No exam date yet';
                      })()}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-primary-600 dark:text-primary-400 group-hover:text-primary-700">
                      Open <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
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
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
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
                <Button type="submit" className="bg-primary-600 text-white hover:bg-primary-700 text-xs font-bold">Add subject</Button>
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

    </div>
  );
};
