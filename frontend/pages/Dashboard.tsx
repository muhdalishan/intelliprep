import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Subject } from '../types';
import { MOCK_SUBJECTS } from '../constants';
import { Card, Button, ProgressBar, Badge, cn, Input } from '../components/UIComponents';
import { 
  Plus, Search, Users, Trash2, Calendar, BookOpen, Clock, Award, 
  Flame, Moon, Sun, Settings, GraduationCap, ArrowRight, MessageSquare, Send, Bot,
  MoreVertical, Sparkles, Bolt, CheckCircle2
} from 'lucide-react';
import { chatWithAssistant, ChatMessage } from '../services/aiService';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // Persist subjects
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem('prep_subjects');
    return saved ? JSON.parse(saved) : MOCK_SUBJECTS;
  });

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  
  const [userName, setUserName] = useState(() => localStorage.getItem('userName') || 'Scholar');
  const [profilePic, setProfilePic] = useState(() => localStorage.getItem('profilePic') || '');
  const [editName, setEditName] = useState(userName);
  const [editPassword, setEditPassword] = useState('password123'); // purely decorative as per instructions
  
  // Theme Toggle State
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');

  // Goal Profile States (Keeping for modal)
  const [targetHours, setTargetHours] = useState('20');
  const [targetGrade, setTargetGrade] = useState('Grade A');
  const [telegramAlerts, setTelegramAlerts] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);

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

  const handleSaveProfile = () => {
    localStorage.setItem('userName', editName);
    localStorage.setItem('profilePic', profilePic);
    setUserName(editName);
    setShowProfileModal(false);
  };

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const filtered = subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

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

    const newSubject: Subject = {
      id: Date.now().toString(),
      name,
      teacher,
      attendance: 100,
      credits,
      progress: 10,
      color: colorChosen,
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

  const calculateAvgProgress = () => {
    if (subjects.length === 0) return 0;
    const totals = subjects.reduce((acc, sub) => acc + sub.progress, 0);
    return Math.round(totals / subjects.length);
  };

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
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25 shrink-0 transition-transform hover:scale-105 duration-300">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <span className="font-bold text-[1.35rem] text-slate-900 dark:text-white leading-none whitespace-nowrap block tracking-tight">IntelliPrep AI</span>
              <span className="hidden sm:block text-[11px] text-slate-500 font-medium tracking-wide">Integrated Academic Workspace</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900"
              onClick={() => setIsDark(!isDark)}
            >
              {isDark ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-500" />}
            </Button>
            
            <Button 
              variant="secondary" 
              onClick={() => setShowProfileModal(true)} 
              className="hidden md:flex items-center gap-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-full px-4 py-2"
              size="sm"
            >
              <Settings className="w-4 h-4 text-slate-400" /> Profile
            </Button>

            <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-slate-200/80 dark:border-slate-800">
              <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0 overflow-hidden hover:scale-105 transition-transform">
                {profilePic ? (
                  <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  userName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="hidden lg:block text-left truncate max-w-[120px]">
                <p className="text-[13px] font-extrabold leading-tight truncate text-slate-900 dark:text-white uppercase">{userName}</p>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide">Scholar Level 3</p>
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 p-1.5 transition-colors shrink-0" title="Sign Out">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Console Content */}
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col gap-8 relative z-10">
        
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col items-start text-left relative overflow-hidden">
            <Flame className="w-5 h-5 text-orange-500 mb-4" />
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1">5 Days</h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Study Streak</p>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col items-start text-left relative overflow-hidden">
            <Clock className="w-5 h-5 text-blue-500 mb-4" />
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1">24 hrs</h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Target Studied (53% Avg)</p>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col items-start text-left relative overflow-hidden">
            <Award className="w-5 h-5 text-emerald-500 mb-4" />
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1">45 Cards</h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Terms Fully Mastered</p>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col items-start text-left relative overflow-hidden">
            <Calendar className="w-5 h-5 text-purple-500 mb-4" />
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1">4 Days Left</h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mid-term Milestone</p>
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
          {filtered.length === 0 ? (
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSubject(sub.id, e);
                      }}
                      className="text-slate-300 hover:text-red-500 transition-colors z-10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <h3 className="font-bold text-[17px] text-slate-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-tight mb-1">{sub.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-6 font-medium">
                    <Users className="w-3.5 h-3.5" />
                    <span className="truncate">{sub.teacher || 'Prof. J. Doe'}</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-[11px] font-bold">
                      <span className="text-slate-500">Proficiency Rate</span>
                      <span className="text-slate-700 dark:text-slate-300">{sub.progress}%</span>
                    </div>
                    <ProgressBar value={sub.progress} className="h-2 rounded-xl" />
                  </div>
                </div>

                <div className="mt-6 flex justify-between items-center pl-1 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <div className="bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[10px] font-extrabold px-3 py-1 rounded-full border border-primary-100 dark:border-primary-800/50">
                    {sub.credits || 3} Credits
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-medium text-slate-500">Class: {sub.nextClass || "Thu 09:00 AM"}</span>
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

      {/* Profile, Goals & Notification Preferences Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm animate-in zoom-in-95 duration-200 bg-white dark:bg-slate-950 shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-500" /> Goals & Personal Setup
              </h2>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar pb-2 pr-1 text-left">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-150 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider mb-1">Scholar Profile</p>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">{userName}@scholar.com</p>
                  <p className="text-xs text-slate-500 mt-0.5">Customise details below.</p>
                </div>
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-primary-500 to-teal-500 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0 overflow-hidden cursor-pointer">
                    {profilePic ? (
                      <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      editName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-white dark:bg-slate-800 p-1.5 rounded-full shadow-md text-slate-500 cursor-pointer border border-slate-200 hover:text-primary-500 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-450 mb-1.5">Scholar Name</label>
                <Input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs h-10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-450 mb-1.5">Account Password</label>
                <Input 
                  type="password" 
                  value={editPassword} 
                  onChange={(e) => setEditPassword(e.target.value)} 
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs h-10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-455 mb-1.5">Weekly Target Study Hours</label>
                <div className="flex gap-2">
                  {['10', '20', '30', '40'].map(hrs => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setTargetHours(hrs)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all",
                        targetHours === hrs 
                          ? "bg-primary-600 border-primary-600 text-white shadow-sm" 
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                      )}
                    >
                      {hrs} hrs
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-455 mb-1.5">Academic Target GPA Range</label>
                <div className="flex gap-2">
                  {['Grade A*', 'Grade A', 'Grade B'].map(gd => (
                    <button
                      key={gd}
                      type="button"
                      onClick={() => setTargetGrade(gd)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all",
                        targetGrade === gd 
                          ? "bg-primary-600 border-primary-600 text-white shadow-sm" 
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                      )}
                    >
                      {gd}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-450 mb-20">Notifications Platforms</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={telegramAlerts} 
                      onChange={() => setTelegramAlerts(!telegramAlerts)}
                      className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 border-slate-300 dark:border-slate-700" 
                    />
                    <div className="text-xs">
                      <p className="font-extrabold text-slate-800 dark:text-slate-200">Telegram Prep Bot Alerts</p>
                      <p className="text-slate-400 mt-0.5">Receive due dates & quiz reminders on Telegram</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={emailAlerts} 
                      onChange={() => setEmailAlerts(!emailAlerts)}
                      className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 border-slate-300 dark:border-slate-700" 
                    />
                    <div className="text-xs">
                      <p className="font-extrabold text-slate-800 dark:text-slate-200">Weekly Performance Dashboard (Email)</p>
                      <p className="text-slate-400 mt-0.5">Receive email summary diagnostics</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" onClick={handleSaveProfile} className="w-full bg-primary-600 font-bold hover:bg-primary-700">
                  Save
                </Button>
              </div>
            </div>
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
