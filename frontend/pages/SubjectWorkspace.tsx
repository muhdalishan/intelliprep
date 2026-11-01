import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Subject, TabType, Flashcard, QuizQuestion, KanbanTask, StickyNote, Reminder } from '../types';
import { MOCK_SUBJECTS, MOCK_FLASHCARDS, MOCK_QUIZ, MOCK_KANBAN, MOCK_NOTES, MOCK_REMINDERS } from '../constants';
import { Button, Card, cn, Input, ProgressBar, Badge } from '../components/UIComponents';
import { KanbanBoard, MoodBoard } from '../components/WorkspaceTools';
import { 
  generateSummary, 
  generateFlashcards, 
  generateQuiz, 
  generateGuessPaper, 
  chatWithAssistant,
  ChatMessage,
  GuessPaperResult
} from '../services/aiService';
import { 
  ArrowLeft, LayoutDashboard, Upload, FileText, Layers, CheckSquare, 
  Columns, Layout, GraduationCap, Bell, ChevronLeft, ChevronRight, RotateCw, 
  Play, Send, Image as ImageIcon, Flame, MessageSquare, AlertTriangle, 
  CheckCircle2, Plus, Clock, HelpCircle, X, BrainCircuit, Activity, Trash2, Volume2,
  Users, Compass, BookOpen, PenTool, FileUp, Calendar, Hash, Shield, Share2, LogOut, PlusCircle,
  Eye, History, Paperclip
} from 'lucide-react';
// Recharts removed for native SVG performance and absolute reliability

export const SubjectWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Load consolidated subjects state so added/edited subjects exist here
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem('prep_subjects');
    return saved ? JSON.parse(saved) : MOCK_SUBJECTS;
  });

  const subject = subjects.find(s => s.id === id);

  useEffect(() => {
    if (subjects.length > 0) {
      localStorage.setItem('prep_subjects', JSON.stringify(subjects));
    }
  }, [subjects]);

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);
  
  const userName = localStorage.getItem('userName') || 'Scholar';
  const profilePic = localStorage.getItem('profilePic') || '';
  
  // High fidelity default study notes based on course topic
  const getDefaultSyllabusNotes = (subjectName: string) => {
    if (subjectName.includes("Math")) {
      return `LECTURE NOTES: Advanced Calculus & Integration Principles
Course weight: Major Final Course

Section 1: Core Theorems
1. Rolle's Theorem: If f is continuous on [a, b] and differentiable on (a, b), and f(a) = f(b), then there exists a c in (a, b) such that f'(c) = 0.
2. Mean Value Theorem (MVT): If f(x) is continuous on [a, b] and differentiable on (a, b), then f'(c) = (f(b) - f(a)) / (b - a).
3. Fundamental Theorem of Calculus: Connecting differentiation and integration.

Section 2: Multi-Variable Double Integrals
Double integrals over generic regions are computed using iterated integrals. Switching limits using Fubini's theorem:
Integrate with respect to x first, then y. If the boundary curves are algebraic (e.g., y = x^2), polar coordinate coordinates (r, theta) are highly optimal where dA = r dr dtheta.

Section 3: Infinite Series Convergence limits
- Geometric Series converges if |r| < 1.
- Ratio Test: L = lim |a_{n+1}/a_n|. Converges if L < 1, diverges if L > 1.
- Taylor Series Expansion: f(x) = sum [f^(n)(a) / n!] * (x - a)^n.`;
    }
    if (subjectName.includes("Computer") || subjectName.includes("Science")) {
      return `LECTURE NOTES: Computer Systems Framework & Algorithmic Analysis
Course weight: Core Technical

Section 1: Data Structures
1. Linked Lists vs Arrays: Arrays offer O(1) random index access but O(N) insertion in random offsets. Linked lists offer O(1) pointer updates but require O(N) sequential search patterns.
2. Binary Search Trees (BST): Left children hold lower keys, right children hold greater keys. Average search complexity is O(log N). Worst case degenerates to O(N) if tree is un-balanced.
3. Hash Tables: Key-value mapped configurations mapping key inputs using standard hash divisions. Solves collisions using chaining loops or open addressing.

Section 2: Master Algorithmic Complexity (Big O)
Big O represents the asymptotic upperbound on running time or memory:
- Bubble Sort and Insertion Sort: O(N^2)
- Merge Sort and Quick Sort: O(N log N)
- Binary Search algorithms: O(log N)`;
    }
    if (subjectName.includes("Physics")) {
      return `LECTURE NOTES: General Electromagnetism and Coulombic Waves
Course weight: Lab Science Core

Section 1: Electrostatic forces
1. Coulomb's Law: The force F between point charges q1, q2 is proportional to the values and inversely proportional to the square of physical distance: F = k * (q1*q2)/r^2.
2. Gauss's Law: Int[ E * dA ] = Q_enclosed / epsilon_0.
3. Capacitors: Devices storing electro-potential charges in dual metal planes. C = Q/V. Standard parallel configurations have C = (epsilon * A)/d.

Section 2: DC Circuits & Kirchhoff Laws
- KCL (Current Law): The sum of incoming currents in any circuit junction is exactly equal to outgoing sums. (Conservation of charge).
- KVL (Voltage Law): The sum of net voltage drops across any closed loop equals exactly zero. (Conservation of energy).`;
    }
    return `LECTURE NOTES: Foundations & Core Syllabi review
Subject: ${subjectName}

Section 1: Core Paradigms
- Comprehensive historical analysis of methodologies.
- Comparative reviews of standard practices versus contemporary iterations.
- Analyzing regional, administrative, and strategic configurations.

Section 2: Practice applications
- Practical case analyses on implementation.
- Standard formulas, system workflows, and structural dependencies.
- Analyzing common failures and optimization thresholds.`;
  };

  // State Management
  const [summaryText, setSummaryText] = useState(() => getDefaultSyllabusNotes(subject?.name || 'Default'));
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadedFiles, setLoadedFiles] = useState<{name: string, content: string, date: string}[]>([
    { name: `Syllabus_${subject?.name?.replace(/\s+/g, '_')}_QuickNotes.txt`, content: getDefaultSyllabusNotes(subject?.name || ''), date: "Today" }
  ]);

  // Flashcards state
  const [flashcards, setFlashcards] = useState<Flashcard[]>(() => {
    // Generate some mock topic specific flashcards initially
    const subName = subject?.name || '';
    if (subName.includes("Math")) {
      return [
        { id: 'mat-1', front: "What is the derivative of x * sin(x)?", back: "sin(x) + x*cos(x) using the Product Rule f'g + fg'", mastered: false },
        { id: 'mat-2', front: "What is Taylor Series Expansion for e^x?", back: "1 + x + x^2/2! + x^3/3! + ...", mastered: false },
        { id: 'mat-3', front: " Fubini's Theorem parameter", back: "Allows switching order of double integration boundaries over continuous areas.", mastered: true }
      ];
    }
    if (subName.includes("Computer")) {
      return [
        { id: 'cs-1', front: "What is Binary Search time complexity?", back: "O(log N)", mastered: false },
        { id: 'cs-2', front: "Difference between Stack and Queue?", back: "Stack is Last-In First-Out (LIFO); Queue is First-In First-Out (FIFO)", mastered: false },
        { id: 'cs-3', front: "Average sorting cost for Merge Sort?", back: "O(N log N) in all scenarios", mastered: true }
      ];
    }
    return MOCK_FLASHCARDS;
  });
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Weak Topic list dynamically aggregated from Quiz failures and manual flags
  const [weakTopics, setWeakTopics] = useState<{id: string, name: string, origin: 'quiz' | 'flashcard', date: string, reviewIdea: string}[]>([
    { id: 'wt-init-1', name: `Limits calculations (${subject?.name})`, origin: 'flashcard', date: "Recently", reviewIdea: "Review Rolle's theorem derivatives and practice 5 standard L'Hopital algebraic identities." }
  ]);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(() => {
    const subName = subject?.name || '';
    if (subName.includes("Math")) {
      return [
        { id: 'qm-1', question: "What represents Rolle's Theorem requirement under continuous [a, b] limits?", options: ["f(a) must equal f(b)", "f'(a) = f'(b)", "Interval has to cross zero value", "Integral equals 1"], correctIndex: 0 },
        { id: 'qm-2', question: "What is the result of integrating cos(2x) dx?", options: ["sin(2x) + C", "0.5 * sin(2x) + C", "-0.5 * sin(2x) + C", "-2 * sin(2x)"], correctIndex: 1 },
        { id: 'qm-3', question: "Which test confirms geometric series convergence parameters?", options: ["Ratio test only", "Asymptotic bound checking", "Checking whether absolute common ratio |r| < 1", "Root evaluation"], correctIndex: 2 }
      ];
    }
    if (subName.includes("Computer")) {
      return [
        { id: 'qc-1', question: "Which search algorithm holds O(log N) worst efficiency limits?", options: ["Linear Search", "Binary Search over sorted data", "Depth First Search", "Breadth First Search"], correctIndex: 1 },
        { id: 'qc-2', question: "What happens if a Binary Search Tree degenerates to a single sorted sequential chain?", options: ["Complexity is still O(log N)", "Complexity improves to O(1)", "Complexity decays to O(N)", "Stack overflow"], correctIndex: 2 },
        { id: 'qc-3', question: "Which sorting algorithm is guaranteed to execute O(N log N) in worst case?", options: ["Quick Sort", "Bubble Sort", "Merge Sort", "Insertion Sort"], correctIndex: 2 }
      ];
    }
    return MOCK_QUIZ;
  });
  const [quizActive, setQuizActive] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isAdaptiveMode, setIsAdaptiveMode] = useState(false);
  const [lastQuestionFeedback, setLastQuestionFeedback] = useState<{correct: boolean, chosen: number, explanation: string} | null>(null);
  const [showQuizResult, setShowQuizResult] = useState(false);

  // Exam mode countdown stats
  const [examActive, setExamActive] = useState(false);
  const [examTimeLeft, setExamTimeLeft] = useState(600); // 10 mins
  const [selectedExamAnswers, setSelectedExamAnswers] = useState<Record<string, number>>({});
  const [examFeedbackText, setExamFeedbackText] = useState('');

  // Guess Engine state
  const [guessResults, setGuessResults] = useState<GuessPaperResult | null>(null);
  const [isGuessing, setIsGuessing] = useState(false);

  // Kanban and Moodboard state
  const [kanbanTasks, setKanbanTasks] = useState<KanbanTask[]>(MOCK_KANBAN);
  const [moodNotes, setMoodNotes] = useState<StickyNote[]>(MOCK_NOTES);

  // Group Study Room states
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroTime, setPomodoroTime] = useState(1500); // 25 mins
  const [pomodoroMode, setPomodoroMode] = useState<'work' | 'break'>('work');
  const [pomodoroCycles, setPomodoroCycles] = useState(0);
  
  // Virtual classmate chat history
  const [groupChat, setGroupChat] = useState<{ sender: string, text: string, time: string, isPeer: boolean }[]>([
    { sender: "Sarah Lin", text: "Hey! Just hopped into the study room. Ready to crush some limits formulas?", time: "08:31 AM", isPeer: true },
    { sender: "Alex Rover", text: "Yo, I'm working on Taylor expansions. They are tripping me up majorly.", time: "08:33 AM", isPeer: true }
  ]);
  const [chatInputValue, setChatInputValue] = useState('');

  // Discord-inspired Study Guild States
  const [currentGuildCode, setCurrentGuildCode] = useState<string | null>(() => {
    return localStorage.getItem(`study_guild_code_${id}`) || null;
  });
  const [guildName, setGuildName] = useState<string>(() => {
    return localStorage.getItem(`study_guild_name_${id}`) || '';
  });
  const [activeChannel, setActiveChannel] = useState<'welcome' | 'chat' | 'resources' | 'whiteboard'>('welcome');
  const [sharedResources, setSharedResources] = useState<{ id: string, name: string, type: 'note' | 'slide' | 'link', url: string, date: string, addedBy: string }[]>(() => {
    const saved = localStorage.getItem(`study_guild_resources_${id}`);
    return saved ? JSON.parse(saved) : [
      { id: 'r1', name: "Limits formulas list PDF", type: "note", url: "#", date: "Today, 10:20 AM", addedBy: "Sarah Lin" },
      { id: 'r2', name: "MVT and Rolle's Theorem Slides", type: "slide", url: "#", date: "Yesterday, 4:15 PM", addedBy: "Alex Rover" }
    ];
  });

  // Workspace AI Assistant Chatbot
  const [tutorHistory, setTutorHistory] = useState<ChatMessage[]>([]);
  const [tutorInputValue, setTutorInputValue] = useState('');
  const [tutorIsLoading, setTutorIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Reminders list
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    return MOCK_REMINDERS.map(r => ({ ...r, date: "2026-06-15" }));
  });

  const scrollChatToBottom = () => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollChatToBottom();
  }, [tutorHistory, groupChat]);

  // FEATURE REFACTOR: DUAL-INPUT & HISTORY
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState('');
  const [showDocSelector, setShowDocSelector] = useState(false);
  
  const [summaryHistory, setSummaryHistory] = useState<{id: string, doc: string[], content: string, date: string}[]>([]);
  const [quizHistory, setQuizHistory] = useState<{id: string, doc: string[], score: number, total: number, date: string}[]>([]);
  const [flashcardDeckHistory, setFlashcardDeckHistory] = useState<{id: string, doc: string[], cardCount: number, date: string}[]>([]);
  const [guessPaperHistory, setGuessPaperHistory] = useState<{id: string, doc: string[], date: string, questions: number}[]>([]);
  
  const [previewContent, setPreviewContent] = useState<{title: string, text: string} | null>(null);

  const handleUploadFromChat = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string || '';
      const newFileObj = {
        name: file.name,
        content: content,
        date: new Date().toLocaleDateString()
      };
      setLoadedFiles(prev => [newFileObj, ...prev]);
      setSelectedDocs(prev => [...prev, file.name]);
    };
    reader.readAsText(file);
  };

  const renderDualInputHeader = (title: string, subtext: string, onGenerate: () => void, isGenerating: boolean, actionLabel: string = "Generate") => {
    const isReady = customTopic.trim() !== '' || selectedDocs.length > 0;
    
    return (
    <div className="w-full mt-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 shadow-sm rounded-2xl p-1 relative">
        
        {/* Header Title (Subtle) */}
        <div className="px-4 pt-3 pb-1 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
            <h3 className="font-bold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {title}
            </h3>
          </div>
          <div className="flex flex-wrap gap-1">
             {selectedDocs.map(doc => (
                <span key={doc} className="bg-primary-50/80 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 border border-primary-200 dark:border-primary-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <FileText className="w-2.5 h-2.5" /> 
                  <span className="max-w-[100px] truncate">{doc}</span>
                  <button onClick={() => setSelectedDocs(docs => docs.filter(d => d !== doc))} className="hover:text-red-500 transition-colors"><X className="w-2.5 h-2.5"/></button>
                </span>
             ))}
          </div>
        </div>
        
        {/* Chat Input Area */}
        <div className="relative">
          <textarea
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="Type a custom topic or leave blank to only use attached documents..."
            className="w-full bg-transparent border-0 resize-none outline-none text-sm p-4 min-h-[60px] text-gray-800 dark:text-gray-100 placeholder-gray-400"
          />
          
          <div className="flex justify-between items-center px-3 pb-3">
            <div className="relative flex items-center gap-2">
              <Button variant="ghost" size="sm" className="rounded-full text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950 px-4 h-9 shadow-sm bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700" onClick={() => setShowDocSelector(!showDocSelector)}>
                <Paperclip className="w-4 h-4 mr-2" /> 
                <span className="font-bold text-xs">{selectedDocs.length > 0 ? `${selectedDocs.length} Attached` : 'Attach'}</span>
              </Button>
              
              <label>
                <span className="cursor-pointer inline-flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950 px-4 h-9 shadow-sm bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 font-bold text-xs transition-colors">
                  <Upload className="w-4 h-4 mr-2 text-gray-400" />
                  Upload
                </span>
                <input type="file" accept=".txt,.md,.csv" className="hidden" onChange={(e) => {
                  handleUploadFromChat(e);
                  setShowDocSelector(true); // Open the selector so they see it
                }} />
              </label>
              
              {showDocSelector && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-4 z-50 animate-in fade-in zoom-in-95 backdrop-blur-xl">
                  <div className="flex justify-between items-center mb-3">
                     <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">Library Documents</h4>
                     <button onClick={() => setShowDocSelector(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"><X className="w-4 h-4"/></button>
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-hide">
                    {loadedFiles.length === 0 ? <p className="text-[10px] text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">No documents in library.</p> : null}
                    {loadedFiles.map(file => {
                      const isSelected = selectedDocs.includes(file.name);
                      return (
                        <div 
                          key={file.name} 
                          onClick={() => setSelectedDocs(prev => isSelected ? prev.filter(d => d !== file.name) : [...prev, file.name])}
                          className={cn("text-xs p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all font-medium", isSelected ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300" : "hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300")}
                        >
                           <div className="flex items-center gap-2 truncate">
                             <FileText className="w-3.5 h-3.5 opacity-70"/>
                             <span className="truncate">{file.name}</span>
                           </div>
                           {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary-500" />}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-medium text-gray-400 hidden sm:inline-block tracking-wider uppercase">
                {isReady ? 'Ready for AI' : 'Provide Input'}
              </span>
              <Button 
                size="sm" 
                className={cn("rounded-full px-6 font-bold shadow-sm", !isReady && "opacity-50 cursor-not-allowed")}
                onClick={isReady ? onGenerate : undefined}
                isLoading={isGenerating}
                disabled={!isReady}
              >
                {actionLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )};

  // Tab configurations
  const tabs: { id: TabType; label: string; icon: any; color: string }[] = [
    { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard, color: 'text-blue-500' },
    { id: 'upload', label: 'Study Text & Files', icon: Upload, color: 'text-indigo-500' },
    { id: 'summary', label: 'AI Summaries', icon: FileText, color: 'text-green-500' },
    { id: 'flashcards', label: 'Flashcards Room', icon: Layers, color: 'text-purple-500' },
    { id: 'quiz', label: 'Practice Quiz', icon: CheckSquare, color: 'text-pink-500' },
    { id: 'exam', label: 'Timed Exam Mode', icon: GraduationCap, color: 'text-red-500' },
    { id: 'weak-topics', label: 'Weak Topics', icon: AlertTriangle, color: 'text-orange-500' },
    { id: 'guess-engine', label: 'Exam Guess Engine', icon: BrainCircuit, color: 'text-emerald-500' },
    { id: 'studyroom', label: 'Group Study Guild', icon: Users, color: 'text-emerald-500' },
    { id: 'kanban', label: 'Planner Kanban', icon: Columns, color: 'text-teal-500' },
    { id: 'moodboard', label: 'Visual Moodboard', icon: Layout, color: 'text-cyan-500' },
    { id: 'reminders', label: 'Reminders & Alerts', icon: Bell, color: 'text-violet-500' }
  ];

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const day = (form.elements.namedItem('schedule_day') as HTMLSelectElement).value;
    const time = (form.elements.namedItem('schedule_time') as HTMLInputElement).value;
    const room = (form.elements.namedItem('schedule_room') as HTMLInputElement).value;
    
    if (subject) {
      const updatedSubject = {
        ...subject,
        schedule: [...(subject.schedule || []), { day, time, room, type: 'Lecture' }]
      };
      
      setSubjects(subjects.map(s => s.id === subject.id ? updatedSubject : s));
    }
    
    setShowAddScheduleModal(false);
  };

  const handleRemoveSchedule = (idx: number) => {
    if (subject) {
      const updatedSubject = {
        ...subject,
        schedule: (subject.schedule || []).filter((_, i) => i !== idx)
      };
      setSubjects(subjects.map(s => s.id === subject.id ? updatedSubject : s));
    }
  };

  // Self-contained Web Audio API alarm beep
  const triggerAudioAlert = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log("Audio playing pending user engagement interaction first", e);
    }
  };

  // -- Pomodoro Timer Effects --
  useEffect(() => {
    let interval: any;
    if (pomodoroActive && pomodoroTime > 0) {
      interval = setInterval(() => {
        setPomodoroTime(p => p - 1);
      }, 1000);
    } else if (pomodoroActive && pomodoroTime === 0) {
      triggerAudioAlert();
      if (pomodoroMode === 'work') {
        setPomodoroMode('break');
        setPomodoroTime(300); // 5 mins break
        setPomodoroCycles(c => c + 1);
        setGroupChat(chat => [
          ...chat,
          { sender: "Sarah Lin", text: "Amazing focus! Time for a short 5 min water break, let's grab coffee! ☕", time: "Now", isPeer: true }
        ]);
      } else {
        setPomodoroMode('work');
        setPomodoroTime(1500); // 25 mins work
        setGroupChat(chat => [
          ...chat,
          { sender: "Alex Rover", text: "Break's over! Let's lock in for another round of high-focus study! 🎉", time: "Now", isPeer: true }
        ]);
      }
    }
    return () => clearInterval(interval);
  }, [pomodoroActive, pomodoroTime, pomodoroMode]);

  // -- High Stakes Exam Mode Timer --
  useEffect(() => {
    let interval: any;
    if (examActive && examTimeLeft > 0) {
      interval = setInterval(() => {
        setExamTimeLeft(p => p - 1);
      }, 1000);
    } else if (examActive && examTimeLeft === 0) {
      handleExamSubmit();
    }
    return () => clearInterval(interval);
  }, [examActive, examTimeLeft]);

  // Early return must stay below every hook, or React crashes when the subject disappears
  if (!subject) {
    return (
      <div className="p-16 text-center">
        <ArrowLeft className="w-8 h-8 text-primary-500 mx-auto mb-4 cursor-pointer" onClick={() => navigate('/dashboard')} />
        <h3 className="text-xl font-bold">Workspace Not Found</h3>
        <p className="text-gray-400 mt-2">The selected curriculum workspace could not be located.</p>
        <Button className="mt-4" onClick={() => navigate('/dashboard')}>Return to Panel</Button>
      </div>
    );
  }

  // -- Dynamic File Upload Handler (FileReader) --
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string || '';
      
      // Update textbook material states
      const newFileObj = {
        name: file.name,
        content: content,
        date: new Date().toLocaleDateString()
      };
      
      setLoadedFiles([newFileObj, ...loadedFiles]);
      setSummaryText(content);
      setActiveTab('summary'); // Direct immediately to study summary!
    };
    reader.readAsText(file);
  };

  // Set selected upload as active material
  const handleSelectMaterial = (content: string) => {
    setSummaryText(content);
    alert("Got it. Opening Summaries for this file.");
    setActiveTab('summary');
  };

  // AI Summary generation
  const handleGenerateSummary = async () => {
    let textToSummarize = customTopic ? `[FOCUS TOPIC/INSTRUCTION: ${customTopic}]\n\n` : '';
    if (selectedDocs.length > 0) {
      textToSummarize += selectedDocs.map(doc => loadedFiles.find(f => f.name === doc)?.content || '').join('\n\n');
    } else {
      textToSummarize += summaryText;
    }

    if (!textToSummarize.trim()) return;
    setIsGenerating(true);
    const result = await generateSummary(textToSummarize);
    setGeneratedSummary(result);
    setSummaryHistory(prev => [{
      id: Math.random().toString(),
      doc: [...selectedDocs],
      content: result,
      date: new Date().toLocaleTimeString()
    }, ...prev]);
    setIsGenerating(false);
  };

  // AI Flashcard generation based on textbooks
  const handleGenerateFlashcards = async () => {
    let textToSummarize = customTopic ? `[FOCUS TOPIC/INSTRUCTION: ${customTopic}]\n\n` : '';
    if (selectedDocs.length > 0) {
      textToSummarize += selectedDocs.map(doc => loadedFiles.find(f => f.name === doc)?.content || '').join('\n\n');
    } else {
      textToSummarize += subject.name;
    }
      
    setIsGenerating(true);
    const result = await generateFlashcards(textToSummarize.substring(0, 300) || subject.name);
    if (result && result.length > 0) {
      setFlashcards(result);
      setActiveCardIndex(0);
      setIsFlipped(false);
      setFlashcardDeckHistory(prev => [{
        id: Math.random().toString(),
        doc: [...selectedDocs],
        cardCount: result.length,
        date: new Date().toLocaleTimeString()
      }, ...prev]);
    }
    setIsGenerating(true); // Complete
    setTimeout(() => setIsGenerating(false), 300);
  };

  // Flag active flashcard as weak topic
  const flagFlashcardAsWeak = (card: Flashcard) => {
    // Avoid double entries
    if (weakTopics.some(wt => wt.name.includes(card.front))) return;

    const newWeak = {
      id: `fc-weak-${Date.now()}`,
      name: `Flashcard query: "${card.front}"`,
      origin: 'flashcard' as const,
      date: "Just now",
      reviewIdea: `Check answer explanation: "${card.back}". Consider reviewing related lecture notes.`
    };
    setWeakTopics([newWeak, ...weakTopics]);
    alert("Flagged item as weak. It has been synchronized to your Weak-Topic Tracker tab for custom remedial action!");
  };

  // Quiz submission & explanation block
  const handleQuizAnswer = (chosenIndex: number) => {
    const q = quizQuestions[currentQuestion];
    const isCorrect = chosenIndex === q.correctIndex;
    
    setLastQuestionFeedback({
      correct: isCorrect,
      chosen: chosenIndex,
      explanation: isCorrect 
        ? "Excellent work! Your knowledge base aligns perfectly with this subject point."
        : `Correction: The proper answer is "${q.options[q.correctIndex]}". Let's sync this question to your Weak Topics Tracker panel so we can review later.`
    });

    if (isCorrect) {
      setQuizScore(s => s + 1);
    } else {
      // Auto register quiz failure to Weak Topics!
      if (!weakTopics.some(wt => wt.name.includes(q.question))) {
        setWeakTopics(wt => [
          ...wt,
          {
            id: `q-weak-${Date.now()}`,
            name: `Incorrect Quiz Point: "${q.question}"`,
            origin: 'quiz',
            date: "Today",
            reviewIdea: `Study correct answer parameters: "${q.options[q.correctIndex]}". Practice active recall inside practice quizzes.`
          }
        ]);
      }
    }
  };

  const handleNextQuizQuestion = () => {
    setLastQuestionFeedback(null);
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(c => c + 1);
    } else {
      setShowQuizResult(true);
      setQuizHistory(prev => [{
        id: Math.random().toString(),
        doc: [...selectedDocs],
        score: quizScore,
        total: quizQuestions.length,
        date: new Date().toLocaleTimeString()
      }, ...prev]);
    }
  };

  const handleResetQuiz = () => {
    setQuizActive(false);
    setQuizScore(0);
    setCurrentQuestion(0);
    setLastQuestionFeedback(null);
    setShowQuizResult(false);
  };

  const handleGenerateQuiz = async () => {
    let textToSummarize = customTopic ? `[FOCUS TOPIC/INSTRUCTION: ${customTopic}]\n\n` : '';
    if (selectedDocs.length > 0) {
      textToSummarize += selectedDocs.map(doc => loadedFiles.find(f => f.name === doc)?.content || '').join('\n\n');
    } else {
      textToSummarize += subject.name;
    }
      
    setIsGenerating(true);
    try {
      const gQuestions = await generateQuiz(textToSummarize.substring(0, 300) || 'Academic Core');
      if (gQuestions && gQuestions.length > 0) {
        setQuizQuestions(gQuestions);
        setQuizActive(true);
        setCurrentQuestion(0);
        setQuizScore(0);
        setLastQuestionFeedback(null);
        setShowQuizResult(false);
      } else {
        alert("Using offline-ready mock question set for evaluation practice!");
        setQuizActive(true);
        setCurrentQuestion(0);
        setQuizScore(0);
        setLastQuestionFeedback(null);
        setShowQuizResult(false);
      }
    } catch (err) {
      console.error(err);
      alert("Error generating quiz. Please verify configuration parameters.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Run AI Guess Engine
  const handleRunGuessEngine = async () => {
    let textToSummarize = customTopic ? `[FOCUS TOPIC/INSTRUCTION: ${customTopic}]\n\n` : '';
    if (selectedDocs.length > 0) {
      textToSummarize += selectedDocs.map(doc => loadedFiles.find(f => f.name === doc)?.content || '').join('\n\n');
    } else {
      textToSummarize += subject.name;
    }

    setIsGuessing(true);
    const result = await generateGuessPaper(subject.name, textToSummarize.substring(0, 1000));
    setGuessResults(result);
    setGuessPaperHistory(prev => [{
      id: Math.random().toString(),
      doc: [...selectedDocs],
      date: new Date().toLocaleTimeString(),
      questions: result.sampleQuestions.length
    }, ...prev]);
    setIsGuessing(false);
  };

  // Custom AI Interactive Tutor Assistant Chat bubble
  const handleSendTutorChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorInputValue.trim()) return;

    const userMsg = tutorInputValue.trim();
    setTutorInputValue('');
    const updatedHistory: ChatMessage[] = [
      ...tutorHistory,
      { role: 'user', text: userMsg }
    ];
    setTutorHistory(updatedHistory);
    setTutorIsLoading(true);

    const reply = await chatWithAssistant(subject.name, updatedHistory, userMsg);
    setTutorHistory([
      ...updatedHistory,
      { role: 'model', text: reply }
    ]);
    setTutorIsLoading(false);
  };


  // -- Study Guild Room Handlers --
  const handleCreateGuild = (nameVal: string) => {
    if (!nameVal.trim()) return;
    const randomCode = `STUDY-${Math.floor(1000 + Math.random() * 9000)}`;
    const newName = nameVal.trim();
    setCurrentGuildCode(randomCode);
    setGuildName(newName);
    localStorage.setItem(`study_guild_code_${id}`, randomCode);
    localStorage.setItem(`study_guild_name_${id}`, newName);
    setActiveChannel('welcome');
  };

  const handleJoinGuild = (codeVal: string) => {
    const rawCode = codeVal.trim().toUpperCase();
    if (!rawCode) return;
    setCurrentGuildCode(rawCode);
    let resolvedName = "Scholar Peer Hub";
    if (rawCode === 'MATH101') resolvedName = "Math-Prep-101 Guild";
    else if (rawCode === 'PHYS202') resolvedName = "Phys-Core Study Association";
    else if (rawCode.startsWith('STUDY-')) resolvedName = `Study Room ${rawCode}`;
    else resolvedName = `Group Guild [Code: ${rawCode}]`;
    
    setGuildName(resolvedName);
    localStorage.setItem(`study_guild_code_${id}`, rawCode);
    localStorage.setItem(`study_guild_name_${id}`, resolvedName);
    setActiveChannel('welcome');
  };

  const handleLeaveGuild = () => {
    setCurrentGuildCode(null);
    setGuildName('');
    localStorage.removeItem(`study_guild_code_${id}`);
    localStorage.removeItem(`study_guild_name_${id}`);
  };

  const handleAddResource = (resName: string, resType: 'note' | 'slide' | 'link') => {
    if (!resName.trim()) return;
    const userName = localStorage.getItem('userName') || 'Scholar';
    const newRes = {
      id: `r-${Date.now()}`,
      name: resName.trim(),
      type: resType,
      url: '#',
      date: 'Just now',
      addedBy: userName
    };
    const updated = [newRes, ...sharedResources];
    setSharedResources(updated);
    localStorage.setItem(`study_guild_resources_${id}`, JSON.stringify(updated));
  };


  // Co-Study Classmates Simulated Responses
  const handleSendGroupChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputValue.trim()) return;

    const userText = chatInputValue.trim();
    setChatInputValue('');

    const userName = localStorage.getItem('userName') || 'Scholar';
    const textToSubmit = {
      sender: `${userName} (You)`,
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isPeer: false
    };

    setGroupChat(g => [...g, textToSubmit]);

    // Simulated responses from classmates
    setTimeout(() => {
      const responses = [
        "That formula tracks perfectly! I'm testing my score in Adaptive Exam mode right now.",
        "Wait, could you share that summarized note? I'd love to drag it into my card planner stack.",
        "We're on fire today! Let's configure a 5-minute break pomodoro timer and get some tea.",
        "The predictions for our upcoming exam match our teacher's syllabus exactly. Glad we ran the Guess Engine!",
        "Double integration limits always give me headaches. Let me ask the virtual AI Tutor about it."
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      const randomPeer = ["Sarah Lin", "Alex Rover", "Jessica K."][Math.floor(Math.random() * 3)];
      
      setGroupChat(g => [
        ...g,
        {
          sender: randomPeer,
          text: randomResponse,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isPeer: true
        }
      ]);
    }, 1500);
  };

  // Start exam mode
  const startExamModeSession = () => {
    setSelectedExamAnswers({});
    setExamTimeLeft(600); // 10 minutes session
    setExamFeedbackText('');
    setExamActive(true);
  };

  // High Stakes Exam submission
  const handleExamSubmit = () => {
    setExamActive(false);
    // Grade calculations
    let correctCount = 0;
    quizQuestions.forEach(q => {
      if (selectedExamAnswers[q.id] === q.correctIndex) {
        correctCount += 1;
      }
    });

    const scorePct = Math.round((correctCount / quizQuestions.length) * 100);
    const mockFeedbacks = scorePct >= 80 
      ? `Amazing final grade: ${scorePct}%! Your syllabus knowledge base is highly advanced. Keep this steady study momentum!`
      : `Final grade achieved: ${scorePct}%. Several gaps of core theory were flagged. Recommended action: Review your synchronized terms inside the Weak Topics Tracker panel immediately.`;
    
    // Auto register wrong questions to Weak Topics tracker
    quizQuestions.forEach(q => {
      if (selectedExamAnswers[q.id] !== q.correctIndex) {
        if (!weakTopics.some(wt => wt.name.includes(q.question))) {
          setWeakTopics(wt => [
            ...wt,
            {
              id: `q-exam-weak-${Date.now()}`,
              name: `Missed Exam Question: "${q.question}"`,
              origin: 'quiz' as const,
              date: "Exam final",
              reviewIdea: `Focus on corrective syllabus terms: "${q.options[q.correctIndex]}" immediately.`
            }
          ]);
        }
      }
    });

    setExamFeedbackText(mockFeedbacks);
  };

  // Delete dynamic weak item
  const handleClearWeakTopic = (id: string) => {
    setWeakTopics(weakTopics.filter(wt => wt.id !== id));
  };

  // Reminders creation
  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const msg = (form.elements.namedItem('message') as HTMLInputElement).value;
    const dateInput = (form.elements.namedItem('dueDate') as HTMLInputElement).value;
    const platform = (form.elements.namedItem('platform') as HTMLSelectElement).value as any;

    if (!msg.trim()) return;

    setReminders([...reminders, {
      id: `rem-${Date.now()}`,
      message: msg,
      date: dateInput || '2026-06-15',
      platform: platform
    }]);
    form.reset();
  };

  // Remove dynamic reminder
  const handleRemoveReminder = (id: string) => {
    setReminders(reminders.filter(r => r.id !== id));
  };


  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden font-sans">
      
      {/* 1. Left Vertical Action Sidebar */}
      <aside className="w-18 lg:w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-20">
        
        {/* Course Return banner */}
        <div 
          className="p-4 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 h-16 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
          onClick={() => navigate('/dashboard')}
        >
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <div className="hidden lg:block truncate">
            <span className="block text-[10px] text-gray-400 font-extrabold uppercase leading-none">Back</span>
            <span className="font-extrabold text-base text-primary-900 dark:text-white leading-tight truncate block">{subject.name}</span>
          </div>
        </div>

        {/* Tab List */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2.5 no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                // Clear state when switching tabs to avoid floating artifacts
                setLastQuestionFeedback(null);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 group relative",
                activeTab === tab.id 
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300 font-bold shadow-sm" 
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50/50 dark:hover:bg-gray-700/60"
              )}
            >
              <tab.icon className={cn("w-5 h-5 transition-colors", activeTab === tab.id ? "text-primary-600 dark:text-primary-400" : "text-gray-400 group-hover:text-primary-500")} />
              <span className="font-medium text-xs lg:text-sm hidden lg:block leading-none">{tab.label}</span>
              
              {/* Special Badge Indicators */}
              {tab.id === 'weak-topics' && weakTopics.length > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full bg-orange-500 text-white font-extrabold flex items-center justify-center text-[10px] animate-pulse">
                  {weakTopics.length}
                </span>
              )}
              {tab.id === 'studyroom' && pomodoroActive && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-500 font-bold hidden lg:inline">
                  LIVE
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Dynamic Goal tracker indicator bottom sidebar */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 hidden lg:block bg-gray-50/50 dark:bg-gray-800/40">
          <div className="bg-primary-900 rounded-xl p-3.5 text-white shadow-inner relative overflow-hidden">
            <div className="absolute right-0 top-0 w-8 h-8 rounded-full bg-primary-700/25 blur-sm"></div>
            <p className="text-[10px] uppercase font-bold text-primary-200 leading-none">Weekly Goals</p>
            <div className="flex justify-between items-baseline mt-1.5 mb-1 text-xs">
              <span className="font-black text-sm">12.5 hrs</span>
              <span className="opacity-80">62% done</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div className="bg-white h-full" style={{ width: '62%' }}></div>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Main Module Viewer Space / Header */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col h-full overflow-hidden relative">
        
        {/* Wide Header Info */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-3">
            <div className={cn("w-3 h-3 rounded-full", subject.color)}></div>
            <div>
              <h1 className="text-base font-extrabold text-gray-900 dark:text-white leading-tight">
                {subject.name} <span className="text-xs text-gray-400 font-normal">({subject.credits} Credits Syllabus)</span>
              </h1>
              <p className="text-xs text-gray-400 font-medium">Instructor: {subject.teacher} • Level 1 Core</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#ccfbf1] text-[#0f172a] dark:bg-primary-900/50 dark:text-primary-100 px-3 py-1 rounded-full text-xs font-bold border border-transparent">
              <Flame className="w-4 h-4 text-[#0b957f]" /> 5 Days Streak
            </div>
            
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-xs overflow-hidden">
              {profilePic ? (
                <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                userName.charAt(0).toUpperCase()
              )}
            </div>
          </div>
        </header>

        {/* 3. Deep Focus High-Stakes Exam Mode Screen Overlay (Takes full height/width) */}
        {activeTab === 'exam' && examActive && (
          <div className="absolute inset-0 z-[100] bg-gray-950 text-white flex flex-col animate-in fade-in duration-300">
            
            {/* Header focused timer */}
            <header className="h-16 flex items-center justify-between px-8 border-b border-gray-800 bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-650 flex items-center justify-center text-white text-sm font-bold">
                  EX
                </div>
                <div>
                  <h1 className="font-bold text-sm">Exam Mode Session: {subject.name}</h1>
                  <span className="block text-[10px] text-gray-400">Strict academic evaluation mode is active</span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 px-4 py-1.5 rounded-xl font-mono text-base font-black text-red-400 animate-pulse">
                  <Clock className="w-4 h-4" /> {Math.floor(examTimeLeft / 60)}:{String(examTimeLeft % 60).padStart(2, '0')}
                </div>
                
                <Button variant="ghost" className="text-gray-400 hover:text-white" size="sm" onClick={() => {
                  if (confirm("Cancel current exam session? Any answers won't be calculated.")) {
                    setExamActive(false);
                    setActiveTab('overview');
                  }
                }}>
                  Force Exit
                </Button>
              </div>
            </header>

            {/* Scrollable Questions Board */}
            <div className="flex-1 overflow-y-auto py-10 px-6 max-w-3xl mx-auto w-full space-y-8">
              <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800">
                <h2 className="text-base font-bold flex items-center gap-2 text-yellow-400 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" /> Instructions For Scoring
                </h2>
                <ul className="list-disc pl-5 text-xs text-gray-400 space-y-1">
                  <li>Questions come from your current practice quiz set.</li>
                  <li>Questions got wrong are auto-synced into weak topics tracking to help you review parameters easily.</li>
                  <li>Do not navigate away from this screen or close the tab, otherwise score is deleted.</li>
                </ul>
              </div>

              {quizQuestions.map((q, qIndex) => (
                <Card key={q.id} className="bg-gray-900 border border-gray-800 p-6 space-y-4 shadow-sm text-left">
                  <span className="uppercase text-[10px] font-extrabold text-primary-400 tracking-wider">
                    Question {qIndex + 1} of {quizQuestions.length}
                  </span>
                  <h3 className="text-base font-bold text-gray-100">{q.question}</h3>
                  
                  <div className="space-y-2 pt-2">
                    {q.options.map((opt, optIndex) => {
                      const isSelected = selectedExamAnswers[q.id] === optIndex;
                      return (
                        <label 
                          key={optIndex} 
                          className={cn(
                            "flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer transition-all text-xs touch-manipulation",
                            isSelected 
                              ? "border-primary-500 bg-primary-950/20 text-white" 
                              : "border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-700 hover:text-white"
                          )}
                        >
                          <input 
                            type="radio" 
                            name={q.id} 
                            checked={isSelected}
                            onChange={() => setSelectedExamAnswers({ ...selectedExamAnswers, [q.id]: optIndex })}
                            className="w-4 h-4 text-primary-600 border-gray-700 bg-gray-800 focus:ring-primary-500" 
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </Card>
              ))}

              <div className="pt-4 pb-12 flex justify-center">
                <Button size="lg" className="w-full" onClick={handleExamSubmit}>
                  Finalize and Submit Exam Paper
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Standard Tabs Content Display Area */}
        <div className={cn(
          "flex-1 min-h-0 relative w-full flex flex-col",
          ['overview', 'upload', 'kanban', 'reminders'].includes(activeTab) ? "overflow-y-auto p-6 md:p-8" : "overflow-hidden",
          !['moodboard', 'studyroom'].includes(activeTab) && !['overview', 'upload', 'kanban', 'reminders'].includes(activeTab) ? "p-6 md:p-8" : ""
        )}>
          
          {/* TAB 4.1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* Dynamic stats cards & Topic Weightage split */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Course Completion and statistics widgets */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    
                    {/* Completion Circular Progress pie chart */}
                    <Card className="flex flex-col justify-between items-center text-center p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <div className="w-full flex justify-between items-center mb-4">
                        <span className="text-xs font-bold uppercase text-gray-400">Sylabus Coverage</span>
                        <Badge color="bg-emerald-50 text-emerald-700">Excellent</Badge>
                      </div>

                      <div className="h-32 w-32 flex justify-center items-center relative my-2">
                        <svg className="w-28 h-28 transform -rotate-90">
                          {/* Track Circle */}
                          <circle
                            cx="56"
                            cy="56"
                            r="42"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            className="text-gray-200 dark:text-gray-700"
                          />
                          {/* Progress Circle with Stroke Dasharray */}
                          <circle
                            cx="56"
                            cy="56"
                            r="42"
                            stroke="currentColor"
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray={263.89}
                            strokeDashoffset={263.89 - (263.89 * (subject.progress || 0)) / 100}
                            strokeLinecap="round"
                            className="text-primary-600 dark:text-primary-400 transition-all duration-500 ease-out"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-2xl font-black text-gray-800 dark:text-white leading-none">{subject.progress}%</span>
                          <span className="text-[9px] text-gray-400 mt-0.5">Coverage</span>
                        </div>
                      </div>

                      <p className="text-xs text-gray-400 mt-2 text-center">
                        Keep active summaries generated to increase your mastery percentage automatically!
                      </p>
                    </Card>

                    {/* Topic Weightage / Syllabus details */}
                    <Card className="flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left p-6">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold uppercase text-gray-400">Curriculum Weightage</span>
                        <BrainCircuit className="w-4 h-4 text-primary-500" />
                      </div>
                      
                      <div className="flex-1 space-y-3.5">
                        {[
                          { name: 'Core Principles', weight: 40, proficiency: 85, color: 'bg-green-500' },
                          { name: 'Advanced Theory and Limits', weight: 30, proficiency: Math.max(subject.progress, 30), color: 'bg-primary-500' },
                          { name: 'Practical Applications case models', weight: 20, proficiency: Math.max(subject.progress - 10, 20), color: 'bg-indigo-500' },
                          { name: 'Syllabus Context Analysis', weight: 10, proficiency: 90, color: 'bg-purple-500' }
                        ].map((tp, idx) => (
                          <div key={idx}>
                            <div className="flex justify-between text-xs mb-1 font-medium">
                              <span className="text-gray-700 dark:text-gray-300 truncate mr-2">{tp.name}</span>
                              <span className="text-gray-450 text-[10px] whitespace-nowrap">{tp.weight}% weight</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all duration-500", tp.color)} style={{ width: `${tp.proficiency}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  {/* Weakness spotlight interactive dashboard helper */}
                  <Card className="bg-primary-50/50 dark:bg-primary-950/20 border-l-4 border-l-primary-500 border-y-primary-200/50 border-r-primary-200/50 dark:border-primary-900/35 p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center shadow-sm">
                          <BrainCircuit className="w-5.5 h-5.5" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-extrabold text-sm text-primary-950 dark:text-primary-200">AI Weakness Remedial Spotlights</h3>
                          <p className="text-xs text-primary-800/80 dark:text-primary-300/80 mt-0.5 font-medium">Targeted subjects with verified study voids needing revision.</p>
                        </div>
                      </div>
                      <Badge className="bg-primary-500 text-white dark:bg-primary-600 dark:text-primary-50 font-extrabold shadow-sm">High priority</Badge>
                    </div>

                    <div className="space-y-2.5">
                      {weakTopics.length === 0 ? (
                        <div className="text-xs text-emerald-600 font-bold flex items-center gap-1.5 py-2">
                          <CheckCircle2 className="w-4 h-4" /> Nothing to fix right now. Nice.
                        </div>
                      ) : (
                        weakTopics.slice(0, 2).map((wt, idx) => (
                          <div key={wt.id} className="p-3.5 bg-white dark:bg-gray-800/95 rounded-xl border border-primary-200/70 dark:border-primary-900/35 shadow-sm flex justify-between items-center text-xs">
                            <div className="space-y-1 max-w-[80%] text-left">
                              <span className="font-extrabold text-gray-800 dark:text-gray-200">{wt.name}</span>
                              <p className="text-[11px] text-primary-800 dark:text-primary-300 font-medium leading-tight">{wt.reviewIdea}</p>
                            </div>
                            <Button size="sm" variant="secondary" className="text-[10px] py-1 px-2.5 font-bold border-primary-200/50 hover:bg-primary-50 dark:hover:bg-primary-950/20 shrink-0" onClick={() => {
                              setActiveTab('weak-topics');
                            }}>
                              Launch Assist
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </div>

                {/* Vertical actions side: Quick access study launchpad & classmates presence list */}
                <div className="space-y-8">
                  
                  {/* Recent Activity history list */}
                  <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left">
                    <h3 className="text-xs font-bold uppercase text-gray-400 mb-4 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-primary-500" /> Recent Accomplishments
                    </h3>

                    <ul className="space-y-3.5">
                      <li className="flex gap-2.5 items-center">
                        <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                          <CheckCircle2 size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">Syllabus textbook established</p>
                          <p className="text-[10px] text-gray-400">Processed Today</p>
                        </div>
                        <Badge color="bg-emerald-50 text-emerald-800 font-bold">+10 XP</Badge>
                      </li>
                      
                      <li className="flex gap-2.5 items-center">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                          <CheckSquare size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">Practice Flashcards review</p>
                          <p className="text-[10px] text-gray-400">Yesterday</p>
                        </div>
                      </li>
                    </ul>
                  </Card>

                  {/* Subject Timetable Snapshot */}
                  <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left flex flex-col shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-primary-500" /> Subject Timetable
                      </h3>
                      <button 
                        onClick={() => setShowAddScheduleModal(true)} 
                        className="p-1 px-2 rounded bg-primary-50 dark:bg-primary-950/40 text-primary-600 hover:bg-primary-100 hover:text-primary-700 transition-colors text-xs font-semibold flex items-center gap-1"
                        title="Add Scheduled Time"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>

                    <div className="space-y-3.5 flex-1">
                      {subject?.schedule && subject.schedule.length > 0 ? (
                        subject.schedule.map((item, idx) => (
                          <div 
                            key={idx} 
                            className="group/item flex items-center justify-between p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 hover:bg-gray-50 dark:hover:bg-gray-900/60 transition-colors"
                          >
                            <div className="relative pl-3 border-l-2 border-primary-500 py-0.5">
                              <div className="absolute w-1.5 h-1.5 rounded-full bg-primary-500 -left-[4px] top-1.5"></div>
                              <span className="block text-xs font-bold text-gray-800 dark:text-gray-200">{item.day}</span>
                              <span className="block text-[10px] text-gray-500 mt-0.5">{item.time} • {item.room}</span>
                            </div>
                            <button
                              onClick={() => handleRemoveSchedule(idx)}
                              className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/20 transition-all opacity-0 group-hover/item:opacity-100 focus:opacity-100"
                              title="Delete timing"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-gray-400 italic py-6 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/30 dark:bg-gray-900/10">
                          <Compass className="w-6 h-6 mx-auto text-gray-350 mb-1.5" />
                          No scheduled class timings set.
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

              </div>

              {/* 5. Resource Explorer & Quick Tools */}
              <Card className="bg-slate-50 dark:bg-gray-800 border border-gray-200 text-left p-6 flex flex-col justify-between">
                <div>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Compass className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm">Resource Explorer</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Quickly generate summaries, flashcards, and practice quizzes.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    <button 
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setActiveTab('summary');
                      }}
                      className="flex flex-col text-left p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400 hover:shadow-sm transition-all"
                    >
                      <BookOpen className="w-5 h-5 text-primary-500 mb-2" />
                      <span className="text-sm font-bold">Generate Summaries</span>
                      <span className="text-xs text-gray-400">Condense long chapters.</span>
                    </button>
                    <button 
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setActiveTab('flashcards');
                      }}
                      className="flex flex-col text-left p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-400 hover:shadow-sm transition-all"
                    >
                      <Layers className="w-5 h-5 text-orange-500 mb-2" />
                      <span className="text-sm font-bold">Smart Flashcards</span>
                      <span className="text-xs text-gray-400">Review key terminology.</span>
                    </button>
                    <button 
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setActiveTab('quiz');
                      }}
                      className="flex flex-col text-left p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-400 hover:shadow-sm transition-all"
                    >
                      <PenTool className="w-5 h-5 text-emerald-500 mb-2" />
                      <span className="text-sm font-bold">Practice Quizzes</span>
                      <span className="text-xs text-gray-400">Test your knowledge.</span>
                    </button>
                    <button 
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setActiveTab('upload');
                      }}
                      className="flex flex-col text-left p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-400 hover:shadow-sm transition-all"
                    >
                      <FileUp className="w-5 h-5 text-purple-500 mb-2" />
                      <span className="text-sm font-bold">Upload Documents</span>
                      <span className="text-xs text-gray-400">Process syllabus & texts.</span>
                    </button>
                  </div>
                </div>
                
                <div className="mt-auto bg-blue-50 dark:bg-blue-900/20 p-3 flex rounded-xl border border-blue-100 dark:border-blue-800/30 items-center justify-between">
                   <div className="flex items-center gap-2">
                     <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                     <span className="text-xs font-medium text-blue-800 dark:text-blue-300">Next milestone: Mid-term Exam</span>
                   </div>
                   <span className="text-[10px] font-bold bg-white dark:bg-gray-800 px-2 py-1 rounded text-blue-600 dark:text-blue-400">4 days</span>
                </div>
              </Card>

            </div>
          )}

          {/* TAB 4.2: UPLOAD & DISK FILES INTERACTION (FFileReader) */}
          {activeTab === 'upload' && (
            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
              
              <div className="text-center p-10 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-3xl bg-white dark:bg-gray-800/20">
                <Upload className="w-16 h-16 text-primary-500 mx-auto mb-4 opacity-75" />
                <h3 className="text-xl font-bold mb-1">Upload Study Textbook Materials</h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto mb-6">
                  Select standard syllabus documents or paste raw Lecture parameters to initiate AI text evaluations.
                </p>

                <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center justify-center rounded-xl font-bold bg-primary-600 text-white hover:bg-primary-700 px-5 py-2.5 text-xs shadow-lg shadow-primary-500/25">
                      Select Text Document (.txt)
                    </span>
                    <input 
                      type="file" 
                      accept=".txt,.md,.json" 
                      className="hidden" 
                      onChange={handleFileUpload} 
                    />
                  </label>
                  
                  <span className="text-xs text-gray-400 font-mono">or paste raw study notes directly below</span>
                </div>
              </div>



              {/* Log List of upload history */}
              <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left">
                <h4 className="font-bold text-sm text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary-500" /> Tracked Upload History ({loadedFiles.length})
                </h4>

                <div className="space-y-2.5">
                  {loadedFiles.map((f, fIdx) => (
                    <div key={fIdx} className="flex justify-between items-center p-3 bg-gray-50/50 dark:bg-gray-800 rounded-xl border border-gray-200/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0 leading-none">
                          <span className="font-bold text-xs text-gray-700 dark:text-gray-200 truncate block">{f.name}</span>
                          <span className="text-[10px] text-gray-400 mt-1 block">Uploaded: {f.date} • {f.content.length} chars</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-1.5">
                        <Button variant="secondary" size="sm" className="text-[10px] py-1 px-3" onClick={() => handleSelectMaterial(f.content)}>
                          Process AI
                        </Button>
                        <button onClick={() => setLoadedFiles(loadedFiles.filter((_, i) => i !== fIdx))} className="text-gray-400 hover:text-red-500 p-1.5 rounded transition-colors bg-white border border-gray-200 shadow-sm">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

            </div>
          )}

          {/* TAB 4.3: AI SUMMARIES */}
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 h-full min-h-0 animate-in fade-in duration-300">
              <div className="lg:col-span-7 flex flex-col h-full min-h-0 gap-6">
                {/* Left pane: structured parsed output */}
                <Card className="flex flex-col flex-1 min-h-0 bg-slate-50/50 dark:bg-gray-800/10 border border-gray-200 text-left p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <BrainCircuit className="w-4 h-4 text-emerald-500" /> Restructured AI Summary
                    </h3>
                    
                    {generatedSummary && (
                      <Button variant="secondary" size="sm" className="text-[10px] py-1 px-3" onClick={() => {
                        navigator.clipboard.writeText(generatedSummary);
                        alert("Summary copied to Clipboard!");
                      }}>
                        Copy Summary
                      </Button>
                    )}
                  </div>

                  <div className="flex-1 overflow-auto min-h-0 bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    {generatedSummary ? (
                      <div className="whitespace-pre-wrap text-xs text-gray-750 dark:text-gray-200 leading-relaxed space-y-4 font-sans prose dark:prose-invert">
                        {generatedSummary}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                        <BrainCircuit className="w-12 h-12 mb-3 text-gray-300 animate-pulse" />
                        <p className="font-bold text-sm text-gray-600 dark:text-gray-300">No summary yet</p>
                        <p className="text-[11px] text-gray-400 mt-1 max-w-sm text-center">
                          Generate an AI summary from your selected document or custom topic below.
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
                <div className="shrink-0">
                  {renderDualInputHeader("AI Summaries", "Distill concepts into concise notes", handleGenerateSummary, isGenerating, "Generate Summary")}
                </div>
              </div>

              <div className="lg:col-span-3 h-full min-h-0 flex flex-col">
                {/* Right pane: Local History Vault */}
                <Card className="flex flex-col flex-1 min-h-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left p-6">
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary-500"/> Local History Vault
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {summaryHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-8">No summaries generated for this source yet.</div>
                    ) : (
                      summaryHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).map((hist, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">Generated Summary</p>
                            <p className="text-[10px] text-gray-400">{hist.date}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6" onClick={() => setPreviewContent({title: "Summary Preview", text: hist.content})}>
                            <Eye className="w-3.5 h-3.5 text-gray-500" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 4.4: FLASHCARDS */}
          {activeTab === 'flashcards' && (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 h-full min-h-0 animate-in fade-in duration-300">
              <div className="lg:col-span-7 flex flex-col h-full min-h-0 gap-6">
                {/* Left Pane: Flashcard Interaction */}
                <div className="flex flex-col items-center justify-center flex-1 min-h-0 bg-slate-50/50 dark:bg-gray-800/10 border border-gray-200 rounded-xl p-6 relative">
                  <div className="w-full max-w-lg mb-6">
                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-white text-center">Revision Study Deck</h2>
                  </div>

                  {flashcards.length > 0 ? (
                    <div className="w-full max-w-3xl space-y-6 relative flex items-center justify-center">
                      
                      {/* Left Navigation Arrow */}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full hidden sm:flex bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 backdrop-blur-sm -translate-x-4 lg:-translate-x-8"
                        onClick={() => { setIsFlipped(false); setActiveCardIndex(i => Math.max(0, i-1)); }} 
                        disabled={activeCardIndex === 0}
                      >
                        <ChevronLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                      </Button>

                      {/* Card Container */}
                      <div className="w-full max-w-lg space-y-6">
                        {/* Rotating Card */}
                        <div 
                          className="perspective-1000 w-full h-80 relative cursor-pointer active:scale-[0.99] transition-transform" 
                          onClick={() => setIsFlipped(!isFlipped)}
                        >
                          <div className={cn(
                            "w-full h-full transition-transform duration-500 transform-style-3d relative shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700",
                            isFlipped ? "rotate-y-180" : ""
                          )}>
                            {/* Front face query block */}
                            <div className="absolute inset-0 backface-hidden bg-white dark:bg-gray-800 p-8 flex flex-col justify-between rounded-2xl">
                              <div className="flex justify-between items-center">
                                <span className="uppercase text-[10px] font-extrabold text-primary-500 tracking-wider">Concept Question</span>
                                <HelpCircle className="w-4 h-4 text-gray-350" />
                              </div>
                              
                              <div className="text-center py-6">
                                <p className="text-xl md:text-2xl font-black text-gray-850 dark:text-white leading-snug">
                                  {flashcards[activeCardIndex].front}
                                </p>
                              </div>

                              <div className="text-center text-[11px] text-gray-400 font-medium tracking-wide">
                                <span className="font-mono text-gray-300">[{activeCardIndex + 1}/{flashcards.length}]</span> Click card to reveal answer
                              </div>
                            </div>

                            {/* Back face explanation block */}
                            <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-primary-700 to-primary-950 text-white p-8 flex flex-col justify-between rounded-2xl shadow-inner">
                              <div className="flex justify-between items-center">
                                <span className="uppercase text-[10px] font-bold text-primary-200 tracking-wider">Tutor Verification</span>
                                <CheckCircle2 className="w-4 h-4 text-emerald-450" />
                              </div>

                              <div className="text-center py-6">
                                <p className="text-lg md:text-xl font-bold leading-relaxed text-blue-50">
                                  {flashcards[activeCardIndex].back}
                                </p>
                              </div>

                              <div className="text-center text-[10px] text-primary-200 font-medium">
                                <span className="font-mono text-primary-300/50">[{activeCardIndex + 1}/{flashcards.length}]</span> Click card to return to question
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Feedback Action Row: Mastered vs Flag Weak */}
                        <div className="flex justify-center flex-wrap items-center gap-3">
                          <Button 
                            variant="secondary" 
                            className="text-xs font-bold border-red-200/50 hover:bg-red-50 text-red-600 flex items-center gap-1.5"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              flagFlashcardAsWeak(flashcards[activeCardIndex]);
                            }}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" /> Flag as Weak
                          </Button>

                          <Button 
                            variant="secondary" 
                            className={cn(
                              "text-xs font-bold flex items-center gap-1.5",
                              flashcards[activeCardIndex].mastered 
                                ? "bg-green-150 border-green-300 text-green-700" 
                                : "hover:bg-green-50 text-emerald-600"
                            )}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = flashcards.map((c, i) => i === activeCardIndex ? { ...c, mastered: !c.mastered } : c);
                              setFlashcards(updated);
                              alert(updated[activeCardIndex].mastered ? "Marked as mastered!" : "Marked outstanding.");
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> {flashcards[activeCardIndex].mastered ? "Mastered ✓" : "Mark Mastered"}
                          </Button>
                        </div>
                        
                        {/* Mobile Navigation (only visible on small screens) */}
                        <div className="flex sm:hidden items-center justify-between mt-4">
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => { setIsFlipped(false); setActiveCardIndex(i => Math.max(0, i-1)); }} 
                            disabled={activeCardIndex === 0}
                          >
                            <ChevronLeft className="w-4 h-4" /> Prev
                          </Button>
                          <span className="text-[10px] font-mono font-bold text-gray-400">
                            {activeCardIndex + 1} / {flashcards.length}
                          </span>
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => { setIsFlipped(false); setActiveCardIndex(i => Math.min(flashcards.length-1, i+1)); }} 
                            disabled={activeCardIndex === flashcards.length-1}
                          >
                            Next <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Right Navigation Arrow */}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full hidden sm:flex bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 backdrop-blur-sm translate-x-4 lg:translate-x-8"
                        onClick={() => { setIsFlipped(false); setActiveCardIndex(i => Math.min(flashcards.length-1, i+1)); }} 
                        disabled={activeCardIndex === flashcards.length-1}
                      >
                        <ChevronRight className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">No cards registered. Click regenerate AI Deck to generate textbook items!</div>
                  )}
                </div>
                <div className="shrink-0">
                  {renderDualInputHeader("Flashcards Room", "Flip cards to test active recall definitions", handleGenerateFlashcards, isGenerating, "Generate Deck")}
                </div>
              </div>

              <div className="lg:col-span-3 h-full min-h-0 flex flex-col">
                {/* Right Pane: Flashcard Deck History */}
                <Card className="flex flex-col flex-1 min-h-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left p-6">
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-500"/> Deck History Vault
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {flashcardDeckHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-8">No flashcard decks generated for this source yet.</div>
                    ) : (
                      flashcardDeckHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).map((hist, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl flex justify-between items-center">
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">Revision Deck ({hist.cardCount} cards)</p>
                            <p className="text-[10px] text-gray-400">{hist.date}</p>
                          </div>
                          <Button size="sm" variant="secondary" className="h-7 text-[10px] font-bold" onClick={() => alert("Launched past deck!")}>
                            Launch Study Session
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 4.5: PRACTICE QUIZ */}
          {activeTab === 'quiz' && (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 h-full min-h-0 animate-in fade-in duration-300">
              <div className="lg:col-span-7 flex flex-col h-full min-h-0 gap-6 text-left">
                <div className="flex-1 flex flex-col overflow-y-auto min-h-0 space-y-6">
                  
                  {!quizActive ? (
                    <Card className="flex-1 flex flex-col items-center justify-center text-center py-12 p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-6 min-h-[300px]">
                      <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-950/40 text-primary-600 flex items-center justify-center mx-auto shadow-md">
                        <CheckSquare className="w-8 h-8" />
                      </div>
                      
                      <div className="space-y-1">
                        <h2 className="text-2xl font-extrabold mb-1 self-center text-gray-900 dark:text-white">Syllabus Evaluation Quiz</h2>
                        <p className="text-xs text-gray-400 max-w-sm mx-auto">
                          Generate a randomized MCQ set review. Wrong items will auto-sync with your Weak Topic tracker review pane.
                        </p>
                      </div>

                      {/* Adaptive toggle switch */}
                      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 p-4 rounded-xl max-w-sm mx-auto flex items-center justify-between">
                        <div className="text-left leading-none">
                          <span className="font-bold text-xs text-gray-800 dark:text-gray-200 block">AI Adaptive Study Mode</span>
                          <span className="text-[10px] text-gray-400 mt-1 block">Adjusts curriculum difficulty dynamically.</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={isAdaptiveMode}
                            onChange={() => setIsAdaptiveMode(!isAdaptiveMode)} 
                            className="sr-only peer" 
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>

                      <div className="flex justify-center gap-3 pt-2">
                        <Button onClick={() => {
                          setQuizActive(true);
                          setCurrentQuestion(0);
                          setQuizScore(0);
                          setLastQuestionFeedback(null);
                          setShowQuizResult(false);
                        }}>
                          Start MCQ Session
                        </Button>
                      </div>
                    </Card>
                  ) : showQuizResult ? (
                    <Card className="text-center p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-6">
                      <div className="w-14 h-14 rounded-full bg-emerald-105 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">MCQ Session Finalized!</h2>
                        <p className="text-xs text-gray-400 mt-1">Check grade accomplishments below.</p>
                      </div>

                      <div className="inline-block px-10 py-4 bg-gray-50 rounded-2xl border">
                        <p className="text-[10px] text-gray-400 font-extrabold uppercase leading-none mb-1">Achieved Grade</p>
                        <span className="text-4xl font-black text-primary-600">
                          {quizScore} / {quizQuestions.length}
                        </span>
                        <span className="block text-xs font-bold text-gray-500 mt-1">
                          Score: {Math.round((quizScore / quizQuestions.length) * 100)}%
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                        Missed parameters are marked inside your tutor checklist. Click reset to review other material questions.
                      </p>

                      <div className="flex justify-center gap-2 pt-2">
                        <Button variant="ghost" onClick={handleResetQuiz}>Exit Quiz</Button>
                        <Button onClick={handleResetQuiz}>Rerun Practice Set</Button>
                      </div>
                    </Card>
                  ) : (
                <Card className="relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  
                  {/* Top slide tracker progress */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gray-100">
                    <div 
                      className="h-full bg-primary-500 transition-all duration-350" 
                      style={{ width: `${((currentQuestion + 1) / quizQuestions.length) * 100}%` }}
                    />
                  </div>

                  <div className="p-6 md:p-8 space-y-6">
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span className="font-bold">Syllabus Quiz Practice • Question {currentQuestion + 1} of {quizQuestions.length}</span>
                      <span className="font-bold text-primary-500 bg-primary-50 px-2.5 py-0.5 rounded-full dark:bg-primary-950/40">Current Score: {quizScore}</span>
                    </div>

                    <h3 className="text-lg font-black text-gray-900 dark:text-white leading-snug">
                      {quizQuestions[currentQuestion].question}
                    </h3>

                    {/* MCQ Options */}
                    <div className="space-y-2.5 pt-2">
                      {quizQuestions[currentQuestion].options.map((opt, idx) => {
                        const feedbackGiven = lastQuestionFeedback !== null;
                        const isCorrectAnswer = idx === quizQuestions[currentQuestion].correctIndex;
                        const isChosenAnswer = lastQuestionFeedback?.chosen === idx;

                        return (
                          <button 
                            key={idx}
                            disabled={feedbackGiven}
                            onClick={() => handleQuizAnswer(idx)}
                            className={cn(
                              "w-full text-left p-4 rounded-xl border transition-all text-xs flex items-center justify-between group",
                              feedbackGiven
                                ? isCorrectAnswer
                                  ? "border-green-500 bg-green-50 text-green-800"
                                  : isChosenAnswer
                                    ? "border-red-500 bg-red-50 text-red-800"
                                    : "border-gray-200 bg-gray-50 text-gray-400"
                                : "border-gray-200 hover:border-primary-500 hover:bg-primary-50/20 text-gray-700 dark:text-gray-300"
                            )}
                          >
                            <span>{opt}</span>
                            <div className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center",
                              feedbackGiven
                                ? isCorrectAnswer
                                  ? "border-green-500 bg-green-500 text-white text-[9px] font-bold"
                                  : isChosenAnswer
                                    ? "border-red-500 bg-red-500 text-white text-[9px] font-bold"
                                    : "border-gray-300"
                                : "border-gray-300 group-hover:border-primary-500"
                            )}>
                              {feedbackGiven && isCorrectAnswer && "✓"}
                              {feedbackGiven && isChosenAnswer && !isCorrectAnswer && "✗"}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Rich Explanation Corrective box */}
                    {lastQuestionFeedback && (
                      <div className={cn(
                        "p-4 rounded-xl border text-xs leading-relaxed transition-all animate-in fade-in",
                        lastQuestionFeedback.correct 
                          ? "bg-green-50 border-green-200 text-green-800" 
                          : "bg-orange-50 border-orange-200/50 text-orange-850"
                      )}>
                        <p className="font-bold flex items-center gap-1.5">
                          {lastQuestionFeedback.correct ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-orange-600" />}
                          AI Explanation Review:
                        </p>
                        <p className="mt-1">{lastQuestionFeedback.explanation}</p>
                        
                        <div className="mt-4 flex justify-end">
                          <Button size="sm" onClick={handleNextQuizQuestion}>
                            {currentQuestion === quizQuestions.length - 1 ? "Finish Quiz" : "Proceed Next Question"}
                          </Button>
                        </div>
                      </div>
                    )}

                  </div>
                </Card>
              )}
                </div>
                <div className="shrink-0 mt-auto">
                  {renderDualInputHeader("Practice Quiz", "Generate randomized MCQ set reviews", handleGenerateQuiz, isGenerating, "Generate MCQs")}
                </div>
              </div>

              <div className="lg:col-span-3 h-full min-h-0 flex flex-col">
                {/* Right Pane: Quiz History Vault */}
                <Card className="flex flex-col flex-1 min-h-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left p-6">
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                    <History className="w-4 h-4 text-pink-500"/> Quiz History Vault
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {quizHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-8">No past quiz evaluations for this source.</div>
                    ) : (
                      quizHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).map((hist, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl flex justify-between items-center">
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                              Score: <span className="text-primary-600">{hist.score}/{hist.total}</span>
                            </p>
                            <p className="text-[10px] text-gray-400">{hist.date}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="h-6">
                            Review
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 4.6: EXAM FEEDBACK RESULTS ONLY (Hidden if active exam is overlays) */}
          {activeTab === 'exam' && !examActive && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300 text-left">
              <Card className="text-center p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-6">
                <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
                  <GraduationCap className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Active High-Stakes Exam Hub</h2>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
                    Execute timed trials that mimic real curriculum exams with exact scoring grids.
                  </p>
                </div>

                {examFeedbackText && (
                  <div className="p-4 bg-gray-50 border rounded-2xl text-xs space-y-3">
                    <p className="font-bold uppercase text-[10px] text-gray-400">Previous Exam Results Diagnostic</p>
                    <p className="text-gray-700 leading-relaxed font-semibold">{examFeedbackText}</p>
                    <p className="text-[11px] text-gray-400 italic">Incorrect answers were automatically directed to your Weak Topics tracking pane.</p>
                  </div>
                )}

                <div className="flex justify-center pt-2">
                  <Button size="md" icon={Play} onClick={startExamModeSession}>
                    Initiate 10-Min Exam Mode Trial
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 4.7: EXAM GUESS ENGINE (Predicted final questions) */}
          {activeTab === 'guess-engine' && (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 h-full min-h-0 animate-in fade-in duration-300">
              <div className="lg:col-span-7 flex flex-col h-full min-h-0 gap-6 text-left">
                <div className="flex-1 overflow-y-auto min-h-0 flex flex-col space-y-8">
                  {/* Trigger header */}
                  <div className="shrink-0 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <div className="flex-1">
                      <h2 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-emerald-600" /> Exam Guess Engine
                      </h2>
                      <p className="text-xs text-gray-450 mt-1">
                        AI analyzes your notes or subject title to predict key exam topics, probable questions, and structures.
                      </p>
                    </div>
                  </div>

                  {!guessResults ? (
                    <Card className="flex-1 flex flex-col items-center justify-center text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 min-h-[300px]">
                      <BrainCircuit className="w-14 h-14 text-emerald-500/80 mx-auto mb-4 animate-bounce" />
                      <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">No predictions yet</h3>
                      <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1 leading-relaxed">
                        Attach a document or provide a topic and click "Predict Exams" below to rank likely exam topics.
                      </p>
                    </Card>
                  ) : (
                    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                      
                      {/* Predicted Topics Grid */}
                      <div>
                        <h3 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-4">Predicted Exam-Topic Probability Models</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {guessResults.predictions.map((p, idx) => {
                            const isHigh = p.probability === 'High';
                            const isMed = p.probability === 'Medium';
                            
                            return (
                              <Card key={idx} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-4 space-y-3 flex flex-col justify-between">
                                <div className="flex justify-between items-start">
                                  <span className="font-extrabold text-xs text-gray-800 dark:text-gray-200 leading-tight">{p.topic}</span>
                                  <Badge color={
                                    isHigh 
                                      ? "bg-red-50 text-red-700 font-bold" 
                                      : isMed 
                                        ? "bg-amber-50 text-amber-700" 
                                        : "bg-gray-50 text-gray-600"
                                  }>
                                    {p.probability} Prob
                                  </Badge>
                                </div>
                                
                                <p className="text-[11px] text-gray-500 leading-relaxed text-left">{p.reason}</p>
                                
                                <div className="pt-2 border-t text-[10px] text-gray-400 flex justify-between">
                                  <span>Estimated weight of overall test:</span>
                                  <span className="font-bold text-gray-700">{p.estimatedWeight}</span>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      </div>

                      {/* Sample Questions Structure */}
                      <div className="space-y-4">
                        <h3 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Estimated High-Yield Final Exam Questions</h3>
                        <div className="space-y-4">
                          {guessResults.sampleQuestions.map((sq, idx) => (
                            <Card key={idx} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 space-y-3">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-bold text-primary-600 uppercase">Question Type: {sq.format}</span>
                                <span className="text-gray-400">Candidate Draft #{idx+1}</span>
                              </div>
                              <h4 className="font-bold text-sm text-gray-900 border-l-2 border-primary-500 pl-3 text-left leading-snug">
                                {sq.question}
                              </h4>
                              <div className="bg-gray-50 dark:bg-gray-900 p-3.5 rounded-xl border text-xs leading-relaxed text-left space-y-1">
                                <span className="font-extrabold text-[10px] uppercase text-gray-400">Perfect Exam Structure Outline:</span>
                                <p className="whitespace-pre-wrap text-gray-600 font-mono text-[11px] mt-1 pr-4">{sq.suggestedStructure}</p>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>

                      {/* Prep Strategic Advices */}
                      <Card className="bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-250 dark:border-emerald-900/30 p-6 space-y-2 text-left">
                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                          <BrainCircuit className="w-5 h-5 text-emerald-600" />
                          <h4 className="font-bold text-sm">Strategic Grade-A Preparation Blueprint</h4>
                        </div>
                        <p className="text-xs text-yellow-900 leading-relaxed text-left">
                          {guessResults.strategicAdvice}
                        </p>
                      </Card>

                    </div>
                  )}
                </div>
                <div className="shrink-0 mt-auto">
                  {renderDualInputHeader("Exam Guess Engine", "Predict final exam question structures", handleRunGuessEngine, isGuessing, "Predict Exams")}
                </div>
              </div>

              <div className="lg:col-span-3 h-full min-h-0 flex flex-col">
                {/* Right Pane: Guess Engine History Vault */}
                <Card className="flex flex-col flex-1 min-h-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left p-6">
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-500"/> Predictions History Vault
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {guessPaperHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-8">No predicted exams for this source.</div>
                    ) : (
                      guessPaperHistory.filter(h => h.doc.length === selectedDocs.length && selectedDocs.every(d => h.doc.includes(d))).map((hist, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl flex justify-between items-center">
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                              Questions Base: <span className="text-primary-600">{hist.questions}</span>
                            </p>
                            <p className="text-[10px] text-gray-400">{hist.date}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="h-6">
                            Review
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 4.8: WEAK-TOPIC TRACKER */}
          {activeTab === 'weak-topics' && (
            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300 text-left">
              
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-amber-500" /> Weak-Topic tracker Hub
                  </h2>
                  <p className="text-xs text-gray-450 mt-1">
                    Track dynamic syllabus components failed during practice testing or flagged in flashcard sessions.
                  </p>
                </div>
                <Badge color="bg-amber-50 text-amber-800 font-bold">{weakTopics.length} Urgencies</Badge>
              </div>

              {weakTopics.length === 0 ? (
                <Card className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">No weak topics. You're on it.</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
                    No weak items recorded. Run more practice quizzes or flag card modules to track focus areas.
                  </p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {weakTopics.map(wt => (
                    <Card key={wt.id} className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-4 relative overflow-hidden">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <span className={cn(
                            "w-2.5 h-2.5 rounded-full",
                            wt.origin === 'quiz' ? "bg-pink-500" : "bg-purple-500"
                          )}></span>
                          <div>
                            <span className="font-black text-xs text-gray-800 dark:text-gray-200 leading-tight block">{wt.name}</span>
                            <span className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-wider block">Source origin: {wt.origin} • Added: {wt.date}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="secondary" size="sm" className="text-[10px] py-1 px-3" onClick={async () => {
                            // Pre-populate Tutor Chat on this query!
                            setTutorInputValue(`Tutor, can you explain this weak area: "${wt.name}"? Please provide a simple example and study notes.`);
                            setActiveTab('overview');
                            alert("Pre-populated weak point topic in your Tutor AI chat pane! Scroll down to prompt.");
                          }}>
                            Ask Tutor AI
                          </Button>
                          
                          <button 
                            onClick={() => handleClearWeakTopic(wt.id)}
                            className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded border border-gray-200 transition-colors bg-white shadow-sm"
                            title="Mark Cleared / Mastered"
                          >
                            <CheckCircle2 size={13} className="text-emerald-500 hover:text-white" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-900/55 p-3 rounded-xl border text-xs text-gray-650 leading-relaxed italic text-left">
                        <span className="font-bold text-[10px] uppercase text-gray-400 not-italic block mb-0.5">Remedial Focus recommendation:</span>
                        {wt.reviewIdea}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* TAB 4.9: GROUP STUDY ROOM / PRESENCE */}
          {activeTab === 'studyroom' && (
            <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300 text-left">
              
              {!currentGuildCode ? (
                /* Discord Welcome Lobby */
                <div className="p-8 max-w-4xl mx-auto space-y-8 w-full">
                  <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-150">
                      <Users className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-black text-gray-901">Study groups</h2>
                    <p className="text-xs text-gray-450 max-w-lg mx-auto">
                      Start a group or join one with a code. Chat, share notes and run study timers together.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                    {/* Join Guild Panel */}
                    <Card className="flex flex-col justify-between border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1 px-2 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">INVITE RECIPIENT</span>
                          <h3 className="font-extrabold text-sm text-gray-800">Join a group</h3>
                        </div>
                        <p className="text-[11px] text-gray-400">Specify an invitation code received from a peer, or jump instantly into a recommended room below.</p>
                      </div>

                      <div className="space-y-3 pt-2">
                        <div>
                          <label className="block text-[10px] uppercase font-extrabold tracking-wider text-gray-400 mb-1">Invitation Code</label>
                          <Input 
                            id="guildCodeInput"
                            placeholder="e.g. MATH101, PHYS202" 
                            className="bg-gray-50 border border-gray-200 text-xs py-2"
                          />
                        </div>

                        <Button 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => {
                            const val = (document.getElementById('guildCodeInput') as HTMLInputElement)?.value;
                            if (val) handleJoinGuild(val);
                            else alert("Please enter a valid invitation code.");
                          }}
                        >
                          Join group
                        </Button>
                      </div>

                      <div className="pt-3 border-t border-gray-100 space-y-2">
                        <span className="block text-[10px] uppercase font-extrabold text-gray-400 tracking-wider">Active Public Study Groups:</span>
                        <div className="grid grid-cols-2 gap-2 text-left">
                          <button 
                            onClick={() => handleJoinGuild('MATH101')}
                            className="p-2 border rounded-lg hover:border-emerald-500 bg-gray-50/50 hover:bg-emerald-50/20 dark:bg-gray-900/40 dark:border-gray-700 dark:text-gray-200 text-xs transition-all text-left"
                          >
                            <span className="block font-bold text-gray-700 text-[11px]">📐 Math-Prep-101</span>
                            <span className="text-[9px] text-gray-400 font-mono">Code: MATH101</span>
                          </button>
                          <button 
                            onClick={() => handleJoinGuild('PHYS202')}
                            className="p-2 border rounded-lg hover:border-emerald-500 bg-gray-50/50 hover:bg-emerald-50/20 dark:bg-gray-900/40 dark:border-gray-700 dark:text-gray-200 text-xs transition-all text-left"
                          >
                            <span className="block font-bold text-gray-700 text-[11px]">⚡ Phys-Core Guild</span>
                            <span className="text-[9px] text-gray-400 font-mono">Code: PHYS202</span>
                          </button>
                        </div>
                      </div>
                    </Card>

                    {/* Create Guild Panel */}
                    <Card className="flex flex-col justify-between border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1 px-2 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">ORGANIZER HUB</span>
                          <h3 className="font-extrabold text-sm text-gray-800">Start a group</h3>
                        </div>
                        <p className="text-[11px] text-gray-400">Generate a unique dynamic invitation link to broadcast to teammates. Complete with dedicated channels.</p>
                      </div>

                      <div className="space-y-3 pt-2 flex-1 flex flex-col justify-end">
                        <div>
                          <label className="block text-[10px] uppercase font-extrabold tracking-wider text-gray-400 mb-1">Guild/Group Name</label>
                          <Input 
                            id="guildNameInput"
                            placeholder="e.g. Calculus Crushing Society" 
                            className="bg-gray-50 border border-gray-200 text-xs py-2"
                          />
                        </div>

                        <Button 
                          size="sm" 
                          variant="primary"
                          className="w-full text-xs"
                          onClick={() => {
                            const val = (document.getElementById('guildNameInput') as HTMLInputElement)?.value;
                            if (val && val.trim()) {
                              handleCreateGuild(val);
                            } else {
                              alert("Please input a study guild name.");
                            }
                          }}
                        >
                          Create Invite Guild Room
                        </Button>
                      </div>

                      <div className="pt-4 text-center">
                        <span className="text-[10px] text-gray-400 italic">No external setup or servers required. Sychronized instantly in offline sandbox state.</span>
                      </div>
                    </Card>
                  </div>
                </div>
              ) : (
                /* Discord-Style Immersive Workspace */
                <div className="flex flex-1 flex-col md:flex-row h-[550px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:bg-gray-900 shadow-sm">
                  
                  {/* Left Sidebar (Guild Channels selector) */}
                  <div className="w-full md:w-56 bg-gray-50 dark:bg-gray-950 border-b md:border-b-0 md:border-r border-gray-150 flex flex-col justify-between shrink-0">
                    <div className="p-4 border-b border-gray-150 space-y-1">
                      <div className="flex justify-between items-center gap-1.5 min-w-0">
                        <h3 className="font-bold text-xs truncate text-gray-800 dark:text-white" title={guildName}>
                          {guildName}
                        </h3>
                        <span className="shrink-0 p-0.5 px-1.5 rounded bg-emerald-50 text-emerald-700 text-[8px] font-mono font-bold">ACTIVE</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span className="font-mono">Code: {currentGuildCode}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(currentGuildCode || '');
                            alert("Invitation Code copied to clipboard: " + currentGuildCode);
                          }}
                          className="p-1 hover:text-emerald-600 transition-colors"
                          title="Copy Code"
                        >
                          <Share2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Channels list */}
                    <div className="flex-1 overflow-y-auto p-2 py-3 space-y-1">
                      <span className="block px-2 text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-2">Text Channels</span>
                      
                      <button 
                        onClick={() => setActiveChannel('welcome')}
                        className={cn(
                          "w-full flex items-center gap-2 p-2 rounded-lg text-xs transition-colors",
                          activeChannel === 'welcome' 
                            ? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-bold" 
                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400"
                        )}
                      >
                        <Shield className="w-3.5 h-3.5" /> welcome-rules
                      </button>

                      <button 
                        onClick={() => setActiveChannel('chat')}
                        className={cn(
                          "w-full flex items-center gap-2 p-2 rounded-lg text-xs transition-colors",
                          activeChannel === 'chat' 
                            ? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-bold" 
                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400"
                        )}
                      >
                        <Hash className="w-3.5 h-3.5" /> general-chat
                      </button>

                      <button 
                        onClick={() => setActiveChannel('resources')}
                        className={cn(
                          "w-full flex items-center gap-2 p-2 rounded-lg text-xs transition-colors",
                          activeChannel === 'resources' 
                            ? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-bold" 
                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400"
                        )}
                      >
                        <BookOpen className="w-3.5 h-3.5" /> notes-slides-share
                      </button>

                      <span className="block px-2 text-[9px] uppercase font-bold text-gray-400 tracking-wider mt-4 mb-2">Focus Rooms</span>

                      <button 
                        onClick={() => setActiveChannel('whiteboard')}
                        className={cn(
                          "w-full flex items-center gap-2 p-2 rounded-lg text-xs transition-colors",
                          activeChannel === 'whiteboard' 
                            ? "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-bold" 
                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400"
                        )}
                      >
                        <Clock className="w-3.5 h-3.5 animate-pulse" /> focus-whiteboard
                      </button>
                    </div>

                    {/* Exit Study Guild footer */}
                    <div className="p-3 border-t border-gray-150 bg-gray-100/50 dark:bg-gray-950 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs truncate pr-2">
                        <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-[10px]">S</div>
                        <span className="font-semibold text-gray-600 dark:text-gray-300 truncate">Scholar (You)</span>
                      </div>
                      <button 
                        onClick={handleLeaveGuild}
                        className="p-1 px-2 rounded-md hover:bg-red-50 text-red-500 hover:text-red-700 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 transition-all"
                        title="Leave current study guild"
                      >
                        <LogOut className="w-3 h-3" /> Lift
                      </button>
                    </div>
                  </div>

                  {/* Main Interaction Area based on channel */}
                  <div className="flex-1 flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden">
                    
                    {/* Header bar of Channel */}
                    <div className="p-4 border-b border-gray-150 flex items-center gap-2 bg-gray-50/30">
                      <Hash className="w-4 h-4 text-gray-400" />
                      <span className="font-extrabold text-sm text-gray-800 dark:text-white">
                        {activeChannel === 'welcome' && 'welcome-rules'}
                        {activeChannel === 'chat' && 'general-chat'}
                        {activeChannel === 'resources' && 'notes-slides-share'}
                        {activeChannel === 'whiteboard' && 'focus-whiteboard'}
                      </span>
                      <span className="text-[10px] text-gray-400 px-2 border-l">
                        {activeChannel === 'welcome' && 'Announcements, server info and invite protocols.'}
                        {activeChannel === 'chat' && 'Continuous dialogue stream with online study colleagues.'}
                        {activeChannel === 'resources' && 'Shared peer library of notes, presentations and textbook link cards.'}
                        {activeChannel === 'whiteboard' && 'Synchronous study stopwatch and collaborative scribbling pad.'}
                      </span>
                    </div>

                    {/* Content area */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0 no-scrollbar">
                      
                      {activeChannel === 'welcome' && (
                        /* Welcome & Regulations page */
                        <div className="max-w-2xl space-y-6 animate-in fade-in py-2">
                          <Card className="bg-gradient-to-br from-emerald-500/5 to-primary-500/5 border border-emerald-150 p-6 space-y-4">
                            <h4 className="text-base font-extrabold text-gray-800">🎉 Successfully connected to {guildName}!</h4>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              This study room has been established matching your active syllabus code block. Invitation credentials are saved locally to allow classmates to link up automatically.
                            </p>
                            <div className="p-3 bg-white/80 dark:bg-gray-800 rounded-xl border flex items-center justify-between text-xs font-semibold">
                              <span>Dynamic Room Invite Link:</span>
                              <span className="font-mono bg-gray-100 rounded px-1.5 py-0.5 text-primary-600">{currentGuildCode}</span>
                            </div>
                          </Card>

                          <div className="space-y-3">
                            <h5 className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Cooperative Guild Protocol</h5>
                            <div className="space-y-2.5">
                              <div className="flex gap-2 text-xs">
                                <span className="p-1 px-1.5 h-max rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">RULE #1</span>
                                <p className="text-gray-500"><strong>Share Generously:</strong> Post summarized lecture flashnotes and slide decks onto the <strong>#notes-slides-share</strong> tab stream.</p>
                              </div>
                              <div className="flex gap-2 text-xs">
                                <span className="p-1 px-1.5 h-max rounded bg-blue-50 text-blue-700 text-[10px] font-bold">RULE #2</span>
                                <p className="text-gray-500"><strong>Clock in Sync:</strong> Utilize the shared Pomodoro countdown inside <strong>#focus-whiteboard</strong> when tackling homework sprints.</p>
                              </div>
                              <div className="flex gap-2 text-xs">
                                <span className="p-1 px-1.5 h-max rounded bg-purple-50 text-purple-700 text-[10px] font-bold">RULE #3</span>
                                <p className="text-gray-500"><strong>Clarify Early:</strong> Paste hard math formulas or source logs directly onto the interactive Scribble whiteboard so others can refine them.</p>
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t text-center">
                            <Button size="sm" onClick={() => setActiveChannel('chat')}>
                              Join General Discussion Stream
                            </Button>
                          </div>
                        </div>
                      )}

                      {activeChannel === 'chat' && (
                        /* Discord conversational box */
                        <div className="flex flex-col h-full min-h-[350px]">
                          <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar pb-4">
                            {groupChat.map((gc, gcIdx) => (
                              <div key={gcIdx} className="flex gap-3 hover:bg-gray-50/50 p-2 rounded-lg transition-colors items-start">
                                <div className={cn(
                                  "w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0",
                                  gc.isPeer ? "bg-indigo-100 text-indigo-700" : "bg-primary-600 text-white"
                                )}>
                                  {gc.sender[0]}
                                </div>
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-[11px] text-gray-800 dark:text-gray-200">{gc.sender}</span>
                                    <span className="text-[9px] text-gray-400 font-normal">{gc.time}</span>
                                  </div>
                                  <p className="text-xs text-gray-600 leading-relaxed break-words">{gc.text}</p>
                                </div>
                              </div>
                            ))}
                            <div ref={chatBottomRef} />
                          </div>

                          {/* Chat input box */}
                          <form onSubmit={handleSendGroupChat} className="pt-2 border-t flex gap-2">
                            <Input 
                              value={chatInputValue}
                              onChange={e => setChatInputValue(e.target.value)}
                              placeholder={`Message #${guildName}`} 
                              className="bg-gray-50 text-xs py-2 pr-10 flex-1 border border-gray-200"
                            />
                            <Button type="submit" size="sm" className="shrink-0">
                              Send message
                            </Button>
                          </form>
                        </div>
                      )}

                      {activeChannel === 'resources' && (
                        /* Resource Sharing Library */
                        <div className="space-y-6 animate-in fade-in">
                          
                          {/* Add Resource Form Inline */}
                          <Card className="p-4 border border-gray-200 dark:border-gray-700 bg-slate-50/10 dark:bg-gray-800/30 space-y-4">
                            <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider">Deploy Note or slide deck Link</h4>
                            
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.target as HTMLFormElement;
                                const titleVal = (form.elements.namedItem('res_title') as HTMLInputElement).value;
                                const typeVal = (form.elements.namedItem('res_type') as HTMLSelectElement).value as 'note' | 'slide' | 'link';
                                if (titleVal && titleVal.trim()) {
                                  handleAddResource(titleVal, typeVal);
                                  form.reset();
                                } else {
                                  alert("Please input a valid resource name.");
                                }
                              }}
                              className="grid grid-cols-1 md:grid-cols-3 gap-3"
                            >
                              <div className="md:col-span-2">
                                <Input 
                                  name="res_title" 
                                  placeholder="e.g. Euler's Method Practice Problems PDF" 
                                  className="text-xs bg-white border border-gray-200"
                                  required
                                />
                              </div>
                              <div className="flex gap-1.5">
                                <select 
                                  name="res_type" 
                                  className="rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-750 dark:text-gray-200 bg-white dark:bg-gray-800 px-2 focus:ring-2 focus:ring-emerald-500/20"
                                >
                                  <option value="note">Summary Note</option>
                                  <option value="slide">Slide Deck</option>
                                  <option value="link">Web Reference Link</option>
                                </select>
                                <Button type="submit" size="sm" className="text-xs shrink-0 py-1 px-3">
                                  Deploy File
                                </Button>
                              </div>
                            </form>
                          </Card>

                          {/* Existing library scroll list */}
                          <div className="space-y-3">
                            <h4 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Active Resource Stream ({sharedResources.length})</h4>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {sharedResources.map((res) => (
                                <div key={res.id} className="flex gap-3 hover:bg-gray-50/60 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all text-left">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                    {res.type === 'note' && <FileText className="w-4 h-4" />}
                                    {res.type === 'slide' && <Layers className="w-4 h-4" />}
                                    {res.type === 'link' && <Share2 className="w-4 h-4" />}
                                  </div>
                                  <div className="space-y-1 min-w-0 flex-1">
                                    <span className="block font-bold text-xs text-gray-800 dark:text-gray-200 truncate leading-tight pr-2">
                                      {res.name}
                                    </span>
                                    <div className="flex justify-between items-center text-[9px] text-gray-400">
                                      <span>By {res.addedBy} • {res.date}</span>
                                      <button 
                                        className="text-primary-600 font-bold hover:underline"
                                        onClick={() => alert(`Opening resource sandbox viewport for: "${res.name}"`)}
                                      >
                                        Inspect File
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                        </div>
                      )}

                      {activeChannel === 'whiteboard' && (
                        /* Combined Pomodoro Tracker & Collaborative scribble board */
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch h-full animate-in fade-in">
                          
                          {/* Shared Pomodoro stopwatch */}
                          <div className="lg:col-span-1 pt-2">
                            <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-center space-y-4 flex flex-col justify-center h-full">
                              <div className="space-y-1">
                                <Badge color={pomodoroMode === 'work' ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}>
                                  {pomodoroMode === 'work' ? 'WORK PHASE' : 'BREAK PHASE'}
                                </Badge>
                                <span className="block text-4xl font-black font-mono tracking-tight text-gray-800 select-none">
                                  {Math.floor(pomodoroTime / 60)}:{String(pomodoroTime % 60).padStart(2, '0')}
                                </span>
                                <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                                  Lobbies Cycle: {pomodoroCycles} Mastered
                                </span>
                              </div>

                              <div className="flex justify-center gap-1.5">
                                <Button 
                                  variant={pomodoroActive ? 'secondary' : 'primary'} 
                                  size="sm" 
                                  className="text-xs py-1"
                                  onClick={() => setPomodoroActive(!pomodoroActive)}
                                >
                                  {pomodoroActive ? 'Pause' : 'Start sprint'}
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-xs py-1"
                                  onClick={() => {
                                    setPomodoroActive(false);
                                    setPomodoroTime(pomodoroMode === 'work' ? 1500 : 300);
                                  }}
                                >
                                  Reset
                                </Button>
                              </div>
                            </Card>
                          </div>

                          {/* Shared scribble board */}
                          <div className="lg:col-span-2 flex flex-col min-h-[250px]">
                            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 flex-1 flex flex-col space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-extrabold text-gray-800 flex items-center gap-1">
                                  <PenTool className="w-3.5 h-3.5 text-primary-500" /> Collaborative Scribble Pad
                                </span>
                                <span className="text-[10px] text-gray-400">Auto-saves locally</span>
                              </div>
                              <textarea 
                                className="flex-1 w-full bg-gray-50/30 dark:bg-gray-900/50 p-3 border border-gray-200 dark:border-gray-700 rounded-xl font-mono text-[10px] leading-relaxed text-left outline-none resize-none"
                                defaultValue={`// CO-STUDY SCRIBLES CHANNEL\n// Formulas sync dynamically with peers:\n1. Limit equation (x^2 - 1)/(x - 1) as x->1 converges to 2.\n2. Review Taylor Series representation on derivative functions.\n3. Make sure to complete Adaptive quiz modules by Wed.`}
                              />
                              <div className="flex justify-end">
                                <Button 
                                  size="sm" 
                                  className="text-[10px] py-1 px-3"
                                  onClick={() => alert("Scribbles broadcast to online peer channels whiteboard!")}
                                >
                                  Broadcast scribbles
                                </Button>
                              </div>
                            </Card>
                          </div>

                        </div>
                      )}

                    </div>
                  </div>

                  {/* Right Sidebar (Online classmates) */}
                  <div className="w-full md:w-52 bg-gray-50 dark:bg-gray-950 border-t md:border-t-0 md:border-l border-gray-150 flex flex-col shrink-0">
                    <div className="p-3 border-b text-[10px] uppercase font-extrabold text-gray-450 tracking-wider flex justify-between items-center bg-gray-100/30">
                      <span>Online Active ({activeChannel === 'chat' ? '4' : '3'})</span>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    </div>
                    
                    <div className="p-3 flex-1 overflow-y-auto space-y-3.5">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px]">S</div>
                        <div className="min-w-0">
                          <span className="block font-bold text-gray-700 dark:text-gray-300 truncate">Sarah Lin</span>
                          <span className="block text-[9px] text-emerald-600 font-medium">Reviewing files</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-[10px]">A</div>
                        <div className="min-w-0">
                          <span className="block font-bold text-gray-700 dark:text-gray-300 truncate">Alex Rover</span>
                          <span className="block text-[9px] text-red-500">Pomodoro focus...</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-[10px]">J</div>
                        <div className="min-w-0">
                          <span className="block font-bold text-gray-700 dark:text-gray-300 truncate">Jessica K.</span>
                          <span className="block text-[9px] text-gray-400">Offline soon</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs pt-2 border-t border-gray-200">
                        <div className="w-5 h-5 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center text-[10px]">Y</div>
                        <div className="min-w-0">
                          <span className="block font-bold text-gray-800 dark:text-gray-200 truncate">Scholar (You)</span>
                          <span className="block text-[9px] text-emerald-600 font-medium">Viewing {activeChannel}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-100/50 dark:bg-gray-900 border-t flex justify-center text-center">
                      <span className="text-[9px] text-gray-400">Connected to secure sandbox gateway.</span>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* TAB 4.10: KANBAN BOARD */}
          {activeTab === 'kanban' && (
            <div className="h-full flex flex-col space-y-4 text-left animate-in fade-in duration-300">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 px-6 rounded-2xl flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-extrabold text-sm text-gray-800">Dynamic Planning Kanban</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Drag and drop items to shift active study workflows.</p>
                </div>
                <Button size="sm" icon={Plus} onClick={() => {
                  const title = prompt("Enter target study task title:");
                  if (title && title.trim()) {
                    setKanbanTasks([...kanbanTasks, { id: Date.now().toString(), title: title.trim(), status: 'todo' }]);
                  }
                }}>
                  Add Kanban Task
                </Button>
              </div>

              <div className="flex-1 min-h-0">
                <KanbanBoard tasks={kanbanTasks} onUpdateTasks={setKanbanTasks} />
              </div>
            </div>
          )}

          {/* TAB 4.11: MOODBOARD */}
          {activeTab === 'moodboard' && (
            <div className="h-full flex flex-col space-y-4 text-left animate-in fade-in duration-300">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 px-6 rounded-xl flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-extrabold text-sm text-gray-800">Visual Sticky Note Moodboard</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Drag to reposition notes. Click note area to enter study ideas or quotes.</p>
                </div>
              </div>
              
              <div className="flex-1 min-h-0">
                <MoodBoard notes={moodNotes} onUpdateNotes={setMoodNotes} />
              </div>
            </div>
          )}

          {/* TAB 4.12: REMINDERS */}
          {activeTab === 'reminders' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300 text-left">
              
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">Syllabus Due Dates & Notifications</h2>
                  <p className="text-xs text-gray-405 mt-1">Review active reminder configurations below.</p>
                </div>
                <Badge color="bg-primary-50 text-primary-800 font-bold">{reminders.length} Active</Badge>
              </div>

              <div className="space-y-3">
                {reminders.map(rem => (
                  <Card key={rem.id} className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl">
                        <Bell size={18} />
                      </div>
                      <div className="leading-none text-left">
                        <h3 className="font-black text-xs text-gray-800">{rem.message}</h3>
                        <span className="text-[10px] text-gray-400 mt-1 block">Due Milestone: {rem.date}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Sent via {rem.platform}
                      </span>
                      <button onClick={() => handleRemoveReminder(rem.id)} className="p-1 hover:bg-red-50 text-gray-450 hover:text-red-500 rounded border">
                        <X size={14} />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Form creation card */}
              <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-left space-y-4">
                <h4 className="font-extrabold text-sm text-gray-800">New reminder</h4>
                
                <form onSubmit={handleCreateReminder} className="space-y-4 text-xs font-medium">
                  <div>
                    <label className="block text-gray-400 mb-1 font-bold">Reminder Alert Text</label>
                    <Input name="message" required placeholder="e.g. Finish Taylor Series practice test..." className="text-xs" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 mb-1 font-bold">Due Date Target</label>
                      <Input name="dueDate" type="date" defaultValue="2026-06-15" className="text-xs" />
                    </div>
                    
                    <div>
                      <label className="block text-gray-400 mb-1 font-bold">Platform Dispatch</label>
                      <select name="platform" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs outline-none focus:border-primary-500">
                        <option value="telegram">Telegram Prep Bot Alert</option>
                        <option value="email">Direct Email Summaries</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button type="submit">Add reminder</Button>
                  </div>
                </form>
              </Card>

            </div>
          )}

        </div>

      </main>

      {/* Add Schedule Modal */}
      {showAddScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm animate-in zoom-in-95 duration-200 bg-white dark:bg-gray-800 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-500" /> Add Timetable
              </h2>
              <button onClick={() => setShowAddScheduleModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSchedule} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Class Day</label>
                  <select name="schedule_day" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-white outline-none">
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Timing</label>
                  <Input name="schedule_time" placeholder="e.g. 10:00 AM - 11:30 AM" defaultValue="10:00 AM - 11:30 AM" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Room / Location</label>
                  <Input name="schedule_room" placeholder="e.g. Room 301" defaultValue="Room 301" />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-gray-100 dark:border-gray-700">
                <Button type="button" variant="ghost" onClick={() => setShowAddScheduleModal(false)}>Cancel</Button>
                <Button type="submit">Save Class</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* History Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl animate-in zoom-in-95 duration-200 bg-white dark:bg-gray-900 shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary-500" /> {previewContent.title}
              </h2>
              <button onClick={() => setPreviewContent(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1">
                <X size={18} />
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-sm text-gray-700 dark:text-gray-200 font-serif whitespace-pre-wrap">
              {previewContent.text}
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setPreviewContent(null)}>Close Preview</Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};
